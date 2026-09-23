'use server'

import { db } from "@/db";
import { clinicSettings, patients, prescriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ClinicSettings } from "@/types";

export async function getSettings(): Promise<ClinicSettings | null> {
  const settings = await db.select().from(clinicSettings).where(eq(clinicSettings.id, 1)).limit(1);
  return (settings[0] as ClinicSettings) || null;
}

export async function saveSettings(formData: FormData): Promise<void> {
  const file = formData.get("logo") as File | null;
  let logoUrl: string | undefined = undefined;

  if (file && file.size > 0) {
    const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error("Invalid file format. Only PNG, JPEG, and WebP images are allowed.");
    }
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      throw new Error("Logo image file size exceeds the 2MB maximum limit.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    logoUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  }

  const doctorName = ((formData.get("doctorName") as string) || "").trim().slice(0, 100);
  const qualifications = ((formData.get("qualifications") as string) || "").trim().slice(0, 100);
  const regNumber = ((formData.get("regNumber") as string) || "").trim().slice(0, 50);
  const clinicName = ((formData.get("clinicName") as string) || "").trim().slice(0, 150);
  const address = ((formData.get("address") as string) || "").trim().slice(0, 300);
  const contact = ((formData.get("contact") as string) || "").trim().slice(0, 100);

  if (!doctorName || !qualifications || !regNumber || !clinicName || !address || !contact) {
    throw new Error("All required clinic profile fields must be filled.");
  }

  const data: {
    doctorName: string;
    qualifications: string;
    regNumber: string;
    clinicName: string;
    address: string;
    contact: string;
    logoUrl?: string;
  } = {
    doctorName,
    qualifications,
    regNumber,
    clinicName,
    address,
    contact,
  };

  if (logoUrl) {
    data.logoUrl = logoUrl;
  }

  const existing = await getSettings();

  if (existing) {
    await db.update(clinicSettings).set(data).where(eq(clinicSettings.id, 1));
  } else {
    await db.insert(clinicSettings).values({ id: 1, ...data });
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function seedDemoData(): Promise<void> {
  const clinicData = {
    doctorName: "Dr. Rajesh Sharma",
    qualifications: "MBBS, MD (General Medicine)",
    regNumber: "MCI-48920",
    clinicName: "Lifeline Family Clinic & OPD",
    address: "Suite 104, Medicare Square, New Delhi - 110001",
    contact: "+91 98101 23456",
  };

  const existingSettings = await getSettings();
  if (existingSettings) {
    await db.update(clinicSettings).set(clinicData).where(eq(clinicSettings.id, 1));
  } else {
    await db.insert(clinicSettings).values({ id: 1, ...clinicData });
  }

  const existingPatients = await db.select().from(patients).limit(1);
  if (existingPatients.length === 0) {
    const [p1] = await db
      .insert(patients)
      .values({
        name: "Amit Verma",
        age: 42,
        gender: "Male",
        phone: "+91 98765 43210",
        abhaId: "14-2345-6789-0123",
      })
      .returning();

    const [p2] = await db
      .insert(patients)
      .values({
        name: "Priya Patel",
        age: 29,
        gender: "Female",
        phone: "+91 98234 56789",
        abhaId: "14-9876-5432-1098",
      })
      .returning();

    await db.insert(prescriptions).values([
      {
        patientId: p1.id,
        weight: "74",
        bp: "130/84",
        pulse: "78",
        temp: "98.6",
        spo2: "98",
        chiefComplaints: "Mild headache, occasional fatigue and dry cough for 3 days",
        clinicalHistory: "No prior chronic illnesses, no known drug allergies",
        diagnosis: "Essential Stage 1 Hypertension & Mild Viral URTI",
        medications: JSON.stringify([
          {
            name: "Telmisartan",
            strength: "40mg",
            dosage: "1-0-0",
            timing: "After food",
            duration: "30 days",
            instruction: "Take every morning at a fixed time",
          },
          {
            name: "Paracetamol",
            strength: "650mg",
            dosage: "SOS",
            timing: "After food",
            duration: "3 days",
            instruction: "Take only if fever > 100°F or severe body ache",
          },
          {
            name: "Levocetirizine",
            strength: "5mg",
            dosage: "0-0-1",
            timing: "At bedtime",
            duration: "5 days",
            instruction: "At night before sleeping",
          },
        ]),
        advice: "Low sodium diet (< 2g/day), maintain 30 mins daily brisk walking, maintain BP log",
        labTests: "Serum Creatinine, Fasting Lipid Profile, Complete Blood Count",
        followUpDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      },
      {
        patientId: p2.id,
        weight: "58",
        bp: "118/76",
        pulse: "72",
        temp: "98.4",
        spo2: "99",
        chiefComplaints: "Epigastric burning sensation, post-prandial fullness for 1 week",
        clinicalHistory: "Frequent skipping of meals, high tea/coffee consumption",
        diagnosis: "Non-Ulcer Dyspepsia (GERD / Acid Peptic Disease)",
        medications: JSON.stringify([
          {
            name: "Pantoprazole + Domperidone",
            strength: "40mg/30mg",
            dosage: "1-0-0",
            timing: "Before food",
            duration: "14 days",
            instruction: "Take 30 mins before breakfast on empty stomach",
          },
          {
            name: "Sucralfate Syrup",
            strength: "10ml",
            dosage: "1-1-1",
            timing: "Empty stomach",
            duration: "7 days",
            instruction: "Shake well before use, avoid food for 30 mins after syrup",
          },
        ]),
        advice: "Small frequent meals, avoid spicy/fried foods and caffeine, elevate head while sleeping",
        labTests: "Ultrasound Abdomen if symptoms persist",
        followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      },
    ]);
  }

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath("/settings");
}

