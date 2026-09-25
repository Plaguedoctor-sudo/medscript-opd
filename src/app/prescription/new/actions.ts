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

export async function generatePatientRegNo(targetDate: Date = new Date()): Promise<string> {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`;

  const existingToday = await db
    .select({ regNo: patients.regNo })
    .from(patients)
    .where(like(patients.regNo, `${datePrefix}%`));

  let maxSequence = 0;
  for (const row of existingToday) {
    if (row.regNo) {
      const match = row.regNo.match(/^(\d{8})[-]?(\d+)$/);
      if (match && match[1] === datePrefix) {
        const seq = parseInt(match[2], 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }
  }

  const nextSeq = maxSequence + 1;
  return `${datePrefix}-${nextSeq}`;
}

export async function searchPatients(query: string): Promise<Patient[]> {
  if (!query || query.trim().length < 1) return [];
  const clean = query.trim();
  let hyphenated = clean;
  if (/^\d{9,}$/.test(clean)) {
    hyphenated = `${clean.slice(0, 8)}-${clean.slice(8)}`;
  }

  const results = await db
    .select()
    .from(patients)
    .where(
      or(
        like(patients.name, `%${clean}%`),
        like(patients.phone, `%${clean}%`),
        like(patients.regNo, `%${clean}%`),
        like(patients.regNo, `%${hyphenated}%`),
        like(patients.abhaId, `%${clean}%`)
      )
    )
    .limit(8);

  return results as Patient[];
}

export async function getPatientById(id: number): Promise<Patient | null> {
  const patient = await db.query.patients.findFirst({
    where: (patients, { eq }) => eq(patients.id, id)
  });
  return (patient as Patient) || null;
}

function sanitizeString(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : null;
}

function sanitizeMedications(meds: unknown): Medication[] {
  if (!Array.isArray(meds)) return [];
  return meds
    .filter((m): m is Medication => typeof m === "object" && m !== null && typeof m.name === "string" && m.name.trim().length > 0)
    .map((m) => ({
      name: m.name.trim().slice(0, 100),
      strength: (m.strength || "").trim().slice(0, 50),
      dosage: (m.dosage || "").trim().slice(0, 50),
      timing: (m.timing || "").trim().slice(0, 50),
      duration: (m.duration || "").trim().slice(0, 50),
      instruction: m.instruction ? m.instruction.trim().slice(0, 150) : undefined,
    }));
}

export async function createPrescription(formData: PrescriptionFormData) {
  let patientId = formData.patientId ? Number(formData.patientId) : null;

  // 1. Create or Find Patient
  if (!patientId) {
    const rawName = sanitizeString(formData.patientName, 100);
    const rawAge = parseInt(String(formData.patientAge), 10);
    const rawGender = sanitizeString(formData.patientGender, 20);

    if (!rawName || isNaN(rawAge) || !rawGender) {
      throw new Error("Patient name, valid age, and gender are required.");
    }

    const regNo = await generatePatientRegNo();

    const patientData = {
      regNo,
      name: rawName,
      age: Math.max(0, Math.min(130, rawAge)),
      gender: ["Male", "Female", "Other"].includes(rawGender) ? rawGender : "Other",
      phone: sanitizeString(formData.patientPhone, 25),
      abhaId: sanitizeString(formData.abhaId, 30),
    };

    const [newPatient] = await db.insert(patients).values(patientData).returning();
    patientId = newPatient.id;
  }

  // 2. Create Prescription
  const prescriptionData = {
    patientId: patientId,
    weight: sanitizeString(formData.weight, 20),
    bp: sanitizeString(formData.bp, 20),
    pulse: sanitizeString(formData.pulse, 20),
    temp: sanitizeString(formData.temp, 20),
    spo2: sanitizeString(formData.spo2, 20),
    chiefComplaints: sanitizeString(formData.chiefComplaints, 1000),
    clinicalHistory: sanitizeString(formData.clinicalHistory, 2000),
    diagnosis: sanitizeString(formData.diagnosis, 500),
    medications: JSON.stringify(sanitizeMedications(formData.medications)),
    advice: sanitizeString(formData.advice, 2000),
    labTests: sanitizeString(formData.labTests, 1000),
    followUpDate: sanitizeString(formData.followUpDate, 30),
  };

  const [prescription] = await db.insert(prescriptions).values(prescriptionData).returning();

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath(`/patient/${patientId}`);
  revalidatePath("/prescription/new");
  revalidatePath("/prescription", "layout");
  revalidatePath(`/prescription/${prescription.id}`);

  return { success: true, prescriptionId: prescription.id };
}

export async function updatePrescription(id: number, formData: PrescriptionFormData) {
  const prescriptionData = {
    weight: sanitizeString(formData.weight, 20),
    bp: sanitizeString(formData.bp, 20),
    pulse: sanitizeString(formData.pulse, 20),
    temp: sanitizeString(formData.temp, 20),
    spo2: sanitizeString(formData.spo2, 20),
    chiefComplaints: sanitizeString(formData.chiefComplaints, 1000),
    clinicalHistory: sanitizeString(formData.clinicalHistory, 2000),
    diagnosis: sanitizeString(formData.diagnosis, 500),
    medications: JSON.stringify(sanitizeMedications(formData.medications)),
    advice: sanitizeString(formData.advice, 2000),
    labTests: sanitizeString(formData.labTests, 1000),
    followUpDate: sanitizeString(formData.followUpDate, 30),
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
  const rawName = sanitizeString(data.name, 100);
  const rawAge = parseInt(String(data.age), 10);
  const rawGender = sanitizeString(data.gender, 20);

  if (!rawName || isNaN(rawAge) || !rawGender) {
    throw new Error("Patient name, valid age, and gender are required.");
  }

  await db
    .update(patients)
    .set({
      name: rawName,
      age: Math.max(0, Math.min(130, rawAge)),
      gender: ["Male", "Female", "Other"].includes(rawGender) ? rawGender : "Other",
      phone: sanitizeString(data.phone, 25),
      abhaId: sanitizeString(data.abhaId, 30),
    })
    .where(eq(patients.id, id));

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath(`/patient/${id}`);

  return { success: true };
}

export async function deletePatient(id: number) {
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, id),
  });
  if (!patient) {
    throw new Error("Patient not found.");
  }

  // Delete all associated prescriptions first
  await db.delete(prescriptions).where(eq(prescriptions.patientId, id));
  // Delete patient
  await db.delete(patients).where(eq(patients.id, id));

  revalidatePath("/");
  revalidatePath("/patients");

  return { success: true };
}

