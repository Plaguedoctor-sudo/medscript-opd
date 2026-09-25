'use server'

import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { ConsultationExportItem, PatientExportItem, DiagnosisSummaryItem, MedicationSummaryItem } from "@/lib/csv-export";

export interface ReportFilterOptions {
  range: "today" | "week" | "month" | "year" | "all" | "custom";
  startDate?: string;
  endDate?: string;
}

export interface ReportsDataResult {
  stats: {
    totalConsultationsInRange: number;
    allTimeConsultations: number;
    uniquePatientsInRange: number;
    allTimePatients: number;
    mostCommonDiagnosis: string;
    mostCommonDrug: string;
  };
  diagnoses: DiagnosisSummaryItem[];
  medications: MedicationSummaryItem[];
  demographics: {
    maleCount: number;
    femaleCount: number;
    otherCount: number;
    pediatricCount: number; // < 18
    adultCount: number; // 18 - 59
    seniorCount: number; // 60+
  };
  consultations: ConsultationExportItem[];
  patientsDirectory: PatientExportItem[];
  clinicInfo: {
    doctorName?: string | null;
    clinicName?: string | null;
  };
}

export async function getReportsData(filter: ReportFilterOptions = { range: "month" }): Promise<ReportsDataResult> {
  const now = new Date();
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (filter.range === "today") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (filter.range === "week") {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    toDate = now;
  } else if (filter.range === "month") {
    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    toDate = now;
  } else if (filter.range === "year") {
    fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    toDate = now;
  } else if (filter.range === "custom" && filter.startDate) {
    fromDate = new Date(`${filter.startDate}T00:00:00`);
    if (filter.endDate) {
      toDate = new Date(`${filter.endDate}T23:59:59`);
    } else {
      toDate = new Date();
    }
  }

  // Build where conditions
  const conditions = [];
  if (fromDate) {
    conditions.push(gte(prescriptions.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(prescriptions.createdAt, toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch consultations in range
  const rxResults = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      createdAt: prescriptions.createdAt,
      weight: prescriptions.weight,
      bp: prescriptions.bp,
      pulse: prescriptions.pulse,
      temp: prescriptions.temp,
      spo2: prescriptions.spo2,
      chiefComplaints: prescriptions.chiefComplaints,
      clinicalHistory: prescriptions.clinicalHistory,
      diagnosis: prescriptions.diagnosis,
      medications: prescriptions.medications,
      advice: prescriptions.advice,
      labTests: prescriptions.labTests,
      followUpDate: prescriptions.followUpDate,
      patientName: patients.name,
      patientRegNo: patients.regNo,
      patientAge: patients.age,
      patientGender: patients.gender,
      patientPhone: patients.phone,
      patientAbhaId: patients.abhaId,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(prescriptions.patientId, patients.id))
    .where(whereClause)
    .orderBy(desc(prescriptions.createdAt));

  // Fetch clinic settings
  const settings = await db.query.clinicSettings.findFirst();

  // Fetch all patients for directory export
  const allPatients = await db
    .select()
    .from(patients)
    .orderBy(desc(patients.createdAt));

  // All time counts
  const allTimeRxCount = (await db.select({ id: prescriptions.id }).from(prescriptions)).length;
  const allTimePatientCount = allPatients.length;

  // Format consultation export items
  const consultations: ConsultationExportItem[] = rxResults.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    createdAt: r.createdAt,
    patientName: r.patientName,
    regNo: r.patientRegNo,
    age: r.patientAge,
    gender: r.patientGender,
    phone: r.patientPhone,
    abhaId: r.patientAbhaId,
    bp: r.bp,
    weight: r.weight,
    pulse: r.pulse,
    temp: r.temp,
    spo2: r.spo2,
    chiefComplaints: r.chiefComplaints,
    clinicalHistory: r.clinicalHistory,
    diagnosis: r.diagnosis,
    medications: r.medications,
    advice: r.advice,
    labTests: r.labTests,
    followUpDate: r.followUpDate,
    doctorName: settings?.doctorName,
  }));

  // Calculate unique patients in range
  const uniquePatientIds = new Set(rxResults.map((r) => r.patientId));

  // Compute Diagnoses Distribution
  const diagnosisMap = new Map<string, number>();
  for (const r of rxResults) {
    const diag = (r.diagnosis || "Under Evaluation").trim();
    // Split multiple diagnoses if separated by comma or semicolon
    const parts = diag.split(/[,;&]/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (parts.length === 0) {
      diagnosisMap.set(diag, (diagnosisMap.get(diag) || 0) + 1);
    } else {
      for (const p of parts) {
        diagnosisMap.set(p, (diagnosisMap.get(p) || 0) + 1);
      }
    }
  }

  const totalDiagnosisEntries = Array.from(diagnosisMap.values()).reduce((a, b) => a + b, 0);
  const diagnoses: DiagnosisSummaryItem[] = Array.from(diagnosisMap.entries())
    .map(([diag, count]) => ({
      diagnosis: diag,
      count,
      percentage: totalDiagnosisEntries > 0 ? (count / totalDiagnosisEntries) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Compute Top Prescribed Medications
  const medicationMap = new Map<string, { count: number; dosages: Set<string> }>();
  for (const r of rxResults) {
    if (!r.medications) continue;
    try {
      const parsed = JSON.parse(r.medications);
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if (!m.name) continue;
          const cleanName = m.name.trim();
          const entry = medicationMap.get(cleanName) || { count: 0, dosages: new Set<string>() };
          entry.count += 1;
          if (m.dosage) entry.dosages.add(m.dosage);
          medicationMap.set(cleanName, entry);
        }
      }
    } catch {
      // ignore
    }
  }

  const medications: MedicationSummaryItem[] = Array.from(medicationMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      commonDosages: Array.from(data.dosages),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Compute Demographics
  let maleCount = 0;
  let femaleCount = 0;
  let otherCount = 0;
  let pediatricCount = 0;
  let adultCount = 0;
  let seniorCount = 0;

  for (const r of rxResults) {
    const g = (r.patientGender || "").toLowerCase();
    if (g.startsWith("m")) maleCount++;
    else if (g.startsWith("f")) femaleCount++;
    else otherCount++;

    const age = Number(r.patientAge) || 0;
    if (age < 18) pediatricCount++;
    else if (age < 60) adultCount++;
    else seniorCount++;
  }

  // Build Patient Directory with visit stats
  // Group all prescriptions by patient
  const allRx = await db.select({ patientId: prescriptions.patientId, createdAt: prescriptions.createdAt }).from(prescriptions);
  const patientVisitStats = new Map<number, { count: number; lastVisit: Date | null }>();
  for (const rx of allRx) {
    const stat = patientVisitStats.get(rx.patientId) || { count: 0, lastVisit: null };
    stat.count++;
    if (rx.createdAt && (!stat.lastVisit || new Date(rx.createdAt) > new Date(stat.lastVisit))) {
      stat.lastVisit = rx.createdAt;
    }
    patientVisitStats.set(rx.patientId, stat);
  }

  const patientsDirectory: PatientExportItem[] = allPatients.map((p) => {
    const stat = patientVisitStats.get(p.id) || { count: 0, lastVisit: null };
    return {
      id: p.id,
      regNo: p.regNo,
      name: p.name,
      age: p.age,
      gender: p.gender,
      phone: p.phone,
      abhaId: p.abhaId,
      createdAt: p.createdAt,
      totalVisits: stat.count,
      lastVisitDate: stat.lastVisit,
    };
  });

  return {
    stats: {
      totalConsultationsInRange: rxResults.length,
      allTimeConsultations: allTimeRxCount,
      uniquePatientsInRange: uniquePatientIds.size,
      allTimePatients: allTimePatientCount,
      mostCommonDiagnosis: diagnoses[0]?.diagnosis || "None recorded",
      mostCommonDrug: medications[0]?.name || "None recorded",
    },
    diagnoses,
    medications,
    demographics: {
      maleCount,
      femaleCount,
      otherCount,
      pediatricCount,
      adultCount,
      seniorCount,
    },
    consultations,
    patientsDirectory,
    clinicInfo: {
      doctorName: settings?.doctorName,
      clinicName: settings?.clinicName,
    },
  };
}
