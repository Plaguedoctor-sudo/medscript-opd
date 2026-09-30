'use server'

import { db, sqlite } from "@/db";
import {
  ipdAdmissions,
  ipdRounds,
  labReports,
  patients,
  emarRecords,
  clinicalConsents,
  ipdDeposits,
  ipdFluidBalance,
  ipdHandovers,
  ipdClinicalServices,
} from "@/db/schema";
import { eq, desc, or, like, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission, getCurrentUserRole, getCurrentUser, isDoctor, isNurse } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { generateConsentDigitalSeal } from "@/lib/consent-security";
import { generateEmarDoseSeal, generateHandoverSeal } from "@/lib/military-crypto";
import { sanitizeClinicalText } from "@/lib/phi-sanitizer";
import { getClientIp } from "@/lib/rate-limiter";
import {
  IpdAdmissionWithPatient,
  IpdRound,
  IpdDischargeCondition,
  IpdVitals,
  LabReportWithPatient,
  ClinicSettings,
  EmarRecord,
  EmarStatus,
  ClinicalConsent,
  ConsentType,
  IpdDeposit,
  FluidBalanceRecord,
  FluidEntryType,
  FluidRoute,
  FluidShift,
  IpdHandover,
  IpdHandoverType,
  IpdClinicalService,
  ClinicalServiceType,
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
  await requirePermission('ipd:view', '/ipd');

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
  emarRecordsList: EmarRecord[];
  consentsList: ClinicalConsent[];
  depositsList: IpdDeposit[];
  fluidBalanceList: FluidBalanceRecord[];
  handoversList: IpdHandover[];
  clinicalServicesList: IpdClinicalService[];
  settings: ClinicSettings | null;
}> {
  await requirePermission('ipd:view', `/ipd/${id}`);

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
        abhaAddress: patients.abhaAddress,
        allergies: patients.allergies,
        bloodGroup: patients.bloodGroup,
        createdAt: patients.createdAt,
      },
    })
    .from(ipdAdmissions)
    .innerJoin(patients, eq(ipdAdmissions.patientId, patients.id))
    .where(eq(ipdAdmissions.id, id))
    .limit(1);

  if (!row || row.length === 0) {
    const settings = (await db.query.clinicSettings.findFirst()) || null;
    return {
      admission: null,
      rounds: [],
      labReportsList: [],
      emarRecordsList: [],
      consentsList: [],
      depositsList: [],
      fluidBalanceList: [],
      handoversList: [],
      clinicalServicesList: [],
      settings,
    };
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

  // Fetch eMAR records for this admission
  const emarRecordsList = (await db
    .select()
    .from(emarRecords)
    .where(eq(emarRecords.admissionId, id))
    .orderBy(emarRecords.scheduledTime)) as EmarRecord[];

  // Fetch clinical consent forms
  const consentsList = (await db
    .select()
    .from(clinicalConsents)
    .where(eq(clinicalConsents.admissionId, id))
    .orderBy(desc(clinicalConsents.id))) as ClinicalConsent[];

  // Fetch advance deposits
  const depositsList = (await db
    .select()
    .from(ipdDeposits)
    .where(eq(ipdDeposits.admissionId, id))
    .orderBy(desc(ipdDeposits.id))) as IpdDeposit[];

  // Fetch fluid balance (Input/Output) records
  const fluidBalanceList = await getFluidBalanceRecordsAction(id);

  // Fetch shift & round handovers
  const handoversList = (await db
    .select()
    .from(ipdHandovers)
    .where(eq(ipdHandovers.admissionId, id))
    .orderBy(desc(ipdHandovers.handoverDate), desc(ipdHandovers.id))) as IpdHandover[];

  // Fetch clinical procedures & nursing services (oxygen, suction, drainage, etc.)
  const clinicalServicesList = (await db
    .select()
    .from(ipdClinicalServices)
    .where(eq(ipdClinicalServices.admissionId, id))
    .orderBy(desc(ipdClinicalServices.performedAt), desc(ipdClinicalServices.id))) as IpdClinicalService[];

  const settings = (await db.query.clinicSettings.findFirst()) || null;

  return {
    admission: row[0] as IpdAdmissionWithPatient,
    rounds: rounds as IpdRound[],
    labReportsList: linkedLabs as LabReportWithPatient[],
    emarRecordsList,
    consentsList,
    depositsList,
    fluidBalanceList,
    handoversList,
    clinicalServicesList,
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
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();

  if (!input.patientId || typeof input.patientId !== 'number' || input.patientId <= 0) {
    return { success: false, error: "Valid Patient ID is required." };
  }

  const cleanWard = (input.ward || '').trim().slice(0, 50);
  const cleanBedNo = (input.bedNo || '').trim().slice(0, 30);

  if (!cleanWard || !cleanBedNo) {
    return { success: false, error: "Ward and bed number are required." };
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
    const doctorName = (input.attendingDoctor?.trim() || settings?.doctorName || "Attending Physician").slice(0, 100);

    const [inserted] = await db
      .insert(ipdAdmissions)
      .values({
        admissionNo,
        patientId: input.patientId,
        admissionDate: new Date(),
        status: 'ADMITTED',
        ward: cleanWard,
        bedNo: cleanBedNo,
        roomType: (input.roomType?.trim() || "General").slice(0, 50),
        attendingDoctor: doctorName,
        admittingDiagnosis: input.admittingDiagnosis?.trim().slice(0, 500) || null,
        chiefComplaints: input.chiefComplaints?.trim().slice(0, 1000) || null,
        admissionVitals: input.admissionVitals ? JSON.stringify(input.admissionVitals) : null,
        createdAt: new Date(),
      })
      .returning({ id: ipdAdmissions.id });

    await logAuditEvent({
      action: 'IPD_ADMISSION_CREATED',
      actorRole: role.toUpperCase(),
      details: `IPD Admission ${admissionNo} created for Patient ID #${input.patientId} in ${cleanWard} (${cleanBedNo})`,
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
  await requirePermission('ipd:view', `/ipd/${admissionId}`);
  const role = await getCurrentUserRole();

  if (!isDoctor(role)) {
    return { success: false, error: "Unauthorized: Only an attending doctor or CMO can authorize inpatient discharge." };
  }

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
      actorRole: role.toUpperCase(),
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
    roundDate?: Date | string;
    notes: string;
    treatmentOrders?: string;
    doctorOrStaff?: string;
    role?: 'DOCTOR' | 'NURSE' | 'STAFF';
    vitals?: IpdVitals;
  }
): Promise<{ success: boolean; roundId?: number; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${admissionId}`);
  const userRole = await getCurrentUserRole();
  const settings = await db.query.clinicSettings.findFirst();

  if (!data.notes?.trim()) {
    return { success: false, error: "Progress note is required." };
  }

  try {
    const author = data.doctorOrStaff?.trim() || ((userRole === 'admin_doctor' || userRole === 'doctor') ? settings?.doctorName || 'Dr. On Duty' : 'Staff Nurse');

    const [inserted] = await db
      .insert(ipdRounds)
      .values({
        admissionId,
        roundDate: data.roundDate ? new Date(data.roundDate) : new Date(),
        doctorOrStaff: author,
        role: data.role || ((userRole === 'admin_doctor' || userRole === 'doctor') ? 'DOCTOR' : 'NURSE'),
        notes: data.notes.trim(),
        treatmentOrders: data.treatmentOrders?.trim() || null,
        vitals: data.vitals ? JSON.stringify(data.vitals) : null,
        createdAt: new Date(),
      })
      .returning({ id: ipdRounds.id });

    await logAuditEvent({
      action: 'IPD_ROUND_ADDED',
      actorRole: userRole.toUpperCase(),
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
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();

  if (role !== 'admin_doctor' && role !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only physicians can delete clinical rounds.' };
  }

  try {
    await db.delete(ipdRounds).where(eq(ipdRounds.id, roundId));

    await logAuditEvent({
      action: 'IPD_ROUND_DELETED',
      actorRole: role.toUpperCase(),
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

// ==========================================
// Nurse eMAR (Medication Administration) Actions
// ==========================================

export async function addEmarRecordAction(data: {
  admissionId: number;
  medicationName: string;
  dosage: string;
  route?: string;
  scheduledTime: number;
  prescribedBy?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();
  const settings = await db.query.clinicSettings.findFirst();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Only nursing or medical staff can schedule medication on eMAR.' };
  }

  try {
    const doctorAuthor =
      data.prescribedBy?.trim() ||
      (isDoctor(role) ? user?.name || settings?.doctorName || 'Attending Physician' : settings?.doctorName || 'Attending Physician');

    const res = sqlite
      .prepare(`
        INSERT INTO emar_records (
          admission_id, medication_name, dosage, route, scheduled_time,
          status, nurse_name, prescribed_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', NULL, ?, ?, ?)
      `)
      .run(
        data.admissionId,
        data.medicationName.trim(),
        data.dosage.trim(),
        data.route || 'Oral',
        data.scheduledTime,
        doctorAuthor,
        data.notes?.trim() || null,
        Date.now()
      );

    await logAuditEvent({
      action: 'EMAR_DOSE_SCHEDULED',
      actorRole: role.toUpperCase(),
      details: `Scheduled ${data.medicationName} (${data.dosage}) for Admission #${data.admissionId} (Prescribed by Dr. ${doctorAuthor}) by ${user?.name || role}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function updateEmarDoseStatusAction(
  id: number,
  status: EmarStatus,
  admissionId: number,
  notes?: string,
  nurseName?: string
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Only nursing or medical staff can record medication administration.' };
  }

  try {
    const now = Date.now();
    const effectiveNurseName = nurseName?.trim() || user?.name || (role === 'nurse' ? 'Staff Nurse' : 'Attending Staff');

    sqlite
      .prepare(`
        UPDATE emar_records
        SET
          status = ?,
          administered_at = ?,
          nurse_name = ?,
          notes = CASE WHEN ? IS NOT NULL AND length(?) > 0 THEN ? ELSE notes END
        WHERE id = ?
      `)
      .run(
        status,
        status === 'GIVEN' ? now : null,
        effectiveNurseName,
        notes?.trim() || null,
        notes?.trim() || null,
        notes?.trim() || null,
        id
      );

    // Military Cryptographic Sealing of Bedside Dose Administration
    const updatedDose = sqlite
      .prepare('SELECT id, admission_id, medication_name, dosage, status, nurse_name, prescribed_by, scheduled_time, administered_at FROM emar_records WHERE id = ?')
      .get(id) as {
        id: number;
        admission_id: number;
        medication_name: string;
        dosage: string;
        status: string;
        nurse_name: string | null;
        prescribed_by: string | null;
        scheduled_time: number;
        administered_at: number | null;
      } | undefined;

    if (updatedDose) {
      const seal = generateEmarDoseSeal({
        id: updatedDose.id,
        admissionId: updatedDose.admission_id,
        medicationName: updatedDose.medication_name,
        dosage: updatedDose.dosage,
        status: updatedDose.status,
        nurseName: updatedDose.nurse_name,
        prescribedBy: updatedDose.prescribed_by,
        scheduledTime: updatedDose.scheduled_time,
        administeredAt: updatedDose.administered_at,
      });
      sqlite.prepare('UPDATE emar_records SET digital_seal_hash = ? WHERE id = ?').run(seal, id);
    }

    await logAuditEvent({
      action: 'EMAR_DOSE_ADMINISTERED',
      actorRole: role.toUpperCase(),
      details: `Marked eMAR dose #${id} as ${status} by Nurse ${effectiveNurseName}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${admissionId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function deleteEmarRecordAction(
  id: number,
  admissionId: number
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized to cancel eMAR orders.' };
  }

  try {
    sqlite.prepare('DELETE FROM emar_records WHERE id = ?').run(id);

    await logAuditEvent({
      action: 'EMAR_DOSE_DELETED',
      actorRole: role.toUpperCase(),
      details: `Removed scheduled eMAR dose #${id}`,
      status: 'WARNING',
    });

    revalidatePath(`/ipd/${admissionId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ==========================================
// Clinical Consent Forms & Touch Signature Pad
// ==========================================

export async function createClinicalConsentAction(data: {
  patientId: number;
  admissionId?: number;
  consentType: ConsentType;
  title: string;
  content: string;
  patientSignature?: string;
  signedByName: string;
  relationship: string;
  witnessName?: string;
  doctorSignature?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  try {
    const now = Date.now();
    const clientIp = await getClientIp();
    const cleanTitle = sanitizeClinicalText(data.title);
    const cleanContent = sanitizeClinicalText(data.content);
    const cleanSignedByName = data.signedByName.trim();
    const cleanRelationship = (data.relationship || 'Self').trim();
    const cleanWitnessName = data.witnessName ? data.witnessName.trim() : null;
    const doctorName = user?.name || 'Authorized Doctor';

    // Compute cryptographic digital seal for non-repudiation and tamper prevention (IT Act § 3A & HIPAA)
    const seal = generateConsentDigitalSeal({
      patientId: data.patientId,
      admissionId: data.admissionId,
      consentType: data.consentType,
      title: cleanTitle,
      content: cleanContent,
      signedByName: cleanSignedByName,
      relationship: cleanRelationship,
      witnessName: cleanWitnessName,
      patientSignature: data.patientSignature,
      signedAt: now,
      signerDoctor: doctorName,
    });

    const docSig = `DIGITALLY_SEALED::${seal}::${doctorName}`;

    const res = sqlite
      .prepare(`
        INSERT INTO clinical_consents (
          patient_id, admission_id, consent_type, title, content,
          patient_signature, signed_by_name, relationship, witness_name,
          doctor_signature, signed_at, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.patientId,
        data.admissionId || null,
        data.consentType,
        cleanTitle,
        cleanContent,
        data.patientSignature || null,
        cleanSignedByName,
        cleanRelationship,
        cleanWitnessName,
        docSig,
        now,
        clientIp,
        now
      );

    await logAuditEvent({
      action: 'CLINICAL_CONSENT_SIGNED',
      actorRole: role.toUpperCase(),
      details: `Consent "${cleanTitle}" cryptographically sealed for Patient ID ${data.patientId} by ${cleanSignedByName} (${cleanRelationship})`,
      status: 'SUCCESS',
      ipAddress: clientIp,
    });

    if (data.admissionId) {
      revalidatePath(`/ipd/${data.admissionId}`);
    }
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ==========================================
// Inpatient Advance Deposits & Ledger
// ==========================================

export async function addIpdDepositAction(data: {
  admissionId: number;
  patientId: number;
  amount: number;
  paymentMethod: string;
  transactionRef?: string;
  type: 'ADVANCE' | 'TOP_UP' | 'REFUND';
  notes?: string;
}): Promise<{ success: boolean; receiptNo?: string; error?: string }> {
  await requirePermission('ipd:view', '/ipd');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  try {
    const now = Date.now();
    const d = new Date();
    const datePrefix = `DEP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const seq = Math.floor(1000 + Math.random() * 9000);
    const receiptNo = `${datePrefix}-${seq}`;

    sqlite
      .prepare(`
        INSERT INTO ipd_deposits (
          admission_id, patient_id, receipt_no, amount, payment_method,
          transaction_ref, type, notes, collected_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.admissionId,
        data.patientId,
        receiptNo,
        Math.abs(data.amount),
        data.paymentMethod || 'Cash',
        data.transactionRef?.trim() || null,
        data.type || 'ADVANCE',
        data.notes?.trim() || null,
        user?.name || role,
        now
      );

    await logAuditEvent({
      action: 'IPD_DEPOSIT_COLLECTED',
      actorRole: role.toUpperCase(),
      details: `Collected ${data.type} of ₹${data.amount} via ${data.paymentMethod} (Receipt: ${receiptNo}) for Admission #${data.admissionId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    return { success: true, receiptNo };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Inpatient Nurse Fluid Balance & Input/Output Chart Entry
 * Records intake (oral, IV fluids, blood, RT feeds) or output (urine, vomitus, drain, stool)
 * Records exact date, time, volume, route, shift, and nurse credentials.
 */
export async function addFluidBalanceAction(data: {
  admissionId: number;
  entryType: FluidEntryType;
  route: FluidRoute | string;
  fluidName: string;
  volumeMl: number;
  shift?: FluidShift | string;
  recordedAt?: string | Date;
  nurseName?: string;
  appearance?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${data.admissionId}`);
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isNurse(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Nursing or Clinical credentials required.' };
  }

  if (!data.fluidName?.trim() || !data.volumeMl || data.volumeMl <= 0) {
    return { success: false, error: 'Fluid name and positive volume in mL are required.' };
  }

  try {
    const now = Date.now();
    const recordedTimestamp = data.recordedAt ? new Date(data.recordedAt).getTime() : now;
    const authorName = data.nurseName?.trim() || user?.name || (role === 'nurse' ? 'Staff Nurse' : 'Attending Doctor');

    const result = sqlite
      .prepare(`
        INSERT INTO ipd_fluid_balance (
          admission_id, entry_type, route, fluid_name, volume_ml,
          shift, recorded_at, nurse_name, role, appearance, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.admissionId,
        data.entryType,
        data.route,
        data.fluidName.trim(),
        Math.abs(data.volumeMl),
        data.shift || 'MORNING',
        recordedTimestamp,
        authorName,
        role.toUpperCase(),
        data.appearance?.trim() || null,
        data.notes?.trim() || null,
        now
      );

    await logAuditEvent({
      action: 'IPD_FLUID_BALANCE_RECORDED',
      actorRole: role.toUpperCase(),
      details: `${data.entryType} of ${data.volumeMl}mL (${data.fluidName}) via ${data.route} recorded for Admission #${data.admissionId} by ${authorName}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    return { success: true, id: Number(result.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function deleteFluidBalanceAction(
  id: number,
  admissionId: number
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${admissionId}`);
  const role = await getCurrentUserRole();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Clinical staff authority required.' };
  }

  try {
    sqlite.prepare('DELETE FROM ipd_fluid_balance WHERE id = ? AND admission_id = ?').run(id, admissionId);

    await logAuditEvent({
      action: 'IPD_FLUID_BALANCE_DELETED',
      actorRole: role.toUpperCase(),
      details: `Fluid balance record #${id} deleted from Admission #${admissionId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${admissionId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function getFluidBalanceRecordsAction(admissionId: number): Promise<FluidBalanceRecord[]> {
  try {
    const rows = sqlite
      .prepare('SELECT * FROM ipd_fluid_balance WHERE admission_id = ? ORDER BY recorded_at DESC, id DESC')
      .all(admissionId) as Array<{
        id: number;
        admission_id: number;
        entry_type: FluidEntryType;
        route: string;
        fluid_name: string;
        volume_ml: number;
        shift: string;
        recorded_at: number;
        nurse_name: string;
        role: string | null;
        appearance: string | null;
        notes: string | null;
        created_at: number | null;
      }>;

    return rows.map((r) => ({
      id: r.id,
      admissionId: r.admission_id,
      entryType: r.entry_type,
      route: r.route,
      fluidName: r.fluid_name,
      volumeMl: r.volume_ml,
      shift: r.shift,
      recordedAt: new Date(r.recorded_at),
      nurseName: r.nurse_name,
      role: r.role,
      appearance: r.appearance,
      notes: r.notes,
      createdAt: r.created_at ? new Date(r.created_at) : null,
    }));
  } catch {
    return [];
  }
}

// ==========================================
// Inpatient Shift & Round Handover Actions
// ==========================================

export async function addIpdHandoverAction(data: {
  admissionId: number;
  patientId: number;
  handoverType: IpdHandoverType;
  shift: string;
  handoverDate?: string | Date;
  outgoingStaffName: string;
  outgoingStaffRole: 'DOCTOR' | 'NURSE';
  incomingStaffName: string;
  patientCondition: string;
  vitalsSummary?: string;
  summaryNotes: string;
  activeTreatmentOrders?: string;
  pendingTasks?: string;
  specialPrecautions?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${data.admissionId}`);
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (data.handoverType === 'DOCTOR_ROUND' && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Only an attending physician can record a Doctor Round Handover.' };
  }

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Clinical or Nursing credentials required.' };
  }

  if (!data.summaryNotes?.trim()) {
    return { success: false, error: 'Clinical summary and handover assessment are required.' };
  }

  if (!data.outgoingStaffName?.trim() || !data.incomingStaffName?.trim()) {
    return { success: false, error: 'Both outgoing and incoming clinician names are required.' };
  }

  try {
    const now = Date.now();
    const handoverTimestamp = data.handoverDate ? new Date(data.handoverDate).getTime() : now;

    const res = sqlite
      .prepare(`
        INSERT INTO ipd_handovers (
          admission_id, patient_id, handover_type, shift, handover_date,
          outgoing_staff_name, outgoing_staff_role, incoming_staff_name,
          patient_condition, vitals_summary, summary_notes,
          active_treatment_orders, pending_tasks, special_precautions, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.admissionId,
        data.patientId,
        data.handoverType,
        data.shift || 'Morning',
        handoverTimestamp,
        data.outgoingStaffName.trim(),
        data.outgoingStaffRole || 'NURSE',
        data.incomingStaffName.trim(),
        data.patientCondition || 'Stable',
        data.vitalsSummary?.trim() || null,
        data.summaryNotes.trim(),
        data.activeTreatmentOrders?.trim() || null,
        data.pendingTasks?.trim() || null,
        data.specialPrecautions?.trim() || null,
        now
      );

    const insertedId = Number(res.lastInsertRowid);

    // Military Cryptographic Sealing of Cross-Shift / Doctor Round Handover
    const seal = generateHandoverSeal({
      id: insertedId,
      admissionId: data.admissionId,
      handoverType: data.handoverType,
      shift: data.shift || 'Morning',
      outgoingStaffName: data.outgoingStaffName.trim(),
      incomingStaffName: data.incomingStaffName.trim(),
      patientCondition: data.patientCondition || 'Stable',
      summaryNotes: data.summaryNotes.trim(),
      activeTreatmentOrders: data.activeTreatmentOrders?.trim() || null,
    });
    sqlite.prepare('UPDATE ipd_handovers SET digital_seal_hash = ? WHERE id = ?').run(seal, insertedId);

    await logAuditEvent({
      action: 'IPD_HANDOVER_RECORDED',
      actorRole: role.toUpperCase(),
      details: `${data.handoverType} (${data.shift}) from ${data.outgoingStaffName} to ${data.incomingStaffName} recorded for Admission #${data.admissionId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    return { success: true, id: insertedId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function deleteIpdHandoverAction(
  id: number,
  admissionId: number
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${admissionId}`);
  const role = await getCurrentUserRole();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Clinical staff authority required.' };
  }

  try {
    sqlite.prepare('DELETE FROM ipd_handovers WHERE id = ? AND admission_id = ?').run(id, admissionId);

    await logAuditEvent({
      action: 'IPD_HANDOVER_DELETED',
      actorRole: role.toUpperCase(),
      details: `Shift/Round Handover #${id} removed from Admission #${admissionId}`,
      status: 'WARNING',
    });

    revalidatePath(`/ipd/${admissionId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ==========================================
// Inpatient Nursing Procedures & Clinical Services
// (Oxygen, Suction, Drainage, etc.)
// ==========================================

export async function addClinicalServiceAction(data: {
  admissionId: number;
  patientId: number;
  serviceType: ClinicalServiceType;
  serviceName: string;
  performedAt?: string | Date;
  nurseName: string;
  attendingDoctorName: string;
  flowRateOrDetails?: string;
  observations?: string;
  status?: 'COMPLETED' | 'ONGOING' | 'DISCONTINUED';
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${data.admissionId}`);
  const role = await getCurrentUserRole();

  if (!isNurse(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Nursing or Medical authority required to log clinical services.' };
  }

  if (!data.serviceName?.trim()) {
    return { success: false, error: 'Service/Procedure name is required.' };
  }

  if (!data.nurseName?.trim()) {
    return { success: false, error: 'Administering nurse name must be specified.' };
  }

  if (!data.attendingDoctorName?.trim()) {
    return { success: false, error: 'Round attending doctor name must be specified.' };
  }

  try {
    const now = Date.now();
    const performedTimestamp = data.performedAt ? new Date(data.performedAt).getTime() : now;

    const res = sqlite
      .prepare(`
        INSERT INTO ipd_clinical_services (
          admission_id, patient_id, service_type, service_name, performed_at,
          nurse_name, attending_doctor_name, flow_rate_or_details,
          observations, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.admissionId,
        data.patientId,
        data.serviceType || 'OXYGEN_THERAPY',
        data.serviceName.trim(),
        performedTimestamp,
        data.nurseName.trim(),
        data.attendingDoctorName.trim(),
        data.flowRateOrDetails?.trim() || null,
        data.observations?.trim() || null,
        data.status || 'COMPLETED',
        now
      );

    await logAuditEvent({
      action: 'IPD_CLINICAL_SERVICE_LOGGED',
      actorRole: role.toUpperCase(),
      details: `${data.serviceName} (${data.serviceType}) performed by Nurse ${data.nurseName} (Ordered by Dr. ${data.attendingDoctorName}) on Admission #${data.admissionId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function deleteClinicalServiceAction(
  id: number,
  admissionId: number
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('ipd:view', `/ipd/${admissionId}`);
  const role = await getCurrentUserRole();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Clinical staff authority required.' };
  }

  try {
    sqlite.prepare('DELETE FROM ipd_clinical_services WHERE id = ? AND admission_id = ?').run(id, admissionId);

    await logAuditEvent({
      action: 'IPD_CLINICAL_SERVICE_DELETED',
      actorRole: role.toUpperCase(),
      details: `Clinical Service #${id} deleted from Admission #${admissionId}`,
      status: 'WARNING',
    });

    revalidatePath(`/ipd/${admissionId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}


