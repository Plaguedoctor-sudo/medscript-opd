'use server';

import { db, sqlite } from '@/db';
import { prescriptions, patients, clinicSettings, ipdAdmissions } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export interface IdspDiseaseCategory {
  id: string;
  name: string;
  syndromeCode: string;
  keywords: string[];
  under5Male: number;
  under5Female: number;
  age5to14Male: number;
  age5to14Female: number;
  over15Male: number;
  over15Female: number;
  totalCases: number;
  totalAdmissions: number;
  isAlertTriggered?: boolean;
}

export interface IdspWeeklyReport {
  year: number;
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalOpdCases: number;
  totalIpdCases: number;
  categories: IdspDiseaseCategory[];
  clinic: {
    name: string;
    doctor: string;
    address: string;
    regNumber: string;
  };
}

const IDSP_SYNDROME_DEFINITIONS: { id: string; name: string; syndromeCode: string; keywords: string[]; alertThreshold: number }[] = [
  {
    id: 'add',
    name: 'Acute Diarrhoeal Disease (including Acute Gastroenteritis / Cholera)',
    syndromeCode: 'ADD-01',
    keywords: ['diarrhea', 'diarrhoea', 'loose motion', 'gastroenteritis', 'vomiting', 'cholera', 'watery stool', 'dysentery', 'food poisoning', 'dehydration'],
    alertThreshold: 5,
  },
  {
    id: 'bacillary_dysentery',
    name: 'Bacillary Dysentery (Diarrhoea with visible blood)',
    syndromeCode: 'BD-02',
    keywords: ['blood in stool', 'bloody diarrhea', 'bloody diarrhoea', 'shigella', 'dysentery', 'amoebic dysentery'],
    alertThreshold: 3,
  },
  {
    id: 'viral_hepatitis',
    name: 'Viral Hepatitis (Acute Jaundice)',
    syndromeCode: 'VH-03',
    keywords: ['jaundice', 'hepatitis', 'icterus', 'hyperbilirubinemia', 'yellow urine', 'yellow eyes'],
    alertThreshold: 2,
  },
  {
    id: 'enteric_fever',
    name: 'Enteric / Typhoid Fever',
    syndromeCode: 'EF-04',
    keywords: ['typhoid', 'enteric fever', 'salmonella', 'widal', 'step ladder fever'],
    alertThreshold: 4,
  },
  {
    id: 'malaria',
    name: 'Malaria (Fever with chills / rigors)',
    syndromeCode: 'MAL-05',
    keywords: ['malaria', 'plasmodium', 'vivax', 'falciparum', 'chills and rigor', 'smear positive'],
    alertThreshold: 3,
  },
  {
    id: 'dengue',
    name: 'Dengue / Dengue Hemorrhagic Fever (DHF / DSS)',
    syndromeCode: 'DEN-06',
    keywords: ['dengue', 'breakbone fever', 'thrombocytopenia', 'ns1 positive', 'igm dengue', 'petechiae'],
    alertThreshold: 2,
  },
  {
    id: 'chikungunya',
    name: 'Chikungunya (Fever with severe joint pain / arthralgia)',
    syndromeCode: 'CHK-07',
    keywords: ['chikungunya', 'chikv', 'severe arthralgia', 'crippling joint pain'],
    alertThreshold: 2,
  },
  {
    id: 'ari_ili',
    name: 'Acute Respiratory Infection (ARI) / Influenza-Like Illness (ILI)',
    syndromeCode: 'ARI-08',
    keywords: ['ari', 'ili', 'influenza', 'flu', 'cough', 'cold', 'coryza', 'rhinitis', 'pharyngitis', 'tonsillitis', 'bronchitis', 'uri', 'upper respiratory'],
    alertThreshold: 15,
  },
  {
    id: 'sari_pneumonia',
    name: 'Severe Acute Respiratory Infection (SARI) / Pneumonia',
    syndromeCode: 'SARI-09',
    keywords: ['sari', 'pneumonia', 'dyspnea', 'breathlessness', 'consolidation', 'crepitations', 'respiratory distress', 'hypoxia', 'low spo2'],
    alertThreshold: 3,
  },
  {
    id: 'aes_meningitis',
    name: 'Acute Encephalitis Syndrome (AES) / Meningitis',
    syndromeCode: 'AES-10',
    keywords: ['encephalitis', 'aes', 'meningitis', 'altered sensorium', 'neck stiffness', 'kernig', 'convulsion', 'seizure with fever'],
    alertThreshold: 1,
  },
  {
    id: 'measles_rubella',
    name: 'Measles / Rubella (Fever with maculopapular rash)',
    syndromeCode: 'MR-11',
    keywords: ['measles', 'rubella', 'fever with rash', 'koplik spots', 'maculopapular rash'],
    alertThreshold: 1,
  },
  {
    id: 'animal_bite',
    name: 'Animal Bites (Dog Bite / Snake Bite / Rabies Risk)',
    syndromeCode: 'AB-12',
    keywords: ['dog bite', 'snake bite', 'animal bite', 'rabies', 'monkey bite', 'scorpion sting'],
    alertThreshold: 2,
  },
  {
    id: 'puo',
    name: 'Pyrexia of Unknown Origin (Fever > 7 days without localized cause)',
    syndromeCode: 'PUO-13',
    keywords: ['puo', 'fever > 7', 'unexplained fever', 'prolonged fever', 'undiagnosed fever'],
    alertThreshold: 3,
  },
];

/**
 * Calculates start and end dates (Monday to Sunday) for an ISO Epidemiological Week
 */
function getWeekDates(year: number, week: number): { startDate: string; endDate: string } {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);

  const format = (d: Date) => d.toISOString().split('T')[0];
  return {
    startDate: format(isoWeekStart),
    endDate: format(isoWeekEnd),
  };
}

/**
 * Computes current ISO week number
 */
export async function getCurrentEpidemiologicalWeek(): Promise<{ year: number; week: number }> {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: d.getFullYear(), week };
}

/**
 * Fetch aggregated weekly IDSP disease surveillance report
 */
export async function getIdspSurveillanceData(year: number, weekNumber: number): Promise<IdspWeeklyReport> {
  await requireRole(['doctor'], '/reports');

  const { startDate, endDate } = getWeekDates(year, weekNumber);
  // Drizzle mode:"timestamp" stores Unix epoch in SECONDS, not milliseconds
  const startTs = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const endTs = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);

  const settings = await db.query.clinicSettings.findFirst();

  // Fetch prescriptions in week range
  const rxRows = sqlite
    .prepare(`
      SELECT
        p.id as rx_id,
        p.diagnosis,
        p.chief_complaints,
        p.created_at,
        pat.age,
        pat.gender
      FROM prescriptions p
      JOIN patients pat ON p.patient_id = pat.id
      WHERE p.created_at >= ? AND p.created_at <= ?
    `)
    .all(startTs, endTs) as {
      rx_id: number;
      diagnosis: string | null;
      chief_complaints: string | null;
      created_at: number;
      age: number;
      gender: string;
    }[];

  // Fetch IPD admissions in week range
  const ipdRows = sqlite
    .prepare(`
      SELECT
        i.id as ipd_id,
        i.admitting_diagnosis,
        i.chief_complaints,
        pat.age,
        pat.gender
      FROM ipd_admissions i
      JOIN patients pat ON i.patient_id = pat.id
      WHERE i.admission_date >= ? AND i.admission_date <= ?
    `)
    .all(startTs, endTs) as {
      ipd_id: number;
      admitting_diagnosis: string | null;
      chief_complaints: string | null;
      age: number;
      gender: string;
    }[];

  const categories: IdspDiseaseCategory[] = IDSP_SYNDROME_DEFINITIONS.map((def) => {
    let under5Male = 0;
    let under5Female = 0;
    let age5to14Male = 0;
    let age5to14Female = 0;
    let over15Male = 0;
    let over15Female = 0;
    let totalAdmissions = 0;

    const matchesKeyword = (text: string | null) => {
      if (!text) return false;
      const lower = text.toLowerCase();
      return def.keywords.some((k) => lower.includes(k));
    };

    // Process OPD Prescriptions
    for (const rx of rxRows) {
      if (matchesKeyword(rx.diagnosis) || matchesKeyword(rx.chief_complaints)) {
        const isMale = (rx.gender || '').toLowerCase() === 'male';
        const age = Number(rx.age) || 0;

        if (age < 5) {
          if (isMale) under5Male++;
          else under5Female++;
        } else if (age <= 14) {
          if (isMale) age5to14Male++;
          else age5to14Female++;
        } else {
          if (isMale) over15Male++;
          else over15Female++;
        }
      }
    }

    // Process IPD Admissions
    for (const ipd of ipdRows) {
      if (matchesKeyword(ipd.admitting_diagnosis) || matchesKeyword(ipd.chief_complaints)) {
        totalAdmissions++;
        const isMale = (ipd.gender || '').toLowerCase() === 'male';
        const age = Number(ipd.age) || 0;

        if (age < 5) {
          if (isMale) under5Male++;
          else under5Female++;
        } else if (age <= 14) {
          if (isMale) age5to14Male++;
          else age5to14Female++;
        } else {
          if (isMale) over15Male++;
          else over15Female++;
        }
      }
    }

    const totalCases = under5Male + under5Female + age5to14Male + age5to14Female + over15Male + over15Female;

    return {
      id: def.id,
      name: def.name,
      syndromeCode: def.syndromeCode,
      keywords: def.keywords,
      under5Male,
      under5Female,
      age5to14Male,
      age5to14Female,
      over15Male,
      over15Female,
      totalCases,
      totalAdmissions,
      isAlertTriggered: totalCases >= def.alertThreshold,
    };
  });

  return {
    year,
    weekNumber,
    startDate,
    endDate,
    totalOpdCases: rxRows.length,
    totalIpdCases: ipdRows.length,
    categories,
    clinic: {
      name: settings?.clinicName || 'Clinic OPD',
      doctor: settings?.doctorName || 'Dr. Physician',
      address: settings?.address || 'Clinical Facility',
      regNumber: settings?.regNumber || 'REG-PENDING',
    },
  };
}

/**
 * Generate official IDSP Form P CSV export
 */
export async function exportIdspFormPCsvAction(year: number, weekNumber: number): Promise<string> {
  const report = await getIdspSurveillanceData(year, weekNumber);

  await logAuditEvent({
    action: 'DATA_EXPORT_CONSULTATIONS',
    details: `Exported IDSP Weekly Surveillance Form P for Week ${weekNumber}, ${year}`,
    status: 'SUCCESS',
  });

  const header = [
    `"INTEGRATED DISEASE SURVEILLANCE PROGRAMME (IDSP) - FORM P (WEEKLY SYNDROMIC SURVEILLANCE)"`,
    `"Reporting Facility: ${report.clinic.name} • Dr. ${report.clinic.doctor} (Reg: ${report.clinic.regNumber})"`,
    `"Epidemiological Week: Week ${report.weekNumber} (${report.startDate} to ${report.endDate}), Year ${report.year}"`,
    `""`,
    `"S.No.","Diseases / Syndromes","Syndrome Code","< 5 Yrs (M)","< 5 Yrs (F)","5-14 Yrs (M)","5-14 Yrs (F)",">= 15 Yrs (M)",">= 15 Yrs (F)","Total Cases","Total Inpatient Admissions","Epidemic Alert Threshold Status"`,
  ];

  const rows = report.categories.map((c, idx) => {
    return [
      idx + 1,
      `"${c.name}"`,
      `"${c.syndromeCode}"`,
      c.under5Male,
      c.under5Female,
      c.age5to14Male,
      c.age5to14Female,
      c.over15Male,
      c.over15Female,
      c.totalCases,
      c.totalAdmissions,
      c.isAlertTriggered ? `"ALERT THRESHOLD EXCEEDED"` : `"Normal Baseline"`,
    ].join(',');
  });

  return [...header, ...rows].join('\n');
}
