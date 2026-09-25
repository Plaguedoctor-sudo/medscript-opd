import type { Medication } from "@/types";

/**
 * Escapes a single field value for RFC 4180 CSV compliance
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  // If string contains comma, quote, or newline, escape quotes by doubling them and enclose in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Triggers a direct browser download of CSV text with UTF-8 BOM
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  // UTF-8 BOM ensures Microsoft Excel and Google Sheets open Unicode and formatting correctly
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ConsultationExportItem {
  id: number;
  createdAt: Date | string | null;
  patientId: number;
  patientName: string;
  regNo?: string | null;
  age: number | string;
  gender: string;
  phone?: string | null;
  abhaId?: string | null;
  bp?: string | null;
  weight?: string | null;
  pulse?: string | null;
  temp?: string | null;
  spo2?: string | null;
  chiefComplaints?: string | null;
  clinicalHistory?: string | null;
  diagnosis?: string | null;
  medications?: string | null; // Raw JSON string
  labTests?: string | null;
  advice?: string | null;
  followUpDate?: string | null;
  doctorName?: string | null;
}

export interface PatientExportItem {
  id: number;
  regNo?: string | null;
  name: string;
  age: number;
  gender: string;
  phone?: string | null;
  abhaId?: string | null;
  createdAt: Date | string | null;
  totalVisits?: number;
  lastVisitDate?: Date | string | null;
}

export interface DiagnosisSummaryItem {
  diagnosis: string;
  count: number;
  percentage: number;
}

export interface MedicationSummaryItem {
  name: string;
  count: number;
  commonDosages: string[];
}

/**
 * Generates CSV for the OPD Consultation Register
 */
export function generateConsultationRegisterCsv(items: ConsultationExportItem[]): string {
  const headers = [
    "Prescription ID",
    "Consultation Date",
    "Consultation Time",
    "Registration No",
    "Patient Name",
    "Age",
    "Gender",
    "Phone",
    "ABHA ID",
    "Blood Pressure (mmHg)",
    "Weight (kg)",
    "Pulse (bpm)",
    "Temp (°C)",
    "SpO2 (%)",
    "Chief Complaints",
    "Clinical History",
    "Diagnosis",
    "Prescribed Medications",
    "Medication Count",
    "Lab Tests & Investigations",
    "Dietary & Lifestyle Advice",
    "Follow-up Date",
    "Consulting Doctor",
  ];

  const rows = items.map((item) => {
    let dateStr = "N/A";
    let timeStr = "N/A";
    if (item.createdAt) {
      const d = new Date(item.createdAt);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        timeStr = d.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    // Parse medications list
    let medsFormatted = "";
    let medsCount = 0;
    if (item.medications) {
      try {
        const meds = JSON.parse(item.medications);
        if (Array.isArray(meds)) {
          medsCount = meds.length;
          medsFormatted = meds
            .map(
              (m: Partial<Medication>, idx: number) =>
                `${idx + 1}. ${m.prefix ? `${m.prefix} ` : ""}${m.name || "Medicine"}${
                  m.genericName ? ` (${m.genericName})` : ""
                }${m.strength ? ` ${m.strength}` : ""} | Dose: ${m.dosage || "1-0-1"} | Timing: ${
                  m.timing || "After food"
                } | For: ${m.duration || "5 days"}${m.instruction ? ` (${m.instruction})` : ""}`
            )
            .join(" ; ");
        }
      } catch {
        medsFormatted = item.medications;
      }
    }

    return [
      escapeCsvField(item.id),
      escapeCsvField(dateStr),
      escapeCsvField(timeStr),
      escapeCsvField(item.regNo || "N/A"),
      escapeCsvField(item.patientName),
      escapeCsvField(item.age),
      escapeCsvField(item.gender),
      escapeCsvField(item.phone || ""),
      escapeCsvField(item.abhaId || ""),
      escapeCsvField(item.bp || "N/A"),
      escapeCsvField(item.weight ? `${item.weight} kg` : "N/A"),
      escapeCsvField(item.pulse ? `${item.pulse} bpm` : "N/A"),
      escapeCsvField(item.temp ? (item.temp.includes("°") ? item.temp : `${item.temp}°C`) : "N/A"),
      escapeCsvField(item.spo2 ? `${item.spo2}%` : "N/A"),
      escapeCsvField(item.chiefComplaints || ""),
      escapeCsvField(item.clinicalHistory || ""),
      escapeCsvField(item.diagnosis || "Under Evaluation"),
      escapeCsvField(medsFormatted),
      escapeCsvField(medsCount),
      escapeCsvField(item.labTests || ""),
      escapeCsvField(item.advice || ""),
      escapeCsvField(item.followUpDate || "None"),
      escapeCsvField(item.doctorName || "Treating Physician"),
    ].join(",");
  });

  return [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");
}

/**
 * Generates CSV for the Patient Master Directory
 */
export function generatePatientDirectoryCsv(patients: PatientExportItem[]): string {
  const headers = [
    "Patient ID",
    "Registration No",
    "Full Name",
    "Age",
    "Gender",
    "Contact Phone",
    "ABHA Health ID",
    "Total Consultations",
    "Registration Date",
    "Last Visit Date",
  ];

  const rows = patients.map((p) => {
    let regDateStr = "N/A";
    if (p.createdAt) {
      const d = new Date(p.createdAt);
      if (!isNaN(d.getTime())) {
        regDateStr = d.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }

    let lastVisitStr = "N/A";
    if (p.lastVisitDate) {
      const d = new Date(p.lastVisitDate);
      if (!isNaN(d.getTime())) {
        lastVisitStr = d.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }

    return [
      escapeCsvField(p.id),
      escapeCsvField(p.regNo || "N/A"),
      escapeCsvField(p.name),
      escapeCsvField(p.age),
      escapeCsvField(p.gender),
      escapeCsvField(p.phone || ""),
      escapeCsvField(p.abhaId || ""),
      escapeCsvField(p.totalVisits || 1),
      escapeCsvField(regDateStr),
      escapeCsvField(lastVisitStr),
    ].join(",");
  });

  return [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");
}

/**
 * Generates CSV for Diagnosis & Morbidity Summary
 */
export function generateDiagnosisAuditCsv(items: DiagnosisSummaryItem[]): string {
  const headers = ["Clinical Diagnosis", "Case Frequency", "Percentage Share (%)"];

  const rows = items.map((item) =>
    [
      escapeCsvField(item.diagnosis),
      escapeCsvField(item.count),
      escapeCsvField(`${item.percentage.toFixed(1)}%`),
    ].join(",")
  );

  return [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");
}

/**
 * Generates CSV for Medication Utilization Audit
 */
export function generateMedicationAuditCsv(items: MedicationSummaryItem[]): string {
  const headers = ["Prescribed Drug Name", "Prescription Count", "Common Schedules"];

  const rows = items.map((item) =>
    [
      escapeCsvField(item.name),
      escapeCsvField(item.count),
      escapeCsvField(item.commonDosages.slice(0, 3).join(" | ")),
    ].join(",")
  );

  return [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");
}
