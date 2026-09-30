'use server';

import { sqlite } from '@/db';
import { requirePermission, getCurrentUserRole, getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { AppointmentWithPatient, AppointmentStatus, AppointmentType } from '@/types';

export interface AppointmentQueueStats {
  totalToday: number;
  waitingCount: number;
  inConsultationCount: number;
  completedCount: number;
  currentCallingToken?: number | null;
  currentCallingPatient?: string | null;
  currentCallingDoctor?: string | null;
}

export async function getAppointments(dateStr?: string): Promise<{
  appointments: AppointmentWithPatient[];
  stats: AppointmentQueueStats;
}> {
  await requirePermission('appointment:view', '/appointments');

  const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? dateStr.trim()
    : new Date().toISOString().split('T')[0];

  try {
    const rows = sqlite
      .prepare(`
        SELECT
          a.id,
          a.token_no as tokenNo,
          a.appointment_date as appointmentDate,
          a.time_slot as timeSlot,
          a.patient_id as patientId,
          a.doctor_id as doctorId,
          a.doctor_name as doctorName,
          a.type,
          a.status,
          a.chief_complaint as chiefComplaint,
          a.notes,
          a.created_at as createdAt,
          p.id as p_id,
          p.name as p_name,
          p.age as p_age,
          p.gender as p_gender,
          p.phone as p_phone,
          p.reg_no as p_regNo,
          p.allergies as p_allergies,
          p.blood_group as p_bloodGroup,
          p.abha_id as p_abhaId
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.appointment_date = ?
        ORDER BY a.token_no ASC
      `)
      .all(targetDate) as {
        id: number;
        tokenNo: number;
        appointmentDate: string;
        timeSlot?: string | null;
        patientId: number;
        doctorId?: number | null;
        doctorName?: string | null;
        type: AppointmentType;
        status: AppointmentStatus;
        chiefComplaint?: string | null;
        notes?: string | null;
        createdAt?: number | null;
        p_id: number;
        p_name: string;
        p_age: number;
        p_gender: string;
        p_phone?: string | null;
        p_regNo?: string | null;
        p_allergies?: string | null;
        p_bloodGroup?: string | null;
        p_abhaId?: string | null;
      }[];

    const appointments: AppointmentWithPatient[] = rows.map((r) => ({
      id: r.id,
      tokenNo: r.tokenNo,
      appointmentDate: r.appointmentDate,
      timeSlot: r.timeSlot,
      patientId: r.patientId,
      doctorId: r.doctorId,
      doctorName: r.doctorName || 'Dr. On Duty',
      type: r.type,
      status: r.status,
      chiefComplaint: r.chiefComplaint,
      notes: r.notes,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
      patient: {
        id: r.p_id,
        name: r.p_name,
        age: r.p_age,
        gender: r.p_gender,
        phone: r.p_phone || null,
        regNo: r.p_regNo || null,
        allergies: r.p_allergies || null,
        bloodGroup: r.p_bloodGroup || null,
        abhaId: r.p_abhaId || null,
        createdAt: null,
      },
    }));

    let waitingCount = 0;
    let inConsultationCount = 0;
    let completedCount = 0;
    let currentCallingToken: number | null = null;
    let currentCallingPatient: string | null = null;
    let currentCallingDoctor: string | null = null;

    for (const appt of appointments) {
      if (appt.status === 'WAITING') waitingCount++;
      if (appt.status === 'IN_CONSULTATION') {
        inConsultationCount++;
        currentCallingToken = appt.tokenNo;
        currentCallingPatient = appt.patient.name;
        currentCallingDoctor = appt.doctorName || null;
      }
      if (appt.status === 'COMPLETED') completedCount++;
    }

    return {
      appointments,
      stats: {
        totalToday: appointments.length,
        waitingCount,
        inConsultationCount,
        completedCount,
        currentCallingToken,
        currentCallingPatient,
        currentCallingDoctor,
      },
    };
  } catch (err) {
    console.error('Failed to get appointments:', err);
    return {
      appointments: [],
      stats: {
        totalToday: 0,
        waitingCount: 0,
        inConsultationCount: 0,
        completedCount: 0,
      },
    };
  }
}

export async function createAppointment(data: {
  patientId: number;
  appointmentDate: string;
  timeSlot?: string;
  doctorId?: number;
  doctorName?: string;
  type: AppointmentType;
  chiefComplaint?: string;
  notes?: string;
}): Promise<{ success: boolean; tokenNo?: number; error?: string }> {
  await requirePermission('appointment:manage', '/appointments');
  const role = await getCurrentUserRole();

  if (!data.patientId || typeof data.patientId !== 'number' || data.patientId <= 0) {
    return { success: false, error: 'Valid Patient ID is required.' };
  }

  const dateStr = (data.appointmentDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { success: false, error: 'Invalid appointment date format (expected YYYY-MM-DD).' };
  }

  const ALLOWED_TYPES: AppointmentType[] = ['OPD_CONSULTATION', 'FOLLOW_UP', 'VACCINATION', 'EMERGENCY'];
  const apptType: AppointmentType = ALLOWED_TYPES.includes(data.type) ? data.type : 'OPD_CONSULTATION';
  const cleanComplaint = data.chiefComplaint ? data.chiefComplaint.trim().slice(0, 500) : null;
  const cleanNotes = data.notes ? data.notes.trim().slice(0, 1000) : null;
  const cleanTimeSlot = data.timeSlot ? data.timeSlot.trim().slice(0, 50) : null;

  try {
    // Auto-calculate next token number for this date
    const maxRow = sqlite
      .prepare('SELECT MAX(token_no) as maxToken FROM appointments WHERE appointment_date = ?')
      .get(dateStr) as { maxToken?: number | null } | undefined;

    const nextToken = (maxRow?.maxToken || 0) + 1;
    const now = Date.now();

    const docName = (data.doctorName?.trim() || 'Dr. Nitin Hiralal Sonare').slice(0, 100);

    sqlite
      .prepare(`
        INSERT INTO appointments (
          token_no, appointment_date, time_slot, patient_id, doctor_id, doctor_name,
          type, status, chief_complaint, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
      `)
      .run(
        nextToken,
        dateStr,
        cleanTimeSlot,
        data.patientId,
        data.doctorId || null,
        docName,
        apptType,
        cleanComplaint,
        cleanNotes,
        now
      );

    await logAuditEvent({
      action: 'APPOINTMENT_TOKEN_CREATED',
      actorRole: role.toUpperCase(),
      details: `Generated OPD Token #${nextToken} for Patient ID ${data.patientId} on ${dateStr}`,
      status: 'SUCCESS',
    });

    revalidatePath('/appointments');
    revalidatePath('/appointments/queue');
    return { success: true, tokenNo: nextToken };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function updateAppointmentStatus(
  id: number,
  newStatus: AppointmentStatus
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('appointment:manage', '/appointments');
  const role = await getCurrentUserRole();

  const ALLOWED_STATUSES: AppointmentStatus[] = ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return { success: false, error: 'Invalid appointment status.' };
  }
  if (!id || typeof id !== 'number' || id <= 0) {
    return { success: false, error: 'Invalid appointment ID.' };
  }

  try {
    sqlite.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(newStatus, id);

    await logAuditEvent({
      action: 'APPOINTMENT_STATUS_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Updated appointment ID ${id} to ${newStatus}`,
      status: 'SUCCESS',
    });

    revalidatePath('/appointments');
    revalidatePath('/appointments/queue');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function callNextPatientAction(dateStr?: string): Promise<{
  success: boolean;
  calledToken?: number;
  calledPatient?: string;
  error?: string;
}> {
  await requirePermission('appointment:manage', '/appointments');
  const role = await getCurrentUserRole();
  const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? dateStr.trim()
    : new Date().toISOString().split('T')[0];

  try {
    // 1. Mark any active IN_CONSULTATION appointments on this date as COMPLETED
    sqlite
      .prepare("UPDATE appointments SET status = 'COMPLETED' WHERE appointment_date = ? AND status = 'IN_CONSULTATION'")
      .run(targetDate);

    // 2. Find the earliest WAITING appointment
    const nextAppt = sqlite
      .prepare(`
        SELECT a.id, a.token_no as tokenNo, p.name as patientName
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.appointment_date = ? AND a.status = 'WAITING'
        ORDER BY a.token_no ASC
        LIMIT 1
      `)
      .get(targetDate) as { id: number; tokenNo: number; patientName: string } | undefined;

    if (!nextAppt) {
      return { success: false, error: 'No waiting patients in queue for today.' };
    }

    // 3. Mark next as IN_CONSULTATION
    sqlite.prepare("UPDATE appointments SET status = 'IN_CONSULTATION' WHERE id = ?").run(nextAppt.id);

    await logAuditEvent({
      action: 'QUEUE_TOKEN_CALLED',
      actorRole: role.toUpperCase(),
      details: `Called Token #${nextAppt.tokenNo} (${nextAppt.patientName}) to Consulting Room`,
      status: 'SUCCESS',
    });

    revalidatePath('/appointments');
    revalidatePath('/appointments/queue');

    return {
      success: true,
      calledToken: nextAppt.tokenNo,
      calledPatient: nextAppt.patientName,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
