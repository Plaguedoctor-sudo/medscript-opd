import crypto from 'crypto';
import { getSessionSecret } from '@/lib/auth';
import { SpecialistReferralLetter } from '@/types';

/**
 * Computes deterministic HMAC-SHA256 digital seal for a Specialist Referral Letter.
 */
export function computeReferralSeal(letter: {
  patientId: number;
  patientName: string;
  referringDoctorRegNo: string;
  targetSpecialty: string;
  targetHospitalOrDoctor: string;
  provisionalDiagnosis: string;
  reasonForReferral: string;
  referralDate: Date;
}): string {
  const secret = getSessionSecret();
  const canonical = [
    letter.patientId,
    letter.patientName.trim(),
    letter.referringDoctorRegNo.trim(),
    letter.targetSpecialty.trim(),
    letter.targetHospitalOrDoctor.trim(),
    letter.provisionalDiagnosis.trim(),
    letter.reasonForReferral.trim(),
    letter.referralDate.toISOString().slice(0, 10),
  ].join('::');

  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Verifies the integrity of a Specialist Referral Letter seal.
 */
export function verifyReferralSeal(letter: SpecialistReferralLetter): boolean {
  if (!letter.digitalSeal) return false;
  const expected = computeReferralSeal({
    patientId: letter.patientId,
    patientName: letter.patientName,
    referringDoctorRegNo: letter.referringDoctorRegNo,
    targetSpecialty: letter.targetSpecialty,
    targetHospitalOrDoctor: letter.targetHospitalOrDoctor,
    provisionalDiagnosis: letter.provisionalDiagnosis,
    reasonForReferral: letter.reasonForReferral,
    referralDate: new Date(letter.referralDate),
  });

  const a = Buffer.from(letter.digitalSeal.trim());
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
