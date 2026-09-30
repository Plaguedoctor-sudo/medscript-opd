'use server'

import { db, sqlite } from "@/db";
import { labReports, patients } from "@/db/schema";
import { eq, desc, or, like, and } from "drizzle-orm";
import { requirePermission, getCurrentUserRole, isDoctor, isLabTech } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { generateLabReportSeal } from "@/lib/military-crypto";
import { LabReportWithPatient, LabResultParameter, LabReportStatus, LabResultFlag, ClinicSettings } from "@/types";

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
  await requirePermission('lab:view', '/labs');

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
  await requirePermission('lab:view', `/labs/${id}`);

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
  await requirePermission('lab:order', '/labs');
  const role = await getCurrentUserRole();

  if (role === 'nurse') {
    return { success: false, error: "Unauthorized: Nurses are not authorized to order laboratory tests." };
  }

  if (role !== 'admin_doctor' && role !== 'doctor' && role !== 'lab_technician') {
    return { success: false, error: "Unauthorized: You do not have permission to order laboratory tests." };
  }

  if (!input.patientId || typeof input.patientId !== 'number' || input.patientId <= 0) {
    return { success: false, error: "Valid Patient ID is required." };
  }

  const cleanTestName = (input.testName || '').trim().slice(0, 150);
  if (!cleanTestName) {
    return { success: false, error: "Valid test name is required." };
  }

  const ALLOWED_STATUSES: LabReportStatus[] = ['PENDING', 'SAMPLE_COLLECTED', 'COMPLETED', 'CANCELLED'];
  const status: LabReportStatus = input.status && ALLOWED_STATUSES.includes(input.status) ? input.status : 'PENDING';

  const cleanResults = Array.isArray(input.results)
    ? input.results.slice(0, 50).map((r) => ({
        parameter: (r.parameter || '').trim().slice(0, 100),
        value: (r.value || '').trim().slice(0, 100),
        unit: (r.unit || '').trim().slice(0, 50),
        referenceRange: (r.referenceRange || '').trim().slice(0, 100),
        flag: (r.flag && ['NORMAL', 'HIGH', 'LOW', 'CRITICAL', 'ABNORMAL'].includes(r.flag)
          ? r.flag
          : 'NORMAL') as LabResultFlag,
      }))
    : [];

  try {
    const reportNo = await generateLabReportNumber();
    const settings = await db.query.clinicSettings.findFirst();
    const defaultDoctor = settings?.doctorName || "Attending Physician";

    const isCompleted = status === 'COMPLETED';
    const now = new Date();

    const [inserted] = await db
      .insert(labReports)
      .values({
        reportNo,
        patientId: input.patientId,
        prescriptionId: input.prescriptionId || null,
        ipdAdmissionId: input.ipdAdmissionId || null,
        testName: cleanTestName,
        category: (input.category?.trim() || "General").slice(0, 50),
        sampleType: (input.sampleType?.trim() || "Blood").slice(0, 50),
        sampleCollectedAt: now,
        reportedAt: isCompleted ? now : null,
        status,
        referredBy: (input.referredBy?.trim() || defaultDoctor).slice(0, 100),
        technicianName: (input.technicianName?.trim() || "Pathology Dept").slice(0, 100),
        results: JSON.stringify(cleanResults),
        interpretation: input.interpretation?.trim().slice(0, 2000) || null,
        notes: input.notes?.trim().slice(0, 1000) || null,
        createdAt: now,
      })
      .returning({ id: labReports.id });

    await logAuditEvent({
      action: isCompleted ? 'LAB_REPORT_COMPLETED' : 'LAB_REPORT_CREATED',
      actorRole: role.toUpperCase(),
      details: `Lab Report ${reportNo} (${cleanTestName}) created for Patient ID #${input.patientId}`,
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
  await requirePermission('lab:manage', '/labs');
  const role = await getCurrentUserRole();

  if (role !== 'admin_doctor' && role !== 'lab_technician') {
    return {
      success: false,
      error: "Unauthorized: Diagnostic lab reports and result parameters can only be edited by the Lab Technician or Admin Doctor.",
    };
  }

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

    // Retrieve existing report to compute cryptographic seal
    const existing = await db.query.labReports.findFirst({ where: eq(labReports.id, id) });
    if (existing) {
      const sealPayload = {
        id: existing.id,
        reportNo: existing.reportNo,
        testName: (updateValues.testName as string) ?? existing.testName,
        results: (updateValues.results as string) ?? existing.results,
        status: (updateValues.status as string) ?? existing.status,
        technicianName: (updateValues.technicianName as string) ?? existing.technicianName,
        reportedAt: (updateValues.reportedAt as Date) ?? existing.reportedAt,
      };
      updateValues.digitalSealHash = generateLabReportSeal(sealPayload);
    }

    await db.update(labReports).set(updateValues).where(eq(labReports.id, id));

    await logAuditEvent({
      action: data.status === 'COMPLETED' ? 'LAB_REPORT_COMPLETED' : 'LAB_REPORT_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Lab Report #${id} updated by ${role} (Status: ${data.status || 'UNCHANGED'})`,
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
  await requirePermission('lab:manage', '/labs');
  const role = await getCurrentUserRole();

  if (role !== 'admin_doctor') {
    return { success: false, error: "Unauthorized: Diagnostic lab reports can only be deleted by the Chief Medical Officer (Admin Doctor)." };
  }

  try {
    await db.delete(labReports).where(eq(labReports.id, id));

    await logAuditEvent({
      action: 'LAB_REPORT_DELETED',
      actorRole: role.toUpperCase(),
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
  await requirePermission('lab:view', `/labs/${id}`);
  const role = await getCurrentUserRole();
  await logAuditEvent({
    action: channel === 'PRINT' ? 'LAB_REPORT_PRINTED' : 'LAB_REPORT_DISPATCHED',
    actorRole: role.toUpperCase(),
    details: `Lab Report #${id} ${channel === 'PRINT' ? 'printed' : 'dispatched via WhatsApp'}`,
    status: 'SUCCESS',
  });
}
