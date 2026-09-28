'use server';

import { sqlite } from '@/db';
import { requirePermission, getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export interface RegisterPatientInput {
  name: string;
  age: number;
  gender: string;
  phone: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  abhaId: string | null;
}

export interface RegisterPatientResult {
  success: boolean;
  patient?: { id: number; name: string; regNo: string | null };
  error?: string;
}

/**
 * Register a new patient — accessible by doctor, admin_doctor, nurse, receptionist.
 * Enforces `patient:register` permission.
 */
export async function registerPatientAction(
  input: RegisterPatientInput
): Promise<RegisterPatientResult> {
  const role = await requirePermission('patient:register', '/patients');
  const user = await getCurrentUser();

  const { name, age, gender, phone, bloodGroup, allergies, abhaId } = input;

  if (!name?.trim() || isNaN(age) || age < 0 || age > 120) {
    return { success: false, error: 'Invalid patient details provided.' };
  }

  // Generate Reg No: YYYYMMDD-N
  const today = new Date();
  const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const countRow = sqlite
    .prepare("SELECT COUNT(*) as count FROM patients WHERE reg_no LIKE ?")
    .get(`${datePrefix}%`) as { count: number } | undefined;
  const nextSeq = (countRow?.count ?? 0) + 1;
  const regNo = `${datePrefix}-${nextSeq}`;

  try {
    const stmt = sqlite.prepare(
      `INSERT INTO patients (name, age, gender, phone, blood_group, allergies, abha_id, reg_no, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      name.trim(),
      age,
      gender,
      phone || null,
      bloodGroup || null,
      allergies?.trim() || null,
      abhaId?.trim() || null,
      regNo,
      Date.now()
    );

    const newId = Number(result.lastInsertRowid);

    await logAuditEvent({
      action: 'PATIENT_CREATED',
      actorRole: role.toUpperCase(),
      details: `Patient "${name}" (Reg: ${regNo}) registered by ${user?.name || role}`,
      status: 'SUCCESS',
    });

    revalidatePath('/patients');

    return {
      success: true,
      patient: { id: newId, name: name.trim(), regNo },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return { success: false, error: msg };
  }
}
