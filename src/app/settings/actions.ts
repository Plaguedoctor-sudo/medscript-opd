'use server'

import { db } from "@/db";
import { clinicSettings, patients, prescriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ClinicSettings, SafeClinicSettings } from "@/types";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { encryptPhi, decryptPhi } from "@/lib/crypto-storage";

export async function getSettings(): Promise<SafeClinicSettings | null> {
  await requireRole(['doctor'], '/settings');
  const settings = await db.query.clinicSettings.findFirst();
  if (!settings) return null;
  const { pinHash, staffPinHash, mfaSecret, mfaBackupCodes, sessionSecret, ...safe } = settings;
  return safe as SafeClinicSettings;
}

export async function saveSettings(formData: FormData): Promise<SafeClinicSettings> {
  await requireRole(['doctor'], '/settings');
  const existing = await getSettings();

  const removeLogo = formData.get("removeLogo") === "true";
  const logoDataUrl = (formData.get("logoDataUrl") as string | null)?.trim();
  const file = formData.get("logo") as File | null;
  let logoUrl: string | null | undefined = undefined;

  if (removeLogo) {
    logoUrl = null;
  } else if (logoDataUrl && logoDataUrl.startsWith("data:image/")) {
    if (!logoDataUrl.startsWith("data:image/png") && !logoDataUrl.startsWith("data:image/jpeg")) {
      throw new Error("Only PNG and JPEG formats are supported for PDF letterheads.");
    }
    if (logoDataUrl.length > 500 * 1024) {
      throw new Error("Logo image data exceeds 500KB limit. Please choose a smaller logo.");
    }
    logoUrl = logoDataUrl;
  } else if (file && file.size > 0) {
    const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error("Invalid file format. Please upload a PNG or JPEG image.");
    }
    const MAX_SIZE = 1 * 1024 * 1024; // 1MB
    if (file.size > MAX_SIZE) {
      throw new Error("Logo image file size exceeds the 1MB maximum limit.");
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

  if (!doctorName) {
    throw new Error("Doctor name is required.");
  }

  const data: {
    doctorName: string;
    qualifications: string;
    regNumber: string;
    clinicName: string;
    address: string;
    contact: string;
    logoUrl?: string | null;
  } = {
    doctorName,
    qualifications: qualifications || existing?.qualifications || "MBBS",
    regNumber: regNumber || existing?.regNumber || "REG-PENDING",
    clinicName: clinicName || existing?.clinicName || "Clinic OPD",
    address: address || existing?.address || "Clinic Address",
    contact: contact || existing?.contact || "+91",
  };

  if (logoUrl !== undefined) {
    data.logoUrl = logoUrl;
  }

  if (existing) {
    await db.update(clinicSettings).set(data).where(eq(clinicSettings.id, existing.id));
  } else {
    await db.insert(clinicSettings).values({ id: 1, ...data });
  }

  await logAuditEvent({
    action: 'SETTINGS_SAVED',
    details: `Updated clinic profile: ${data.clinicName} (Dr. ${data.doctorName})`,
    status: 'SUCCESS',
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/prescription/new");
  revalidatePath("/prescription", "layout");
  revalidatePath("/patients");

  const updated = await getSettings();
  return updated!;
}

export async function seedDemoData(): Promise<void> {
  await requireRole(['doctor'], '/settings');
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
    await db.update(clinicSettings).set(clinicData).where(eq(clinicSettings.id, existingSettings.id));
  } else {
    await db.insert(clinicSettings).values({ id: 1, ...clinicData });
  }

  await logAuditEvent({
    action: 'SETTINGS_SAVED',
    details: 'Sample clinic data and patient records seeded',
    status: 'SUCCESS',
  });

  const existingPatients = await db.select().from(patients).limit(1);
  if (existingPatients.length === 0) {
    const DAY = 86400000;
    const now = Date.now();

    const [p1] = await db
      .insert(patients)
      .values({
        regNo: "20260826-1",
        name: "Amit Verma",
        age: 42,
        gender: "Male",
        phone: "+91 98765 43210",
        abhaId: "14-2345-6789-0123",
        createdAt: new Date(now - 28 * DAY),
      })
      .returning();

    const [p2] = await db
      .insert(patients)
      .values({
        regNo: "20260913-1",
        name: "Priya Patel",
        age: 29,
        gender: "Female",
        phone: "+91 98234 56789",
        abhaId: "14-9876-5432-1098",
        createdAt: new Date(now - 10 * DAY),
      })
      .returning();

    await db.insert(prescriptions).values([
      // Amit Verma - Visit 1
      {
        patientId: p1.id,
        weight: "75.5",
        bp: "142/90",
        pulse: "84",
        temp: "99.2",
        spo2: "97",
        chiefComplaints: "Headache, persistent fatigue, and elevated BP readings at home",
        clinicalHistory: "Sedentary lifestyle, high sodium diet, no prior BP medication",
        diagnosis: "Essential Stage 2 Hypertension & Mild Viral Pharyngitis",
        medications: JSON.stringify([
          {
            name: "Telmisartan",
            strength: "40mg",
            dosage: "1-0-0",
            timing: "After food",
            duration: "14 days",
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
        advice: "Strict low sodium diet (< 2g/day), avoid fried snacks, 30 min daily brisk walk",
        labTests: "Serum Creatinine, Fasting Blood Sugar, Lipid Profile, ECG",
        followUpDate: new Date(now - 14 * DAY).toISOString().split("T")[0],
        createdAt: new Date(now - 28 * DAY),
      },
      // Amit Verma - Visit 2
      {
        patientId: p1.id,
        weight: "74.6",
        bp: "132/84",
        pulse: "78",
        temp: "98.6",
        spo2: "98",
        chiefComplaints: "Follow-up for BP review. Headache improved, mild pedal puffiness in evenings",
        clinicalHistory: "Responding favorably to Telmisartan",
        diagnosis: "Essential Hypertension - Stage 1 (Improving)",
        medications: JSON.stringify([
          {
            name: "Telmisartan",
            strength: "40mg",
            dosage: "1-0-0",
            timing: "After food",
            duration: "30 days",
            instruction: "Continue morning dose",
          },
          {
            name: "Amlodipine",
            strength: "2.5mg",
            dosage: "0-0-1",
            timing: "At bedtime",
            duration: "30 days",
            instruction: "Added for tighter evening control",
          },
        ]),
        advice: "Maintain daily salt restriction, continue morning walking routine",
        labTests: "Repeat serum electrolytes in 4 weeks",
        followUpDate: new Date(now + 14 * DAY).toISOString().split("T")[0],
        createdAt: new Date(now - 14 * DAY),
      },
      // Amit Verma - Visit 3
      {
        patientId: p1.id,
        weight: "73.8",
        bp: "122/80",
        pulse: "72",
        temp: "98.4",
        spo2: "99",
        chiefComplaints: "Routine follow-up. Feeling energetic, no headaches, no visual disturbances",
        clinicalHistory: "Well-controlled hypertension on combination therapy",
        diagnosis: "Essential Hypertension - Target Controlled (Normal Range)",
        medications: JSON.stringify([
          {
            name: "Telmisartan",
            strength: "40mg",
            dosage: "1-0-0",
            timing: "After food",
            duration: "60 days",
            instruction: "Maintain regularly",
          },
          {
            name: "Amlodipine",
            strength: "2.5mg",
            dosage: "0-0-1",
            timing: "At bedtime",
            duration: "60 days",
            instruction: "Evening bedtime dose",
          },
        ]),
        advice: "Excellent response. Continue regular physical activity and diet control",
        labTests: "Annual wellness panel after 6 months",
        followUpDate: new Date(now + 60 * DAY).toISOString().split("T")[0],
        createdAt: new Date(now - 2 * DAY),
      },
      // Priya Patel - Visit 1
      {
        patientId: p2.id,
        weight: "58.0",
        bp: "118/76",
        pulse: "74",
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
        followUpDate: new Date(now).toISOString().split("T")[0],
        createdAt: new Date(now - 10 * DAY),
      },
      // Priya Patel - Visit 2
      {
        patientId: p2.id,
        weight: "58.3",
        bp: "116/74",
        pulse: "70",
        temp: "98.5",
        spo2: "99",
        chiefComplaints: "Follow-up for GERD. Burning significantly subsided, no regurgitation",
        clinicalHistory: "Complete resolution of acute symptoms",
        diagnosis: "Acid Peptic Disease - Symptomatically Controlled",
        medications: JSON.stringify([
          {
            name: "Pantoprazole",
            strength: "40mg",
            dosage: "1-0-0",
            timing: "Before food",
            duration: "14 days",
            instruction: "Taper to single agent before breakfast",
          },
        ]),
        advice: "Continue regular meal timings, reduce stress and late-night snacking",
        labTests: "None required at present",
        followUpDate: new Date(now + 30 * DAY).toISOString().split("T")[0],
        createdAt: new Date(now - 1 * DAY),
      },
    ]);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath("/settings");
  revalidatePath("/prescription/new");
  revalidatePath("/prescription", "layout");
}

// ==========================================
// Google Drive Cloud Backup Actions
// ==========================================

import {
  testGoogleDriveConnection,
  backupDatabaseToGoogleDrive,
  GoogleDriveBackupResult,
} from "@/lib/gdrive-backup";
import { sqlite } from "@/db";

export async function getGoogleDriveConfigAction() {
  await requireRole(['doctor', 'admin_doctor'], '/settings');
  try {
    const row = sqlite
      .prepare(`
        SELECT
          gdrive_backup_enabled as enabled,
          gdrive_folder_id as folderId,
          gdrive_client_email as clientEmail,
          CASE WHEN gdrive_private_key IS NOT NULL AND length(gdrive_private_key) > 20 THEN 1 ELSE 0 END as hasPrivateKey,
          gdrive_last_backup_at as lastBackupAt,
          gdrive_last_backup_status as lastBackupStatus,
          gdrive_last_backup_file_id as lastBackupFileId,
          gdrive_last_backup_file_name as lastBackupFileName,
          gdrive_auto_backup_interval as autoBackupInterval
        FROM clinic_settings
        WHERE id = 1
      `)
      .get() as {
        enabled?: number;
        folderId?: string | null;
        clientEmail?: string | null;
        hasPrivateKey?: number;
        lastBackupAt?: number | null;
        lastBackupStatus?: string | null;
        lastBackupFileId?: string | null;
        lastBackupFileName?: string | null;
        autoBackupInterval?: string | null;
      } | undefined;

    return {
      enabled: Boolean(row?.enabled),
      folderId: row?.folderId || "",
      clientEmail: row?.clientEmail || "",
      hasPrivateKey: Boolean(row?.hasPrivateKey),
      lastBackupAt: row?.lastBackupAt ? new Date(row.lastBackupAt) : null,
      lastBackupStatus: row?.lastBackupStatus || null,
      lastBackupFileId: row?.lastBackupFileId || null,
      lastBackupFileName: row?.lastBackupFileName || null,
      autoBackupInterval: (row?.autoBackupInterval || "DAILY") as 'DAILY' | 'TWICE_DAILY' | 'MANUAL',
    };
  } catch (err) {
    console.error("Failed to load Google Drive settings:", err);
    return {
      enabled: false,
      folderId: "",
      clientEmail: "",
      hasPrivateKey: false,
      lastBackupAt: null,
      lastBackupStatus: null,
      lastBackupFileId: null,
      lastBackupFileName: null,
      autoBackupInterval: "DAILY" as const,
    };
  }
}

export async function saveGoogleDriveConfigAction(data: {
  enabled: boolean;
  clientEmail: string;
  privateKey?: string;
  folderId?: string;
  encryptionKey?: string;
  autoBackupInterval?: 'DAILY' | 'TWICE_DAILY' | 'MANUAL';
}): Promise<{ success: boolean; error?: string }> {
  const role = await requireRole(['doctor', 'admin_doctor'], '/settings');

  try {
    const cleanEmail = (data.clientEmail || "").trim();
    const cleanFolderId = (data.folderId || "").trim();
    const cleanPrivateKey = (data.privateKey || "").trim();
    const cleanEncryptionKey = (data.encryptionKey || "").trim();
    const interval = data.autoBackupInterval || "DAILY";

    // Encrypt sensitive cloud private keys & passphrases at rest using AES-256-GCM (WSTG-CRYP-04)
    const storedPrivateKey = cleanPrivateKey ? encryptPhi(cleanPrivateKey) : undefined;
    const storedEncryptionKey = cleanEncryptionKey ? encryptPhi(cleanEncryptionKey) : undefined;

    // If private key was provided, update it; otherwise preserve existing
    if (storedPrivateKey) {
      sqlite
        .prepare(`
          UPDATE clinic_settings
          SET
            gdrive_backup_enabled = ?,
            gdrive_client_email = ?,
            gdrive_private_key = ?,
            gdrive_folder_id = ?,
            gdrive_auto_backup_interval = ?
            ${storedEncryptionKey ? ', gdrive_encryption_key = ?' : ''}
          WHERE id = 1
        `)
        .run(
          ...(storedEncryptionKey
            ? [data.enabled ? 1 : 0, cleanEmail, storedPrivateKey, cleanFolderId, interval, storedEncryptionKey]
            : [data.enabled ? 1 : 0, cleanEmail, storedPrivateKey, cleanFolderId, interval])
        );
    } else {
      sqlite
        .prepare(`
          UPDATE clinic_settings
          SET
            gdrive_backup_enabled = ?,
            gdrive_client_email = ?,
            gdrive_folder_id = ?,
            gdrive_auto_backup_interval = ?
            ${storedEncryptionKey ? ', gdrive_encryption_key = ?' : ''}
          WHERE id = 1
        `)
        .run(
          ...(storedEncryptionKey
            ? [data.enabled ? 1 : 0, cleanEmail, cleanFolderId, interval, storedEncryptionKey]
            : [data.enabled ? 1 : 0, cleanEmail, cleanFolderId, interval])
        );
    }

    await logAuditEvent({
      action: 'GOOGLE_DRIVE_CONFIG_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Google Drive cloud backup settings updated (Enabled: ${data.enabled}, Target: ${cleanEmail})`,
      status: 'SUCCESS',
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function testGoogleDriveAction(data: {
  clientEmail: string;
  privateKey?: string;
  folderId?: string;
}): Promise<{ success: boolean; message: string }> {
  await requireRole(['doctor', 'admin_doctor'], '/settings');

  let keyToUse = data.privateKey?.trim();
  if (!keyToUse) {
    const existing = sqlite
      .prepare('SELECT gdrive_private_key FROM clinic_settings WHERE id = 1')
      .get() as { gdrive_private_key?: string } | undefined;
    keyToUse = existing?.gdrive_private_key ? decryptPhi(existing.gdrive_private_key) : undefined;
  }

  if (!keyToUse) {
    return { success: false, message: 'Private key is required to test Google Drive authentication.' };
  }

  return testGoogleDriveConnection({
    clientEmail: data.clientEmail.trim(),
    privateKey: keyToUse,
    folderId: data.folderId?.trim(),
  });
}

export async function triggerGoogleDriveBackupNowAction(): Promise<GoogleDriveBackupResult> {
  const role = await requireRole(['doctor', 'admin_doctor'], '/settings');
  const result = await backupDatabaseToGoogleDrive({ actorRole: role.toUpperCase() });
  revalidatePath("/settings");
  return result;
}

