'use server';

import { db, sqlite } from '@/db';
import { patients, appointments, clinicSettings } from '@/db/schema';
import { eq, like, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/audit';
import { getClientIp, checkKioskLookupRateLimit, recordKioskLookupAttempt } from '@/lib/rate-limiter';

export interface SelfCheckinInput {
  patientId?: number;
  name?: string;
  age?: number;
  gender?: string;
  phone: string;
  bloodGroup?: string;
  allergies?: string;
  chiefComplaint?: string;
}

export interface SelfCheckinResult {
  success: boolean;
  tokenNo?: number;
  patientId?: number;
  patientName?: string;
  regNo?: string;
  waitingAhead?: number;
  clinicName?: string;
  doctorName?: string;
  error?: string;
}

/**
 * Look up returning patient by 10-digit phone number
 */
export async function lookupReturningPatientAction(rawPhone: string): Promise<{
  found: boolean;
  error?: string;
  patient?: {
    id: number;
    name: string;
    age: number;
    gender: string;
    phone: string | null;
    regNo: string | null;
    allergies: string | null;
    bloodGroup: string | null;
  };
}> {
  const clientIp = await getClientIp();
  const rateLimit = checkKioskLookupRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return {
      found: false,
      error: `Too many lookup attempts from this device. Please wait ${rateLimit.retryAfterSeconds} seconds or speak to the receptionist.`,
    };
  }
  recordKioskLookupAttempt(clientIp);

  const clean = rawPhone.replace(/\D/g, '');
  if (clean.length < 10) return { found: false };

  const last10 = clean.slice(-10);

  try {
    const row = sqlite
      .prepare(`
        SELECT id, name, age, gender, phone, reg_no as regNo, allergies, blood_group as bloodGroup
        FROM patients
        WHERE phone LIKE ?
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(`%${last10}`) as any;

    if (row) {
      return { found: true, patient: row };
    }
    return { found: false };
  } catch (err) {
    console.error('Patient lookup error:', err);
    return { found: false };
  }
}

/**
 * Register or check-in patient and issue today's OPD token
 */
export async function selfCheckinAction(data: SelfCheckinInput): Promise<SelfCheckinResult> {
  try {
    const cleanPhone = (data.phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: 'A valid 10-digit mobile number is required.' };
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const settings = await db.query.clinicSettings.findFirst();
    const clinicName = settings?.clinicName || 'Clinic OPD';
    const doctorName = settings?.doctorName || 'Dr. On Duty';

    let patientId = data.patientId;
    let patientName = data.name?.trim() || '';
    let regNo = '';

    if (patientId) {
      // Returning patient
      const pat = await db.query.patients.findFirst({ where: eq(patients.id, patientId) });
      if (pat) {
        patientName = pat.name;
        regNo = pat.regNo || `PAT-${pat.id}`;
      } else {
        patientId = undefined;
      }
    }

    if (!patientId) {
      // New patient registration
      if (!patientName) {
        return { success: false, error: 'Patient full name is required for new registration.' };
      }
      const age = Math.max(0, Math.min(Number(data.age) || 30, 130));
      const gender = ['Male', 'Female', 'Other'].includes(data.gender || '') ? data.gender! : 'Other';

      // Generate regNo
      const yyyymmdd = todayDate.replace(/-/g, '');
      const maxReg = sqlite
        .prepare('SELECT MAX(id) as maxId FROM patients')
        .get() as { maxId?: number } | undefined;
      const nextSeq = (maxReg?.maxId || 0) + 1;
      regNo = `REG-${yyyymmdd}-${String(nextSeq).padStart(3, '0')}`;

      const [insertedPat] = await db
        .insert(patients)
        .values({
          name: patientName.slice(0, 100),
          age,
          gender,
          phone: cleanPhone,
          regNo,
          allergies: data.allergies?.trim().slice(0, 200) || null,
          bloodGroup: data.bloodGroup?.trim().slice(0, 10) || null,
          createdAt: new Date(),
        })
        .returning({ id: patients.id });

      patientId = insertedPat.id;
    }

    // Check if patient is already waiting in queue today
    const alreadyWaiting = sqlite
      .prepare(`
        SELECT token_no FROM appointments
        WHERE patient_id = ? AND appointment_date = ? AND status IN ('WAITING', 'IN_CONSULTATION')
        LIMIT 1
      `)
      .get(patientId, todayDate) as { token_no?: number } | undefined;

    if (alreadyWaiting && alreadyWaiting.token_no) {
      // Return existing token
      const waitingCount = sqlite
        .prepare(`
          SELECT COUNT(*) as cnt FROM appointments
          WHERE appointment_date = ? AND status = 'WAITING' AND token_no < ?
        `)
        .get(todayDate, alreadyWaiting.token_no) as { cnt: number };

      return {
        success: true,
        tokenNo: alreadyWaiting.token_no,
        patientId,
        patientName,
        regNo,
        waitingAhead: waitingCount.cnt,
        clinicName,
        doctorName,
      };
    }

    // Allocate next token for today
    const maxTokenRow = sqlite
      .prepare('SELECT MAX(token_no) as maxToken FROM appointments WHERE appointment_date = ?')
      .get(todayDate) as { maxToken?: number | null } | undefined;
    const nextToken = (maxTokenRow?.maxToken || 0) + 1;

    // Count patients waiting ahead
    const waitingCount = sqlite
      .prepare(`
        SELECT COUNT(*) as cnt FROM appointments
        WHERE appointment_date = ? AND status = 'WAITING'
      `)
      .get(todayDate) as { cnt: number };

    // Insert into appointments
    sqlite
      .prepare(`
        INSERT INTO appointments (
          token_no, appointment_date, time_slot, patient_id, doctor_id, doctor_name,
          type, status, chief_complaint, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
      `)
      .run(
        nextToken,
        todayDate,
        'Walk-in / Kiosk',
        patientId,
        settings?.id || 1,
        doctorName,
        'OPD_CONSULTATION',
        data.chiefComplaint?.trim().slice(0, 300) || 'Walk-in Consultation',
        'Self Check-in via Waiting Room Kiosk',
        Date.now()
      );

    await logAuditEvent({
      action: 'PATIENT_SELF_CHECKIN',
      actorRole: 'PATIENT_KIOSK',
      details: `Self check-in generated OPD Token #${nextToken} for ${patientName} (${regNo || `ID: ${patientId}`})`,
      status: 'SUCCESS',
    });

    revalidatePath('/appointments');
    revalidatePath('/appointments/queue');

    return {
      success: true,
      tokenNo: nextToken,
      patientId,
      patientName,
      regNo,
      waitingAhead: waitingCount.cnt,
      clinicName,
      doctorName,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Self checkin error:', err);
    return { success: false, error: msg };
  }
}

/**
 * Fetch kiosk clinic header details
 */
export async function getKioskClinicInfoAction(): Promise<{
  clinicName: string;
  doctorName: string;
  qualifications: string;
  address: string;
  logoUrl?: string | null;
  currentCallingToken?: number | null;
  totalWaiting: number;
}> {
  try {
    const settings = await db.query.clinicSettings.findFirst();
    const today = new Date().toISOString().split('T')[0];

    const calling = sqlite
      .prepare("SELECT token_no FROM appointments WHERE appointment_date = ? AND status = 'IN_CONSULTATION' ORDER BY token_no DESC LIMIT 1")
      .get(today) as { token_no?: number } | undefined;

    const waiting = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ? AND status = 'WAITING'")
      .get(today) as { cnt: number };

    return {
      clinicName: settings?.clinicName || 'Clinic OPD',
      doctorName: settings?.doctorName || 'Dr. Physician',
      qualifications: settings?.qualifications || 'MBBS',
      address: settings?.address || 'OPD Consulting Suite',
      logoUrl: settings?.logoUrl || null,
      currentCallingToken: calling?.token_no || null,
      totalWaiting: waiting.cnt || 0,
    };
  } catch {
    return {
      clinicName: 'Clinic OPD',
      doctorName: 'Dr. Physician',
      qualifications: 'MBBS',
      address: 'OPD Suite',
      currentCallingToken: null,
      totalWaiting: 0,
    };
  }
}
