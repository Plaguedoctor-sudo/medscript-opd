'use server';

import { requireRole, isDoctor } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import {
  computeReferralSeal,
  verifyReferralSeal,
} from '@/lib/clinical/referral-letter';
import { SpecialistReferralLetter } from '@/types';

/**
 * Issues a signed medical specialist referral letter for higher tertiary care.
 */
export async function issueSpecialistReferralAction(
  data: Omit<SpecialistReferralLetter, 'id' | 'digitalSeal' | 'referralDate'>
): Promise<{ success: boolean; referralId?: number; digitalSeal?: string; error?: string }> {
  // Referral letters are strictly a Doctor privilege
  const role = await requireRole(['admin_doctor', 'doctor']);

  try {
    const now = new Date();
    const digitalSeal = computeReferralSeal({
      patientId: data.patientId,
      patientName: data.patientName,
      referringDoctorRegNo: data.referringDoctorRegNo,
      targetSpecialty: data.targetSpecialty,
      targetHospitalOrDoctor: data.targetHospitalOrDoctor,
      provisionalDiagnosis: data.provisionalDiagnosis,
      reasonForReferral: data.reasonForReferral,
      referralDate: now,
    });

    const res = sqlite
      .prepare(`
        INSERT INTO specialist_referral_letters (
          patient_id, patient_name, patient_age_gender, patient_phone, referral_date,
          urgency, referring_doctor_name, referring_doctor_reg_no, target_specialty,
          target_hospital_or_doctor, provisional_diagnosis, clinical_summary,
          vital_signs, current_medications, relevant_investigations, reason_for_referral,
          digital_seal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.patientId,
        data.patientName,
        data.patientAgeGender,
        data.patientPhone || null,
        now.getTime(),
        data.urgency,
        data.referringDoctorName,
        data.referringDoctorRegNo,
        data.targetSpecialty,
        data.targetHospitalOrDoctor,
        data.provisionalDiagnosis,
        data.clinicalSummary,
        data.vitalSigns,
        data.currentMedications,
        data.relevantInvestigations,
        data.reasonForReferral,
        digitalSeal,
        now.getTime()
      );

    await logAuditEvent({
      action: 'PRESCRIPTION_CREATED',
      actorRole: role.toUpperCase(),
      details: `Specialist Referral Letter issued for ${data.patientName} -> ${data.targetSpecialty} at ${data.targetHospitalOrDoctor}`,
      status: 'SUCCESS',
    });

    return { success: true, referralId: Number(res.lastInsertRowid), digitalSeal };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to issue referral letter';
    return { success: false, error: msg };
  }
}

/**
 * Retrieves referral letters issued for a patient.
 */
export async function getPatientReferralsAction(patientId: number): Promise<{
  success: boolean;
  referrals: SpecialistReferralLetter[];
  error?: string;
}> {
  await requireRole(['admin_doctor', 'doctor', 'nurse', 'receptionist']);

  try {
    const rows = sqlite
      .prepare(`
        SELECT 
          id, patient_id, patient_name, patient_age_gender, patient_phone,
          referral_date, urgency, referring_doctor_name, referring_doctor_reg_no,
          target_specialty, target_hospital_or_doctor, provisional_diagnosis,
          clinical_summary, vital_signs, current_medications, relevant_investigations,
          reason_for_referral, digital_seal
        FROM specialist_referral_letters
        WHERE patient_id = ?
        ORDER BY referral_date DESC
      `)
      .all(patientId) as any[];

    const referrals: SpecialistReferralLetter[] = rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientAgeGender: r.patient_age_gender,
      patientPhone: r.patient_phone,
      referralDate: new Date(r.referral_date),
      urgency: r.urgency,
      referringDoctorName: r.referring_doctor_name,
      referringDoctorRegNo: r.referring_doctor_reg_no,
      targetSpecialty: r.target_specialty,
      targetHospitalOrDoctor: r.target_hospital_or_doctor,
      provisionalDiagnosis: r.provisional_diagnosis,
      clinicalSummary: r.clinical_summary,
      vitalSigns: r.vital_signs,
      currentMedications: r.current_medications,
      relevantInvestigations: r.relevant_investigations,
      reasonForReferral: r.reason_for_referral,
      digitalSeal: r.digital_seal,
    }));

    return { success: true, referrals };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve referral letters';
    return { success: false, referrals: [], error: msg };
  }
}
