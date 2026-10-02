'use server';

import { requirePermission } from '@/lib/auth';
import { db } from '@/db';
import { patients, prescriptions, clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  validateAbhaFormat,
  verifyAbhaWithGateway,
  generateAbdmCareContext,
  generateAbdmPrescriptionDocument,
  AbhaVerificationResponse,
} from '@/lib/abdm/abdm-client';
import { logAuditEvent } from '@/lib/audit';

/**
 * Server action to validate & verify an Ayushman Bharat Health Account (ABHA).
 */
export async function verifyPatientAbhaAction(
  abhaIdentifier: string
): Promise<{ success: boolean; data?: AbhaVerificationResponse; error?: string }> {
  const role = await requirePermission('patient:view');

  const validation = validateAbhaFormat(abhaIdentifier);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const result = await verifyAbhaWithGateway(validation.normalized);
    await logAuditEvent({
      action: 'DATA_EXPORT_PATIENTS',
      actorRole: 'DOCTOR',
      details: `ABHA ID ${validation.normalized} verified with gateway (status: ${result.status})`,
      status: 'SUCCESS',
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to verify ABHA ID';
    return { success: false, error: msg };
  }
}

/**
 * Server action to generate an ABDM-compliant Care Context for an OPD or IPD event.
 */
export async function linkPatientCareContextAction(
  patientId: number,
  encounterType: 'OPD' | 'IPD',
  referenceId: number | string
) {
  const role = await requirePermission('patient:view');

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
  });

  if (!patient) {
    return { success: false, error: 'Patient not found.' };
  }

  const linkage = generateAbdmCareContext(patientId, encounterType, referenceId);

  await logAuditEvent({
    action: encounterType === 'OPD' ? 'PRESCRIPTION_CREATED' : 'IPD_ADMISSION_CREATED',
    actorRole: role.toUpperCase(),
    details: `ABDM Care Context ${linkage.careContext.referenceNumber} generated for ${patient.name}`,
    status: 'SUCCESS',
  });

  return {
    success: true,
    linkage,
  };
}

/**
 * Server action to export a certified ABDM FHIR R4 Document Bundle.
 */
export async function exportAbdmBundleAction(prescriptionId: number) {
  const role = await requirePermission('prescription:view');

  const rx = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, prescriptionId),
  });

  if (!rx) {
    return { success: false, error: 'Prescription not found.' };
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, rx.patientId),
  });

  if (!patient) {
    return { success: false, error: 'Patient not found.' };
  }

  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  const bundle = generateAbdmPrescriptionDocument({
    prescription: rx,
    patient,
    doctor: settings
      ? {
          name: settings.doctorName,
          regNumber: settings.regNumber,
        }
      : null,
  });

  return {
    success: true,
    bundle,
  };
}

/**
 * Server action to run official NHA ABDM Sandbox compliance validation on a prescription.
 */
export async function runAbdmSandboxValidationAction(prescriptionId: number) {
  const role = await requirePermission('prescription:view');

  const rx = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, prescriptionId),
  });

  if (!rx) {
    return { success: false, error: 'Prescription not found.' };
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, rx.patientId),
  });

  if (!patient) {
    return { success: false, error: 'Patient not found.' };
  }

  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  const { generateAbdmCareContext } = await import('@/lib/abdm/abdm-client');
  const { runFullAbdmSandboxSuite } = await import('@/lib/abdm/abdm-sandbox-validator');
  const { prescriptionToAbdmDocumentBundle } = await import('@/lib/fhir/fhir-converter');

  const doctor = settings ? { name: settings.doctorName, regNumber: settings.regNumber } : null;
  const bundle = prescriptionToAbdmDocumentBundle({ prescription: rx, patient, doctor });
  const careContext = generateAbdmCareContext(patient.id, 'OPD', rx.id);

  const report = runFullAbdmSandboxSuite({
    patient,
    prescription: rx,
    doctor,
    bundle,
    careContext,
  });

  await logAuditEvent({
    action: 'DATA_EXPORT_CONSULTATIONS',
    actorRole: role.toUpperCase(),
    details: `NHA ABDM Sandbox validation run for Rx #${rx.id}. M1: ${report.m1.overallStatus}, M2: ${report.m2.overallStatus}, M3: ${report.m3.overallStatus}, PMJAY: ${report.pmjay.status}`,
    status: report.allPassed ? 'SUCCESS' : 'WARNING',
  });

  return {
    success: true,
    report,
  };
}

