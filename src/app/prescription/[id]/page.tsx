import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrescriptionPreview from "./preview";
import { ClinicSettings, Patient, Prescription } from "@/types";
import { requireAuth } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth(`/prescription/${id}`);
  const prescriptionId = parseInt(id, 10);

  const prescription = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, prescriptionId),
  });

  if (!prescription) notFound();

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, prescription.patientId),
  });

  if (!patient) notFound();

  const settings = await db.query.clinicSettings.findFirst();

  const defaultSettings: ClinicSettings = {
    id: 1,
    doctorName: "Doctor / Clinic Name",
    qualifications: "MBBS / Specialist",
    regNumber: "REG-PENDING",
    clinicName: "MedScript OPD Clinic",
    address: "Clinic Address Not Configured",
    contact: "Phone: Not Configured",
    logoUrl: null,
  };

  return (
    <PrescriptionPreview 
      prescription={prescription as Prescription} 
      patient={patient as Patient} 
      settings={(settings as ClinicSettings) || defaultSettings} 
      isDefaultSettings={!settings}
    />
  );
}
