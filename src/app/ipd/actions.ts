'use server'

import { db, sqlite } from "@/db";
import { ipdAdmissions, ipdRounds, labReports, patients, emarRecords, clinicalConsents, ipdDeposits } from "@/db/schema";
import { eq, desc, or, like, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, getCurrentUserRole, getCurrentUser, isDoctor, isNurse } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { generateConsentDigitalSeal } from "@/lib/consent-security";
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
  emarRecordsList: EmarRecord[];
  consentsList: ClinicalConsent[];
  depositsList: IpdDeposit[];
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
    return { admission: null, rounds: [], labReportsList: [], emarRecordsList: [], consentsList: [], depositsList: [], settings };
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

  const settings = (await db.query.clinicSettings.findFirst()) || null;

  return {
    admission: row[0] as IpdAdmissionWithPatient,
    rounds: rounds as IpdRound[],
    labReportsList: linkedLabs as LabReportWithPatient[],
    emarRecordsList,
    consentsList,
    depositsList,
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
  await requireAuth(`/ipd/${admissionId}`);
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
    const author = data.doctorOrStaff?.trim() || ((userRole === 'admin_doctor' || userRole === 'doctor') ? settings?.doctorName || 'Dr. On Duty' : 'Staff Nurse');

    const [inserted] = await db
      .insert(ipdRounds)
      .values({
        admissionId,
        roundDate: new Date(),
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
  await requireAuth('/ipd');
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
  notes?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requireAuth('/ipd');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Only nursing or medical staff can schedule medication on eMAR.' };
  }

  try {
    const res = sqlite
      .prepare(`
        INSERT INTO emar_records (
          admission_id, medication_name, dosage, route, scheduled_time,
          status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `)
      .run(
        data.admissionId,
        data.medicationName.trim(),
        data.dosage.trim(),
        data.route || 'Oral',
        data.scheduledTime,
        data.notes?.trim() || null,
        Date.now()
      );

    await logAuditEvent({
      action: 'EMAR_DOSE_SCHEDULED',
      actorRole: role.toUpperCase(),
      details: `Scheduled ${data.medicationName} (${data.dosage}) for Admission #${data.admissionId} by ${user?.name || role}`,
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
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth('/ipd');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isDoctor(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Only nursing or medical staff can record medication administration.' };
  }

  try {
    const now = Date.now();
    const nurseName = user?.name || (role === 'nurse' ? 'Staff Nurse' : 'Attending Staff');

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
        nurseName,
        notes?.trim() || null,
        notes?.trim() || null,
        notes?.trim() || null,
        id
      );

    await logAuditEvent({
      action: 'EMAR_DOSE_ADMINISTERED',
      actorRole: role.toUpperCase(),
      details: `Marked eMAR dose #${id} as ${status} by ${nurseName}`,
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
  await requireAuth('/ipd');
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
  await requireAuth('/ipd');
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
  await requireAuth('/ipd');
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
