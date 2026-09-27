'use server'

import { db, sqlite } from "@/db";
import { labReports, patients } from "@/db/schema";
import { eq, desc, or, like, and } from "drizzle-orm";
import { requireAuth, getCurrentUserRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { LabReportWithPatient, LabResultParameter, LabReportStatus, ClinicSettings } from "@/types";

export interface LabFilterOptions {
  query?: string;
  status?: string;
  category?: string;
  patientId?: number;
  limit?: number;
}

export interface LabSummaryStats {
  totalReports: number;
  pendingCount: number;
  completedCount: number;
  abnormalCount: number;
}

/**
 * Generate sequential unique Lab Report Number: LAB-YYYYMMDD-X
 */
export async function generateLabReportNumber(): Promise<string> {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `LAB-${yyyymmdd}`;

  try {
    const existing = sqlite
      .prepare("SELECT report_no FROM lab_reports WHERE report_no LIKE ? ORDER BY id DESC")
      .all(`${prefix}%`) as { report_no?: string }[];

    let maxSeq = 0;
    if (Array.isArray(existing)) {
      for (const row of existing) {
        if (row.report_no) {
          const match = row.report_no.match(new RegExp(`^LAB-${yyyymmdd}-(\\d+)$`));
          if (match) {
            const seq = parseInt(match[1], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
      }
    }
    return `${prefix}-${String(maxSeq + 1).padStart(2, '0')}`;
  } catch {
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Fetch Lab Reports with optional query and filters
 */
export async function getLabReports(options: LabFilterOptions = {}): Promise<{
  reports: LabReportWithPatient[];
  stats: LabSummaryStats;
}> {
  await requireAuth('/labs');

  const conditions = [];

  if (options.patientId) {
    conditions.push(eq(labReports.patientId, options.patientId));
  }

  if (options.status && options.status !== 'ALL') {
    conditions.push(eq(labReports.status, options.status));
  }

  if (options.category && options.category !== 'All') {
    conditions.push(eq(labReports.category, options.category));
  }

  const cleanQuery = options.query ? options.query.trim() : "";
  if (cleanQuery) {
    conditions.push(
      or(
        like(labReports.reportNo, `%${cleanQuery}%`),
        like(labReports.testName, `%${cleanQuery}%`),
        like(patients.name, `%${cleanQuery}%`),
        like(patients.phone, `%${cleanQuery}%`),
        like(patients.regNo, `%${cleanQuery}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: labReports.id,
      reportNo: labReports.reportNo,
      patientId: labReports.patientId,
      prescriptionId: labReports.prescriptionId,
      ipdAdmissionId: labReports.ipdAdmissionId,
      testName: labReports.testName,
      category: labReports.category,
      sampleType: labReports.sampleType,
      sampleCollectedAt: labReports.sampleCollectedAt,
      reportedAt: labReports.reportedAt,
      status: labReports.status,
      referredBy: labReports.referredBy,
      technicianName: labReports.technicianName,
      results: labReports.results,
      interpretation: labReports.interpretation,
      notes: labReports.notes,
      createdAt: labReports.createdAt,
      patient: {
        id: patients.id,
        name: patients.name,
        age: patients.age,
        gender: patients.gender,
        phone: patients.phone,
        regNo: patients.regNo,
        abhaId: patients.abhaId,
        createdAt: patients.createdAt,
      },
    })
    .from(labReports)
    .innerJoin(patients, eq(labReports.patientId, patients.id))
    .where(whereClause)
    .orderBy(desc(labReports.createdAt))
    .limit(options.limit || 50);

  // Compute stats across all lab reports
  const allReports = await db.select({
    id: labReports.id,
    status: labReports.status,
    results: labReports.results,
  }).from(labReports);

  let pendingCount = 0;
  let completedCount = 0;
  let abnormalCount = 0;

  for (const r of allReports) {
    if (r.status === 'PENDING' || r.status === 'SAMPLE_COLLECTED') pendingCount++;
    if (r.status === 'COMPLETED') completedCount++;
    try {
      const parsed: LabResultParameter[] = JSON.parse(r.results || '[]');
      if (parsed.some((p) => p.flag === 'HIGH' || p.flag === 'LOW' || p.flag === 'CRITICAL' || p.flag === 'ABNORMAL')) {
        abnormalCount++;
      }
    } catch {
      // ignore
    }
  }

  return {
    reports: rows as LabReportWithPatient[],
    stats: {
      totalReports: allReports.length,
      pendingCount,
      completedCount,
      abnormalCount,
    },
  };
}

/**
 * Fetch a single lab report by ID with patient and clinic details
 */
export async function getLabReportById(id: number): Promise<{
  report: LabReportWithPatient | null;
  settings: ClinicSettings | null;
}> {
  await requireAuth(`/labs/${id}`);

  const row = await db
    .select({
      id: labReports.id,
      reportNo: labReports.reportNo,
      patientId: labReports.patientId,
      prescriptionId: labReports.prescriptionId,
      ipdAdmissionId: labReports.ipdAdmissionId,
      testName: labReports.testName,
      category: labReports.category,
      sampleType: labReports.sampleType,
      sampleCollectedAt: labReports.sampleCollectedAt,
      reportedAt: labReports.reportedAt,
      status: labReports.status,
      referredBy: labReports.referredBy,
      technicianName: labReports.technicianName,
      results: labReports.results,
      interpretation: labReports.interpretation,
      notes: labReports.notes,
      createdAt: labReports.createdAt,
      patient: {
        id: patients.id,
        name: patients.name,
        age: patients.age,
        gender: patients.gender,
        phone: patients.phone,
        regNo: patients.regNo,
        abhaId: patients.abhaId,
        createdAt: patients.createdAt,
      },
    })
    .from(labReports)
    .innerJoin(patients, eq(labReports.patientId, patients.id))
    .where(eq(labReports.id, id))
    .limit(1);

  const settings = (await db.query.clinicSettings.findFirst()) || null;

  if (!row || row.length === 0) {
    return { report: null, settings };
  }

  return {
    report: row[0] as LabReportWithPatient,
    settings,
  };
}

export interface CreateLabReportInput {
  patientId: number;
  prescriptionId?: number | null;
  ipdAdmissionId?: number | null;
  testName: string;
  category?: string;
  sampleType?: string;
  referredBy?: string;
  technicianName?: string;
  results: LabResultParameter[];
  interpretation?: string;
  notes?: string;
  status?: LabReportStatus;
}

/**
 * Create a new Lab Report / Investigation order
 */
export async function createLabReport(input: CreateLabReportInput): Promise<{
  success: boolean;
  reportId?: number;
  reportNo?: string;
  error?: string;
}> {
  await requireAuth('/labs');
  const role = await getCurrentUserRole();

  if (!input.patientId || !input.testName?.trim()) {
    return { success: false, error: "Patient and test name are required." };
  }

  try {
    const reportNo = await generateLabReportNumber();
    const settings = await db.query.clinicSettings.findFirst();
    const defaultDoctor = settings?.doctorName || "Attending Physician";

    const isCompleted = input.status === 'COMPLETED';
    const now = new Date();

    const [inserted] = await db
      .insert(labReports)
      .values({
        reportNo,
        patientId: input.patientId,
        prescriptionId: input.prescriptionId || null,
        ipdAdmissionId: input.ipdAdmissionId || null,
        testName: input.testName.trim(),
        category: input.category?.trim() || "General",
        sampleType: input.sampleType?.trim() || "Blood",
        sampleCollectedAt: now,
        reportedAt: isCompleted ? now : null,
        status: input.status || "PENDING",
        referredBy: input.referredBy?.trim() || defaultDoctor,
        technicianName: input.technicianName?.trim() || "Pathology Dept",
        results: JSON.stringify(input.results || []),
        interpretation: input.interpretation?.trim() || null,
        notes: input.notes?.trim() || null,
        createdAt: now,
      })
      .returning({ id: labReports.id });

    await logAuditEvent({
      action: isCompleted ? 'LAB_REPORT_COMPLETED' : 'LAB_REPORT_CREATED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Lab Report ${reportNo} (${input.testName}) created for Patient ID #${input.patientId}`,
      status: 'SUCCESS',
    });

    return {
      success: true,
      reportId: inserted.id,
      reportNo,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create lab report";
    console.error("Failed to create lab report:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Update an existing Lab Report (results, status, interpretation)
 */
export async function updateLabReport(
  id: number,
  data: Partial<CreateLabReportInput>
): Promise<{ success: boolean; error?: string }> {
  await requireAuth('/labs');
  const role = await getCurrentUserRole();

  try {
    const updateValues: Record<string, unknown> = {};

    if (data.testName !== undefined) updateValues.testName = data.testName.trim();
    if (data.category !== undefined) updateValues.category = data.category.trim();
    if (data.sampleType !== undefined) updateValues.sampleType = data.sampleType.trim();
    if (data.referredBy !== undefined) updateValues.referredBy = data.referredBy.trim();
    if (data.technicianName !== undefined) updateValues.technicianName = data.technicianName.trim();
    if (data.interpretation !== undefined) updateValues.interpretation = data.interpretation?.trim() || null;
    if (data.notes !== undefined) updateValues.notes = data.notes?.trim() || null;
    if (data.results !== undefined) updateValues.results = JSON.stringify(data.results);
    if (data.status !== undefined) {
      updateValues.status = data.status;
      if (data.status === 'COMPLETED') {
        updateValues.reportedAt = new Date();
      }
    }

    await db.update(labReports).set(updateValues).where(eq(labReports.id, id));

    await logAuditEvent({
      action: data.status === 'COMPLETED' ? 'LAB_REPORT_COMPLETED' : 'LAB_REPORT_UPDATED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Lab Report #${id} updated (Status: ${data.status || 'UNCHANGED'})`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update lab report";
    console.error("Failed to update lab report:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Delete a Lab Report
 */
export async function deleteLabReport(id: number): Promise<{ success: boolean; error?: string }> {
  await requireAuth('/labs');
  const role = await getCurrentUserRole();

  try {
    await db.delete(labReports).where(eq(labReports.id, id));

    await logAuditEvent({
      action: 'LAB_REPORT_DELETED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Lab Report #${id} deleted`,
      status: 'WARNING',
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete lab report";
    console.error("Failed to delete lab report:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Log print or dispatch of lab report
 */
export async function logLabReportAction(id: number, channel: 'PRINT' | 'WHATSAPP'): Promise<void> {
  await requireAuth(`/labs/${id}`);
  const role = await getCurrentUserRole();
  await logAuditEvent({
    action: channel === 'PRINT' ? 'LAB_REPORT_PRINTED' : 'LAB_REPORT_DISPATCHED',
    actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
    details: `Lab Report #${id} ${channel === 'PRINT' ? 'printed' : 'dispatched via WhatsApp'}`,
    status: 'SUCCESS',
  });
}
