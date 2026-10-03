import crypto from 'crypto';
import { sqlite } from '@/db';
import { getSessionSecret } from '@/lib/auth';
import { WhoSurgicalChecklist, PacRecord } from '@/types';

/**
 * Computes deterministic HMAC seal for a PAC (Pre-Anesthesia Checkup) clearance.
 */
export function computePacSeal(pac: {
  admissionId: number;
  patientId: number;
  asaClass: string;
  mallampatiScore: number;
  fitnessStatus: string;
  anesthesiologistName: string;
}): string {
  const secret = getSessionSecret();
  const canonical = [
    pac.admissionId,
    pac.patientId,
    pac.asaClass,
    pac.mallampatiScore,
    pac.fitnessStatus,
    pac.anesthesiologistName.trim(),
  ].join('::');

  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Records a WHO Surgical Safety Checklist into the database.
 */
export function recordWhoSurgicalChecklist(checklist: WhoSurgicalChecklist): number {
  const res = sqlite
    .prepare(`
      INSERT INTO who_surgical_checklists (
        admission_id, patient_id, surgery_name, ot_number,
        operating_surgeon, anesthesiologist, scrub_nurse,
        sign_in_patient_confirmed, sign_in_site_marked, sign_in_anesthesia_safety_check,
        sign_in_pulse_oximeter_active, sign_in_allergy_confirmed, sign_in_difficult_airway_risk,
        sign_in_aspiration_risk, sign_in_blood_loss_risk_estimated_ml, sign_in_completed_at, sign_in_signed_by,
        time_out_team_introduced, time_out_patient_identified, time_out_procedure_confirmed,
        time_out_incision_site_confirmed, time_out_antibiotic_prophylaxis_given, time_out_antibiotic_name,
        time_out_anticipated_surgeon_notes, time_out_anticipated_anesthesia_notes, time_out_sterility_confirmed,
        time_out_imaging_displayed, time_out_completed_at, time_out_signed_by,
        sign_out_nurse_verbally_confirmed, sign_out_instrument_count_correct, sign_out_sponge_needle_count_correct,
        sign_out_specimen_labeled_accurately, sign_out_equipment_issues_addressed,
        sign_out_recovery_plan_surgeon_notes, sign_out_recovery_plan_anesthesia_notes,
        sign_out_completed_at, sign_out_signed_by, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)
    .run(
      checklist.admissionId, checklist.patientId, checklist.surgeryName, checklist.otNumber,
      checklist.operatingSurgeon, checklist.anesthesiologist, checklist.scrubNurse,
      checklist.signInPatientConfirmed ? 1 : 0, checklist.signInSiteMarked ? 1 : 0, checklist.signInAnesthesiaSafetyCheck ? 1 : 0,
      checklist.signInPulseOximeterActive ? 1 : 0, checklist.signInAllergyConfirmed ? 1 : 0, checklist.signInDifficultAirwayRisk ? 1 : 0,
      checklist.signInAspirationRisk ? 1 : 0, checklist.signInBloodLossRiskEstimatedMl, checklist.signInCompletedAt ? checklist.signInCompletedAt.getTime() : null, checklist.signInSignedBy || null,
      checklist.timeOutTeamIntroduced ? 1 : 0, checklist.timeOutPatientIdentified ? 1 : 0, checklist.timeOutProcedureConfirmed ? 1 : 0,
      checklist.timeOutIncisionSiteConfirmed ? 1 : 0, checklist.timeOutAntibioticProphylaxisGiven ? 1 : 0, checklist.timeOutAntibioticName || null,
      checklist.timeOutAnticipatedSurgeonNotes || null, checklist.timeOutAnticipatedAnesthesiaNotes || null, checklist.timeOutSterilityConfirmed ? 1 : 0,
      checklist.timeOutImagingDisplayed ? 1 : 0, checklist.timeOutCompletedAt ? checklist.timeOutCompletedAt.getTime() : null, checklist.timeOutSignedBy || null,
      checklist.signOutNurseVerballyConfirmed ? 1 : 0, checklist.signOutInstrumentCountCorrect ? 1 : 0, checklist.signOutSpongeNeedleCountCorrect ? 1 : 0,
      checklist.signOutSpecimenLabeledAccurately ? 1 : 0, checklist.signOutEquipmentIssuesAddressed || null,
      checklist.signOutRecoveryPlanSurgeonNotes || null, checklist.signOutRecoveryPlanAnesthesiaNotes || null,
      checklist.signOutCompletedAt ? checklist.signOutCompletedAt.getTime() : null, checklist.signOutSignedBy || null,
      Date.now()
    );

  return Number(res.lastInsertRowid);
}

/**
 * Records a Pre-Anesthesia Checkup (PAC) clearance with digital seal.
 */
export function recordPacEvaluation(pac: Omit<PacRecord, 'id' | 'signedSeal'>): number {
  const seal = computePacSeal({
    admissionId: pac.admissionId,
    patientId: pac.patientId,
    asaClass: pac.asaClass,
    mallampatiScore: pac.mallampatiScore,
    fitnessStatus: pac.fitnessStatus,
    anesthesiologistName: pac.anesthesiologistName,
  });

  const res = sqlite
    .prepare(`
      INSERT INTO pac_records (
        admission_id, patient_id, evaluation_date, asa_class, mallampati_score,
        airway_evaluation, cardiovascular_notes, respiratory_notes,
        investigations_reviewed, planned_anesthesia_type, npo_status_hours,
        premedication_orders, anesthesiologist_name, fitness_status, signed_seal, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      pac.admissionId,
      pac.patientId,
      pac.evaluationDate.getTime(),
      pac.asaClass,
      pac.mallampatiScore,
      pac.airwayEvaluation,
      pac.cardiovascularNotes || null,
      pac.respiratoryNotes || null,
      pac.investigationsReviewed,
      pac.plannedAnesthesiaType,
      pac.npoStatusHours,
      pac.premedicationOrders || null,
      pac.anesthesiologistName,
      pac.fitnessStatus,
      seal,
      Date.now()
    );

  return Number(res.lastInsertRowid);
}
