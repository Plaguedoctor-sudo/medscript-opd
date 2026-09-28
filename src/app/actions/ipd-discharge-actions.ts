'use server';

import { db, sqlite } from '@/db';
import { ipdDischarges, ipdNursingNotes, ipdAdmissions, patients, clinicSettings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, getCurrentUserRole, isDoctor, isNurse } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { IpdDischarge, IpdNursingNote, Medication } from '@/types';
import crypto from 'crypto';

export interface SaveDischargeData {
  admissionId: number;
  patientId: number;
  dischargeDate: string; // YYYY-MM-DD
  dischargeTime?: string;
  dischargeCondition: 'Recovered' | 'Improved' | 'Stable' | 'LAMA' | 'Referred' | 'Deceased';
  admissionDiagnosis?: string;
  finalDiagnosis: string;
  clinicalSummary: string;
  investigationSummary?: string;
  proceduresPerformed?: string;
  dischargeVitals?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
    rr?: string;
  };
  dischargeMedications: Medication[];
  dietAdvice?: string;
  activityRestrictions?: string;
  followUpDate?: string;
  followUpInstructions?: string;
  urgentWarningSigns?: string;
  consultantDoctorName: string;
  doctorRegNo?: string;
}

/**
 * Fetch formal IPD Discharge Summary record
 */
export async function getIpdDischargeRecord(admissionId: number): Promise<IpdDischarge | null> {
  await requireAuth('/ipd');

  try {
    const record = await db.query.ipdDischarges.findFirst({
      where: eq(ipdDischarges.admissionId, admissionId),
    });
    return (record as IpdDischarge) || null;
  } catch (err) {
    console.error('Failed to get IPD discharge record:', err);
    return null;
  }
}

/**
 * Save or update formal IPD Discharge Summary record & mark admission as discharged
 */
export async function saveIpdDischargeRecord(
  data: SaveDischargeData
): Promise<{ success: boolean; dischargeId?: number; error?: string }> {
  try {
    await requireAuth('/ipd');
    const role = await getCurrentUserRole();

    if (!isDoctor(role)) {
      return { success: false, error: 'Unauthorized: Only an attending doctor or CMO can finalize and sign an IPD Discharge Summary.' };
    }

    if (!data.admissionId || !data.patientId) {
      return { success: false, error: 'Valid Admission ID and Patient ID are required.' };
    }

    if (!data.finalDiagnosis || !data.finalDiagnosis.trim()) {
      return { success: false, error: 'Final diagnosis is required for formal discharge summary.' };
    }

    if (!data.clinicalSummary || !data.clinicalSummary.trim()) {
      return { success: false, error: 'Hospital course and clinical summary are required.' };
    }

    // Generate cryptographic seal hash for medico-legal verification
    const sealData = `${data.admissionId}:${data.patientId}:${data.dischargeDate}:${data.finalDiagnosis}:${data.consultantDoctorName}:${Date.now()}`;
    const digitalSealHash = crypto.createHash('sha256').update(sealData).digest('hex').slice(0, 32).toUpperCase();

    const existing = await db.query.ipdDischarges.findFirst({
      where: eq(ipdDischarges.admissionId, data.admissionId),
    });

    const payload = {
      admissionId: data.admissionId,
      patientId: data.patientId,
      dischargeDate: data.dischargeDate.trim(),
      dischargeTime: data.dischargeTime?.trim() || null,
      dischargeCondition: data.dischargeCondition,
      admissionDiagnosis: data.admissionDiagnosis?.trim() || null,
      finalDiagnosis: data.finalDiagnosis.trim(),
      clinicalSummary: data.clinicalSummary.trim(),
      investigationSummary: data.investigationSummary?.trim() || null,
      proceduresPerformed: data.proceduresPerformed?.trim() || null,
      dischargeVitals: data.dischargeVitals ? JSON.stringify(data.dischargeVitals) : null,
      dischargeMedications: JSON.stringify(data.dischargeMedications || []),
      dietAdvice: data.dietAdvice?.trim() || null,
      activityRestrictions: data.activityRestrictions?.trim() || null,
      followUpDate: data.followUpDate?.trim() || null,
      followUpInstructions: data.followUpInstructions?.trim() || null,
      urgentWarningSigns: data.urgentWarningSigns?.trim() || null,
      consultantDoctorName: data.consultantDoctorName.trim(),
      doctorRegNo: data.doctorRegNo?.trim() || null,
      digitalSealHash,
    };

    let dischargeId: number;

    if (existing) {
      await db.update(ipdDischarges).set(payload).where(eq(ipdDischarges.id, existing.id));
      dischargeId = existing.id;
    } else {
      const [inserted] = await db
        .insert(ipdDischarges)
        .values({
          ...payload,
          createdAt: new Date(),
        })
        .returning({ id: ipdDischarges.id });
      dischargeId = inserted.id;
    }

    // Update IPD Admission status to DISCHARGED
    await db
      .update(ipdAdmissions)
      .set({
        status: 'DISCHARGED',
        dischargeDate: new Date(data.dischargeDate),
        dischargeCondition: data.dischargeCondition,
        dischargeSummary: data.clinicalSummary,
        dischargeAdvice: data.followUpInstructions,
      })
      .where(eq(ipdAdmissions.id, data.admissionId));

    await logAuditEvent({
      action: 'IPD_DISCHARGE_SUMMARY_SAVED',
      actorRole: role.toUpperCase(),
      details: `Discharge summary finalized for IPD Admission #${data.admissionId} (Condition: ${data.dischargeCondition}, Seal: ${digitalSealHash})`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    revalidatePath('/ipd');

    return { success: true, dischargeId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to save IPD discharge summary:', err);
    return { success: false, error: msg };
  }
}

/**
 * Fetch shift-to-shift nursing notes for an admission
 */
export async function getIpdNursingNotes(admissionId: number): Promise<IpdNursingNote[]> {
  await requireAuth('/ipd');

  try {
    const notes = await db.query.ipdNursingNotes.findMany({
      where: eq(ipdNursingNotes.admissionId, admissionId),
      orderBy: [desc(ipdNursingNotes.createdAt)],
    });
    return (notes as IpdNursingNote[]) || [];
  } catch (err) {
    console.error('Failed to get nursing notes:', err);
    return [];
  }
}

/**
 * Add shift-to-shift nursing note
 */
export async function addIpdNursingNote(data: {
  admissionId: number;
  patientId: number;
  shift: 'Morning' | 'Evening' | 'Night' | string;
  shiftDate: string;
  nurseName: string;
  observations: string;
  vitalsSummary?: string;
  handoverNotes?: string;
}): Promise<{ success: boolean; noteId?: number; error?: string }> {
  try {
    await requireAuth('/ipd');
    const role = await getCurrentUserRole();

    if (!isDoctor(role) && !isNurse(role)) {
      return { success: false, error: 'Unauthorized: Nursing or Doctor role required to record nursing handover notes.' };
    }

    if (!data.observations || !data.observations.trim()) {
      return { success: false, error: 'Nursing observations and patient status are required.' };
    }

    const [inserted] = await db
      .insert(ipdNursingNotes)
      .values({
        admissionId: data.admissionId,
        patientId: data.patientId,
        shift: data.shift || 'Morning',
        shiftDate: data.shiftDate || new Date().toISOString().split('T')[0],
        nurseName: data.nurseName.trim() || 'Duty Nurse',
        observations: data.observations.trim(),
        vitalsSummary: data.vitalsSummary?.trim() || null,
        handoverNotes: data.handoverNotes?.trim() || null,
        createdAt: new Date(),
      })
      .returning({ id: ipdNursingNotes.id });

    await logAuditEvent({
      action: 'IPD_NURSING_NOTE_ADDED',
      actorRole: role.toUpperCase(),
      details: `${data.shift} Shift Handover Note recorded by ${data.nurseName} for IPD #${data.admissionId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${data.admissionId}`);
    return { success: true, noteId: inserted.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Delete a nursing note
 */
export async function deleteIpdNursingNote(
  noteId: number,
  admissionId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth('/ipd');
    const role = await getCurrentUserRole();

    if (!isDoctor(role) && !isNurse(role)) {
      return { success: false, error: 'Unauthorized: Nursing or Doctor role required.' };
    }

    await db.delete(ipdNursingNotes).where(eq(ipdNursingNotes.id, noteId));

    await logAuditEvent({
      action: 'IPD_NURSING_NOTE_DELETED',
      actorRole: role.toUpperCase(),
      details: `Deleted nursing note #${noteId} from IPD Admission #${admissionId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${admissionId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
