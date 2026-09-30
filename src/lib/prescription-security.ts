/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
import crypto from 'crypto';
import { getSessionSecret } from '@/lib/auth';

function getPrescriptionSecret(): string {
  if (process.env.PRESCRIPTION_SECRET && process.env.PRESCRIPTION_SECRET.trim().length >= 16) {
    return process.env.PRESCRIPTION_SECRET.trim();
  }
  return getSessionSecret();
}

export interface PrescriptionSignaturePayload {
  id: number;
  patientId: number;
  regNo?: string | null;
  doctorRegNo?: string | null;
  diagnosis?: string | null;
  medications: string;
  createdAt: Date | number | string | null;
}

/**
 * Computes an HMAC-SHA256 cryptographic digital signature for a prescription
 * Ensures medical-legal tamper evidence and authenticity verification.
 */
export function generatePrescriptionSignature(data: PrescriptionSignaturePayload): string {
  const payload = [
    `RX:${data.id}`,
    `PT:${data.patientId}`,
    `REG:${data.regNo || ''}`,
    `DOC:${data.doctorRegNo || ''}`,
    `DX:${(data.diagnosis || '').trim()}`,
    `MEDS:${data.medications.trim()}`,
    `TS:${data.createdAt ? new Date(data.createdAt).toISOString() : ''}`,
  ].join('||');

  const secret = getPrescriptionSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verifies if an existing prescription's clinical data has been altered or tampered with
 */
export function verifyPrescriptionIntegrity(
  prescription: {
    id: number;
    patientId: number;
    diagnosis?: string | null;
    medications: string;
    signatureHash?: string | null;
    createdAt?: Date | number | string | null;
  },
  doctorRegNo?: string | null,
  patientRegNo?: string | null
): {
  valid: boolean;
  isSigned: boolean;
  signature: string | null;
  computedSignature: string;
} {
  const computed = generatePrescriptionSignature({
    id: prescription.id,
    patientId: prescription.patientId,
    regNo: patientRegNo,
    doctorRegNo,
    diagnosis: prescription.diagnosis,
    medications: prescription.medications,
    createdAt: prescription.createdAt ?? null,
  });

  if (!prescription.signatureHash) {
    return {
      valid: false,
      isSigned: false,
      signature: null,
      computedSignature: computed,
    };
  }

  // Constant-time comparison
  const bufA = Buffer.from(prescription.signatureHash, 'utf8');
  const bufB = Buffer.from(computed, 'utf8');

  if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
    return {
      valid: true,
      isSigned: true,
      signature: prescription.signatureHash,
      computedSignature: computed,
    };
  }

  // Fallback check for legacy signatures generated with initial application secret
  const legacySecrets = ['medscript-opd-clinical-seal-2026'];
  const regVariants = [
    { regNo: patientRegNo, doctorRegNo },
    { regNo: '', doctorRegNo: '' },
  ];

  for (const legSecret of legacySecrets) {
    for (const v of regVariants) {
      const legPayload = [
        `RX:${prescription.id}`,
        `PT:${prescription.patientId}`,
        `REG:${v.regNo || ''}`,
        `DOC:${v.doctorRegNo || ''}`,
        `DX:${(prescription.diagnosis || '').trim()}`,
        `MEDS:${prescription.medications.trim()}`,
        `TS:${prescription.createdAt ? new Date(prescription.createdAt).toISOString() : ''}`,
      ].join('||');

      const legComputed = crypto
        .createHmac('sha256', legSecret)
        .update(legPayload)
        .digest('hex');

      const bufLeg = Buffer.from(legComputed, 'utf8');
      if (bufA.length === bufLeg.length && crypto.timingSafeEqual(bufA, bufLeg)) {
        return {
          valid: true,
          isSigned: true,
          signature: prescription.signatureHash,
          computedSignature: legComputed,
        };
      }
    }
  }

  return {
    valid: false,
    isSigned: true,
    signature: prescription.signatureHash,
    computedSignature: computed,
  };
}

export { formatDigitalSealCode } from '@/lib/seal-formatter';
