'use server';

import { requireRole, isDoctor } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import {
  recordWhoSurgicalChecklist,
  recordPacEvaluation,
} from '@/lib/ot/surgical-checklist';
import { WhoSurgicalChecklist, PacRecord } from '@/types';

/**
 * Saves a completed WHO Surgical Safety Checklist for an operative case.
 */
export async function saveWhoSurgicalChecklistAction(
  checklist: WhoSurgicalChecklist
): Promise<{ success: boolean; checklistId?: number; error?: string }> {
  // Surgical checklist sign-offs require clinical doctor authorization
  const role = await requireRole(['admin_doctor', 'doctor', 'nurse']);

  try {
    const checklistId = recordWhoSurgicalChecklist(checklist);

    await logAuditEvent({
      action: 'IPD_ADMISSION_UPDATED',
      actorRole: role.toUpperCase(),
      details: `WHO Surgical Safety Checklist verified for ${checklist.surgeryName} in ${checklist.otNumber} (Admission #${checklist.admissionId})`,
      status: 'SUCCESS',
    });

    return { success: true, checklistId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record surgical checklist';
    return { success: false, error: msg };
  }
}

/**
 * Saves a Pre-Anesthesia Checkup (PAC) evaluation with digital seal.
 */
export async function savePacRecordAction(
  pac: Omit<PacRecord, 'id' | 'signedSeal'>
): Promise<{ success: boolean; pacId?: number; error?: string }> {
  // PAC evaluation is strictly a doctor privilege
  const role = await requireRole(['admin_doctor', 'doctor']);

  try {
    const pacId = recordPacEvaluation(pac);

    await logAuditEvent({
      action: 'IPD_ADMISSION_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Pre-Anesthesia Checkup (PAC) issued for admission #${pac.admissionId}: ${pac.fitnessStatus} (ASA ${pac.asaClass})`,
      status: 'SUCCESS',
    });

    return { success: true, pacId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record PAC clearance';
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the surgical checklist for an admission.
 */
export async function getWhoChecklistsAction(admissionId: number): Promise<{
  success: boolean;
  checklist?: WhoSurgicalChecklist;
  error?: string;
}> {
  await requireRole(['admin_doctor', 'doctor', 'nurse']);

  try {
    const row = sqlite
      .prepare('SELECT * FROM who_surgical_checklists WHERE admission_id = ? ORDER BY id DESC LIMIT 1')
      .get(admissionId) as any;

    if (!row) {
      return { success: true };
    }

    const checklist: WhoSurgicalChecklist = {
      id: row.id,
      admissionId: row.admission_id,
      patientId: row.patient_id,
      surgeryName: row.surgery_name,
      otNumber: row.ot_number,
      operatingSurgeon: row.operating_surgeon,
      anesthesiologist: row.anesthesiologist,
      scrubNurse: row.scrub_nurse,
      signInPatientConfirmed: Boolean(row.sign_in_patient_confirmed),
      signInSiteMarked: Boolean(row.sign_in_site_marked),
      signInAnesthesiaSafetyCheck: Boolean(row.sign_in_anesthesia_safety_check),
      signInPulseOximeterActive: Boolean(row.sign_in_pulse_oximeter_active),
      signInAllergyConfirmed: Boolean(row.sign_in_allergy_confirmed),
      signInDifficultAirwayRisk: Boolean(row.sign_in_difficult_airway_risk),
      signInAspirationRisk: Boolean(row.sign_in_aspiration_risk),
      signInBloodLossRiskEstimatedMl: row.sign_in_blood_loss_risk_estimated_ml || 0,
      signInCompletedAt: row.sign_in_completed_at ? new Date(row.sign_in_completed_at) : null,
      signInSignedBy: row.sign_in_signed_by,
      timeOutTeamIntroduced: Boolean(row.time_out_team_introduced),
      timeOutPatientIdentified: Boolean(row.time_out_patient_identified),
      timeOutProcedureConfirmed: Boolean(row.time_out_procedure_confirmed),
      timeOutIncisionSiteConfirmed: Boolean(row.time_out_incision_site_confirmed),
      timeOutAntibioticProphylaxisGiven: Boolean(row.time_out_antibiotic_prophylaxis_given),
      timeOutAntibioticName: row.time_out_antibiotic_name,
      timeOutAnticipatedSurgeonNotes: row.time_out_anticipated_surgeon_notes,
      timeOutAnticipatedAnesthesiaNotes: row.time_out_anticipated_anesthesia_notes,
      timeOutSterilityConfirmed: Boolean(row.time_out_sterility_confirmed),
      timeOutImagingDisplayed: Boolean(row.time_out_imaging_displayed),
      timeOutCompletedAt: row.time_out_completed_at ? new Date(row.time_out_completed_at) : null,
      timeOutSignedBy: row.time_out_signed_by,
      signOutNurseVerballyConfirmed: Boolean(row.sign_out_nurse_verbally_confirmed),
      signOutInstrumentCountCorrect: Boolean(row.sign_out_instrument_count_correct),
      signOutSpongeNeedleCountCorrect: Boolean(row.sign_out_sponge_needle_count_correct),
      signOutSpecimenLabeledAccurately: Boolean(row.sign_out_specimen_labeled_accurately),
      signOutEquipmentIssuesAddressed: row.sign_out_equipment_issues_addressed,
      signOutRecoveryPlanSurgeonNotes: row.sign_out_recovery_plan_surgeon_notes,
      signOutRecoveryPlanAnesthesiaNotes: row.sign_out_recovery_plan_anesthesia_notes,
      signOutCompletedAt: row.sign_out_completed_at ? new Date(row.sign_out_completed_at) : null,
      signOutSignedBy: row.sign_out_signed_by,
      createdAt: new Date(row.created_at),
    };

    return { success: true, checklist };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve checklist';
    return { success: false, error: msg };
  }
}
