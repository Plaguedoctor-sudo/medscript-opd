'use server'

import { db } from "@/db";
import { patients, prescriptions } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { or, like, eq } from "drizzle-orm";
import { Medication, Patient } from "@/types";

export interface PrescriptionFormData {
  patientId?: number | string;
  patientName?: string;
  patientAge?: string | number;
  patientGender?: string;
  patientPhone?: string;
  abhaId?: string;
  weight?: string;
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  chiefComplaints?: string;
  clinicalHistory?: string;
  diagnosis?: string;
  medications: Medication[];
  advice?: string;
  labTests?: string;
  followUpDate?: string;
}

export async function searchPatients(query: string): Promise<Patient[]> {
  if (!query || query.length < 2) return [];
  const results = await db.select().from(patients).where(
    or(
      like(patients.name, `%${query}%`),
      like(patients.phone, `%${query}%`)
    )
  ).limit(5);

  return results as Patient[];
}

export async function getPatientById(id: number): Promise<Patient | null> {
  const patient = await db.query.patients.findFirst({
    where: (patients, { eq }) => eq(patients.id, id)
  });
  return (patient as Patient) || null;
}

export async function createPrescription(formData: PrescriptionFormData) {
  let patientId = formData.patientId ? Number(formData.patientId) : null;

  // 1. Create or Find Patient
  if (!patientId) {
    if (!formData.patientName || !formData.patientAge || !formData.patientGender) {
      throw new Error("Patient name, age, and gender are required.");
    }

    const patientData = {
      name: String(formData.patientName).trim(),
      age: parseInt(String(formData.patientAge), 10),
      gender: String(formData.patientGender),
      phone: formData.patientPhone ? String(formData.patientPhone).trim() : null,
      abhaId: formData.abhaId ? String(formData.abhaId).trim() : null,
    };

    const [newPatient] = await db.insert(patients).values(patientData).returning();
    patientId = newPatient.id;
  }

  // 2. Create Prescription
  const prescriptionData = {
    patientId: patientId,
    weight: formData.weight || null,
    bp: formData.bp || null,
    pulse: formData.pulse || null,
    temp: formData.temp || null,
    spo2: formData.spo2 || null,
    chiefComplaints: formData.chiefComplaints || null,
    clinicalHistory: formData.clinicalHistory || null,
    diagnosis: formData.diagnosis || null,
    medications: JSON.stringify(formData.medications || []),
    advice: formData.advice || null,
    labTests: formData.labTests || null,
    followUpDate: formData.followUpDate || null,
  };

  const [prescription] = await db.insert(prescriptions).values(prescriptionData).returning();

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath(`/patient/${patientId}`);

  return { success: true, prescriptionId: prescription.id };
}

export async function updatePrescription(id: number, formData: PrescriptionFormData) {
  const prescriptionData = {
    weight: formData.weight || null,
    bp: formData.bp || null,
    pulse: formData.pulse || null,
    temp: formData.temp || null,
    spo2: formData.spo2 || null,
    chiefComplaints: formData.chiefComplaints || null,
    clinicalHistory: formData.clinicalHistory || null,
    diagnosis: formData.diagnosis || null,
    medications: JSON.stringify(formData.medications || []),
    advice: formData.advice || null,
    labTests: formData.labTests || null,
    followUpDate: formData.followUpDate || null,
  };

  await db.update(prescriptions)
    .set(prescriptionData)
    .where(eq(prescriptions.id, id));

  const [existing] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));

  revalidatePath("/");
  revalidatePath("/patients");
  if (existing) {
    revalidatePath(`/patient/${existing.patientId}`);
  }
  revalidatePath(`/prescription/${id}`);

  return { success: true, prescriptionId: id };
}

export async function deletePrescription(id: number) {
  const [existing] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
  if (!existing) {
    throw new Error("Prescription not found");
  }

  await db.delete(prescriptions).where(eq(prescriptions.id, id));

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath(`/patient/${existing.patientId}`);

  return { success: true, patientId: existing.patientId };
}

export async function updatePatient(
  id: number,
  data: {
    name: string;
    age: number;
    gender: string;
    phone?: string | null;
    abhaId?: string | null;
  }
) {
  if (!data.name || !data.age || !data.gender) {
    throw new Error("Patient name, age, and gender are required.");
  }

  await db
    .update(patients)
    .set({
      name: data.name.trim(),
      age: data.age,
      gender: data.gender,
      phone: data.phone ? data.phone.trim() : null,
      abhaId: data.abhaId ? data.abhaId.trim() : null,
    })
    .where(eq(patients.id, id));

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath(`/patient/${id}`);

  return { success: true };
}

