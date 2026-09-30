import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrescriptionPreview from "./preview";
import { ClinicSettings, SafeClinicSettings, Patient, Prescription } from "@/types";
import { requirePermission } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ print?: string; send?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const role = await requirePermission('prescription:view', `/prescription/${id}`);
  const prescriptionId = parseInt(id, 10);

  const prescription = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, prescriptionId),
  });

  if (!prescription) notFound();

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, prescription.patientId),
  });

  if (!patient) notFound();

  // Log clinical audit event for record viewing
  await logAuditEvent({
    action: 'PRESCRIPTION_VIEWED',
    actorRole: role.toUpperCase(),
    details: `Prescription #${prescriptionId} viewed for patient ${patient.name} (Patient ID: ${patient.id})`,
    status: 'SUCCESS',
  });

  const rawSettings = await db.query.clinicSettings.findFirst();

  const defaultSettings: SafeClinicSettings = {
    id: 1,
    doctorName: "Doctor / Clinic Name",
    qualifications: "MBBS / Specialist",
    regNumber: "REG-PENDING",
    clinicName: "MedScript OPD Clinic",
    address: "Clinic Address Not Configured",
    contact: "Phone: Not Configured",
    logoUrl: null,
  };

  const safeSettings: SafeClinicSettings = rawSettings
    ? {
        id: rawSettings.id,
        doctorName: rawSettings.doctorName,
        qualifications: rawSettings.qualifications,
        regNumber: rawSettings.regNumber,
        clinicName: rawSettings.clinicName,
        address: rawSettings.address,
        contact: rawSettings.contact,
        logoUrl: rawSettings.logoUrl,
        rbacEnabled: rawSettings.rbacEnabled,
        securityEnabled: rawSettings.securityEnabled,
        autoLockMinutes: rawSettings.autoLockMinutes,
        mfaEnabled: rawSettings.mfaEnabled,
        pinUpdatedAt: rawSettings.pinUpdatedAt,
        rotationDays: rawSettings.rotationDays,
        minPinLength: rawSettings.minPinLength,
        enforceComplexity: rawSettings.enforceComplexity,
        lockdownActive: rawSettings.lockdownActive,
        lockdownReason: rawSettings.lockdownReason,
        lockdownTriggeredAt: rawSettings.lockdownTriggeredAt,
        deceptionModeActive: rawSettings.deceptionModeActive,
      }
    : defaultSettings;

  return (
    <PrescriptionPreview 
      prescription={prescription as Prescription} 
      patient={patient as Patient} 
      settings={safeSettings} 
      isDefaultSettings={!rawSettings}
      userRole={role}
      autoPrint={resolvedSearchParams.print === 'true'}
      autoSend={(resolvedSearchParams.send as 'whatsapp' | 'sms') || null}
    />
  );
}
