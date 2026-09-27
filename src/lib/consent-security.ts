import crypto from 'crypto';
import { getSessionSecret } from '@/lib/auth';

export interface ConsentSealPayload {
  patientId: number;
  admissionId?: number | null;
  consentType: string;
  title: string;
  content: string;
  signedByName: string;
  relationship: string;
  witnessName?: string | null;
  patientSignature?: string | null;
  signedAt: Date | number | string | null;
  signerDoctor?: string | null;
}

function getConsentSecret(): string {
  if (process.env.CONSENT_SECRET && process.env.CONSENT_SECRET.trim().length >= 16) {
    return process.env.CONSENT_SECRET.trim();
  }
  return getSessionSecret();
}

/**
 * Calculates SHA-256 digest of patient signature canvas base64 image
 */
export function hashSignatureImage(signatureDataUrl?: string | null): string {
  if (!signatureDataUrl) return 'NO_CANVAS_SIGNATURE';
  return crypto.createHash('sha256').update(signatureDataUrl).digest('hex');
}

/**
 * Computes an HMAC-SHA256 cryptographic digital seal for clinical consent forms
 * Adheres to Indian Information Technology Act 2000 § 3A & HIPAA § 164.312(c)(1) Data Integrity.
 */
export function generateConsentDigitalSeal(data: ConsentSealPayload): string {
  const sigHash = hashSignatureImage(data.patientSignature);
  const ts = data.signedAt ? new Date(data.signedAt).toISOString() : '';

  const normalizedPayload = [
    `PID:${data.patientId}`,
    `IPD:${data.admissionId || 'NONE'}`,
    `TYPE:${data.consentType.trim().toUpperCase()}`,
    `TITLE:${data.title.trim()}`,
    `CONTENT:${data.content.trim()}`,
    `SIGNER:${data.signedByName.trim()}`,
    `REL:${(data.relationship || 'Self').trim()}`,
    `WITNESS:${(data.witnessName || '').trim()}`,
    `SIGHASH:${sigHash}`,
    `DOCTOR:${(data.signerDoctor || '').trim()}`,
    `TIMESTAMP:${ts}`,
  ].join('||');

  const secret = getConsentSecret();
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(normalizedPayload)
    .digest('hex');

  return `SEAL-v1:${hmac}`;
}

/**
 * Verifies if an existing clinical consent form has been altered or tampered with
 */
export function verifyConsentIntegrity(consent: {
  patientId: number;
  admissionId?: number | null;
  consentType: string;
  title: string;
  content: string;
  signedByName: string;
  relationship?: string | null;
  witnessName?: string | null;
  patientSignature?: string | null;
  doctorSignature?: string | null;
  signedAt?: Date | number | string | null;
}): {
  valid: boolean;
  isSealed: boolean;
  sealHash: string | null;
  computedSeal: string;
} {
  const doctorName = extractDoctorFromSignature(consent.doctorSignature);
  const computedSeal = generateConsentDigitalSeal({
    patientId: consent.patientId,
    admissionId: consent.admissionId,
    consentType: consent.consentType,
    title: consent.title,
    content: consent.content,
    signedByName: consent.signedByName,
    relationship: consent.relationship || 'Self',
    witnessName: consent.witnessName,
    patientSignature: consent.patientSignature,
    signedAt: consent.signedAt ?? null,
    signerDoctor: doctorName,
  });

  if (!consent.doctorSignature) {
    return {
      valid: false,
      isSealed: false,
      sealHash: null,
      computedSeal,
    };
  }

  const storedSeal = extractSealFromSignature(consent.doctorSignature);
  if (!storedSeal) {
    // Legacy unsealed or plain doctor signature
    return {
      valid: false,
      isSealed: false,
      sealHash: null,
      computedSeal,
    };
  }

  // Constant-time comparison to prevent timing side channels
  const bufA = Buffer.from(storedSeal, 'utf8');
  const bufB = Buffer.from(computedSeal, 'utf8');

  if (bufA.length !== bufB.length) {
    return {
      valid: false,
      isSealed: true,
      sealHash: storedSeal,
      computedSeal,
    };
  }

  const valid = crypto.timingSafeEqual(bufA, bufB);

  return {
    valid,
    isSealed: true,
    sealHash: storedSeal,
    computedSeal,
  };
}

export function extractSealFromSignature(doctorSignature?: string | null): string | null {
  if (!doctorSignature) return null;
  const match = doctorSignature.match(/SEAL-v1:[a-f0-9]{64}/i);
  return match ? match[0] : null;
}

export function extractDoctorFromSignature(doctorSignature?: string | null): string {
  if (!doctorSignature) return '';
  const parts = doctorSignature.split('::');
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return doctorSignature.replace(/SEAL-v1:[a-f0-9]{64}/i, '').replace(/DIGITALLY_SEALED_?/i, '').trim();
}
