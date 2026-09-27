'use server'

import { db, sqlite } from "@/db";
import { ipdAdmissions, ipdRounds, labReports, patients } from "@/db/schema";
import { eq, desc, or, like, and } from "drizzle-orm";
import { requireAuth, getCurrentUserRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  IpdAdmissionWithPatient,
  IpdRound,
  IpdDischargeCondition,
  IpdVitals,
  LabReportWithPatient,
  ClinicSettings,
} from "@/types";

export interface IpdFilterOptions {
  query?: string;
  status?: string; // 'ALL' | 'ADMITTED' | 'DISCHARGED'
  ward?: string;
  limit?: number;
}

import { STANDARD_WARDS } from "@/lib/ipd-constants";

export interface IpdSummaryStats {
  totalAdmitted: number;
  totalDischarged: number;
  totalAdmissions: number;
  occupancyRate: number;
}

/**
 * Generate sequential unique IPD Admission Number: IPD-YYYYMMDD-X
 */
export async function generateIpdAdmissionNumber(): Promise<string> {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `IPD-${yyyymmdd}`;

  try {
    const existing = sqlite
      .prepare("SELECT admission_no FROM ipd_admissions WHERE admission_no LIKE ? ORDER BY id DESC")
      .all(`${prefix}%`) as { admission_no?: string }[];

    let maxSeq = 0;
    if (Array.isArray(existing)) {
      for (const row of existing) {
        if (row.admission_no) {
          const match = row.admission_no.match(new RegExp(`^IPD-${yyyymmdd}-(\\d+)$`));
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
 * Fetch IPD Admissions list with filters
 */
export async function getIpdAdmissions(options: IpdFilterOptions = {}): Promise<{
  admissions: IpdAdmissionWithPatient[];
  stats: IpdSummaryStats;
}> {
  await requireAuth('/ipd');

  const conditions = [];

  if (options.status && options.status !== 'ALL') {
    conditions.push(eq(ipdAdmissions.status, options.status));
  }

  if (options.ward && options.ward !== 'All') {
    conditions.push(eq(ipdAdmissions.ward, options.ward));
  }

  const clean = options.query ? options.query.trim() : "";
  if (clean) {
    conditions.push(
      or(
        like(ipdAdmissions.admissionNo, `%${clean}%`),
        like(ipdAdmissions.ward, `%${clean}%`),
        like(ipdAdmissions.bedNo, `%${clean}%`),
        like(ipdAdmissions.admittingDiagnosis, `%${clean}%`),
        like(patients.name, `%${clean}%`),
        like(patients.phone, `%${clean}%`),
        like(patients.regNo, `%${clean}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: ipdAdmissions.id,
      admissionNo: ipdAdmissions.admissionNo,
      patientId: ipdAdmissions.patientId,
      admissionDate: ipdAdmissions.admissionDate,
      dischargeDate: ipdAdmissions.dischargeDate,
      status: ipdAdmissions.status,
      ward: ipdAdmissions.ward,
      bedNo: ipdAdmissions.bedNo,
      roomType: ipdAdmissions.roomType,
      attendingDoctor: ipdAdmissions.attendingDoctor,
      admittingDiagnosis: ipdAdmissions.admittingDiagnosis,
      chiefComplaints: ipdAdmissions.chiefComplaints,
      admissionVitals: ipdAdmissions.admissionVitals,
      dischargeCondition: ipdAdmissions.dischargeCondition,
      dischargeSummary: ipdAdmissions.dischargeSummary,
      dischargeAdvice: ipdAdmissions.dischargeAdvice,
      createdAt: ipdAdmissions.createdAt,
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
    .from(ipdAdmissions)
    .innerJoin(patients, eq(ipdAdmissions.patientId, patients.id))
    .where(whereClause)
    .orderBy(desc(ipdAdmissions.admissionDate))
    .limit(options.limit || 50);

  // Calculate overall metrics
  const allRows = await db
    .select({ id: ipdAdmissions.id, status: ipdAdmissions.status })
    .from(ipdAdmissions);

  const totalAdmitted = allRows.filter((r) => r.status === 'ADMITTED').length;
  const totalDischarged = allRows.filter((r) => r.status === 'DISCHARGED').length;
  const totalBeds = STANDARD_WARDS.reduce((acc, w) => acc + w.beds, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((totalAdmitted / totalBeds) * 100) : 0;

  return {
    admissions: rows as IpdAdmissionWithPatient[],
    stats: {
      totalAdmitted,
      totalDischarged,
      totalAdmissions: allRows.length,
      occupancyRate,
    },
  };
}

/**
 * Fetch single IPD Inpatient Case Sheet by ID
 */
export async function getIpdAdmissionById(id: number): Promise<{
  admission: IpdAdmissionWithPatient | null;
  rounds: IpdRound[];
  labReportsList: LabReportWithPatient[];
  settings: ClinicSettings | null;
}> {
  await requireAuth(`/ipd/${id}`);

  const row = await db
    .select({
      id: ipdAdmissions.id,
      admissionNo: ipdAdmissions.admissionNo,
      patientId: ipdAdmissions.patientId,
      admissionDate: ipdAdmissions.admissionDate,
      dischargeDate: ipdAdmissions.dischargeDate,
      status: ipdAdmissions.status,
      ward: ipdAdmissions.ward,
      bedNo: ipdAdmissions.bedNo,
      roomType: ipdAdmissions.roomType,
      attendingDoctor: ipdAdmissions.attendingDoctor,
      admittingDiagnosis: ipdAdmissions.admittingDiagnosis,
      chiefComplaints: ipdAdmissions.chiefComplaints,
      admissionVitals: ipdAdmissions.admissionVitals,
      dischargeCondition: ipdAdmissions.dischargeCondition,
      dischargeSummary: ipdAdmissions.dischargeSummary,
      dischargeAdvice: ipdAdmissions.dischargeAdvice,
      createdAt: ipdAdmissions.createdAt,
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
    .from(ipdAdmissions)
    .innerJoin(patients, eq(ipdAdmissions.patientId, patients.id))
    .where(eq(ipdAdmissions.id, id))
    .limit(1);

  if (!row || row.length === 0) {
    const settings = (await db.query.clinicSettings.findFirst()) || null;
    return { admission: null, rounds: [], labReportsList: [], settings };
  }

  // Fetch all clinical progress rounds for this admission
  const rounds = await db
    .select()
    .from(ipdRounds)
    .where(eq(ipdRounds.admissionId, id))
    .orderBy(desc(ipdRounds.roundDate));

  // Fetch all lab reports linked to this admission
  const linkedLabs = await db
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
    .where(eq(labReports.ipdAdmissionId, id))
    .orderBy(desc(labReports.createdAt));

  const settings = (await db.query.clinicSettings.findFirst()) || null;

  return {
    admission: row[0] as IpdAdmissionWithPatient,
    rounds: rounds as IpdRound[],
    labReportsList: linkedLabs as LabReportWithPatient[],
    settings,
  };
}

export interface CreateIpdAdmissionInput {
  patientId: number;
  ward: string;
  bedNo: string;
  roomType?: string;
  attendingDoctor?: string;
  admittingDiagnosis?: string;
  chiefComplaints?: string;
  admissionVitals?: IpdVitals;
}

/**
 * Admit a patient to IPD
 */
export async function createIpdAdmission(input: CreateIpdAdmissionInput): Promise<{
  success: boolean;
  admissionId?: number;
  admissionNo?: string;
  error?: string;
}> {
  await requireAuth('/ipd');
  const role = await getCurrentUserRole();

  if (!input.patientId || !input.ward?.trim() || !input.bedNo?.trim()) {
    return { success: false, error: "Patient, ward, and bed number are required." };
  }

  try {
    // Check if patient is already admitted
    const activeAdmission = await db
      .select({ id: ipdAdmissions.id, admissionNo: ipdAdmissions.admissionNo })
      .from(ipdAdmissions)
      .where(and(eq(ipdAdmissions.patientId, input.patientId), eq(ipdAdmissions.status, 'ADMITTED')))
      .limit(1);

    if (activeAdmission.length > 0) {
      return {
        success: false,
        error: `Patient is already actively admitted under IPD #${activeAdmission[0].admissionNo}. Please discharge first.`,
      };
    }

    const admissionNo = await generateIpdAdmissionNumber();
    const settings = await db.query.clinicSettings.findFirst();
    const doctorName = input.attendingDoctor?.trim() || settings?.doctorName || "Attending Physician";

    const [inserted] = await db
      .insert(ipdAdmissions)
      .values({
        admissionNo,
        patientId: input.patientId,
        admissionDate: new Date(),
        status: 'ADMITTED',
        ward: input.ward.trim(),
        bedNo: input.bedNo.trim(),
        roomType: input.roomType?.trim() || "General",
        attendingDoctor: doctorName,
        admittingDiagnosis: input.admittingDiagnosis?.trim() || null,
        chiefComplaints: input.chiefComplaints?.trim() || null,
        admissionVitals: input.admissionVitals ? JSON.stringify(input.admissionVitals) : null,
        createdAt: new Date(),
      })
      .returning({ id: ipdAdmissions.id });

    await logAuditEvent({
      action: 'IPD_ADMISSION_CREATED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `IPD Admission ${admissionNo} created for Patient ID #${input.patientId} in ${input.ward} (${input.bedNo})`,
      status: 'SUCCESS',
    });

    return {
      success: true,
      admissionId: inserted.id,
      admissionNo,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create IPD admission.";
    console.error("Failed to create IPD admission:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Discharge an admitted inpatient
 */
export async function dischargeIpdPatient(
  admissionId: number,
  data: {
    dischargeCondition?: IpdDischargeCondition;
    dischargeSummary?: string;
    dischargeAdvice?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAuth(`/ipd/${admissionId}`);
  const role = await getCurrentUserRole();

  try {
    const now = new Date();
    await db
      .update(ipdAdmissions)
      .set({
        status: 'DISCHARGED',
        dischargeDate: now,
        dischargeCondition: data.dischargeCondition || 'Stable',
        dischargeSummary: data.dischargeSummary?.trim() || null,
        dischargeAdvice: data.dischargeAdvice?.trim() || null,
      })
      .where(eq(ipdAdmissions.id, admissionId));

    await logAuditEvent({
      action: 'IPD_PATIENT_DISCHARGED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `IPD Admission #${admissionId} discharged (Condition: ${data.dischargeCondition || 'Stable'})`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to discharge patient.";
    console.error("Failed to discharge IPD patient:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Add a daily clinical round / progress note / nursing observation
 */
export async function addIpdRound(
  admissionId: number,
  data: {
    notes: string;
    treatmentOrders?: string;
    doctorOrStaff?: string;
    role?: 'DOCTOR' | 'NURSE' | 'STAFF';
    vitals?: IpdVitals;
  }
): Promise<{ success: boolean; roundId?: number; error?: string }> {
  await requireAuth(`/ipd/${admissionId}`);
  const userRole = await getCurrentUserRole();
  const settings = await db.query.clinicSettings.findFirst();

  if (!data.notes?.trim()) {
    return { success: false, error: "Progress note is required." };
  }

  try {
    const author = data.doctorOrStaff?.trim() || (userRole === 'doctor' ? settings?.doctorName || 'Dr. On Duty' : 'Staff Nurse');

    const [inserted] = await db
      .insert(ipdRounds)
      .values({
        admissionId,
        roundDate: new Date(),
        doctorOrStaff: author,
        role: data.role || (userRole === 'doctor' ? 'DOCTOR' : 'NURSE'),
        notes: data.notes.trim(),
        treatmentOrders: data.treatmentOrders?.trim() || null,
        vitals: data.vitals ? JSON.stringify(data.vitals) : null,
        createdAt: new Date(),
      })
      .returning({ id: ipdRounds.id });

    await logAuditEvent({
      action: 'IPD_ROUND_ADDED',
      actorRole: userRole === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Clinical round added to IPD Admission #${admissionId} by ${author}`,
      status: 'SUCCESS',
    });

    return { success: true, roundId: inserted.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to record round.";
    console.error("Failed to add IPD round:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Delete a clinical round note
 */
export async function deleteIpdRound(roundId: number): Promise<{ success: boolean; error?: string }> {
  await requireAuth('/ipd');
  const role = await getCurrentUserRole();

  try {
    await db.delete(ipdRounds).where(eq(ipdRounds.id, roundId));

    await logAuditEvent({
      action: 'IPD_ROUND_DELETED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Clinical round #${roundId} deleted`,
      status: 'WARNING',
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete round.";
    console.error("Failed to delete IPD round:", err);
    return { success: false, error: errorMsg };
  }
}
