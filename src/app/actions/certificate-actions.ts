'use server';

import { db, sqlite } from '@/db';
import { medicalCertificates, patients, clinicSettings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requirePermission, isDoctor, getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { MedicalCertificate, MedicalCertificateType } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getMedicalCertificatesAction(patientId: number): Promise<MedicalCertificate[]> {
  await requirePermission('certificate:issue');
  const rows = await db
    .select()
    .from(medicalCertificates)
    .where(eq(medicalCertificates.patientId, patientId))
    .orderBy(desc(medicalCertificates.issuedAt));

  return rows as MedicalCertificate[];
}

export async function issueMedicalCertificateAction(params: {
  patientId: number;
  type: MedicalCertificateType;
  diagnosis?: string;
  startDate?: string;
  endDate?: string;
  restDays?: number;
  referralHospital?: string;
  referralSpecialist?: string;
  remarks?: string;
}): Promise<{ success: boolean; certificate?: MedicalCertificate; error?: string }> {
  await requirePermission('certificate:issue');
  const user = await getCurrentUser();
  const doctorAuthorized = !user || isDoctor(user.role);
  if (!doctorAuthorized) {
    return { success: false, error: 'Only registered medical practitioners can issue medical certificates.' };
  }

  const [settings, patient] = await Promise.all([
    db.query.clinicSettings.findFirst(),
    db.query.patients.findFirst({ where: eq(patients.id, params.patientId) }),
  ]);

  if (!patient) {
    return { success: false, error: 'Patient record not found.' };
  }

  const doctorName = user?.name || settings?.doctorName || 'Dr. Medical Officer';
  const doctorRegNo = user?.regNumber || settings?.regNumber || 'REG-PENDING';
  const doctorId = user?.id || null;

  // Generate Certificate Number: CERT-YYYYMMDD-XXXX
  const today = new Date();
  const yyyymmdd = today.toISOString().split('T')[0].replace(/-/g, '');
  const countRow = sqlite
    .prepare('SELECT COUNT(*) as count FROM medical_certificates WHERE certificate_no LIKE ?')
    .get(`CERT-${yyyymmdd}-%`) as { count: number } | undefined;
  const seq = (countRow?.count || 0) + 1;
  const certificateNo = `CERT-${yyyymmdd}-${String(seq).padStart(3, '0')}`;

  try {
    const res = sqlite
      .prepare(`
        INSERT INTO medical_certificates (
          certificate_no, patient_id, doctor_id, doctor_name, doctor_reg_no, type,
          diagnosis, start_date, end_date, rest_days, referral_hospital, referral_specialist, remarks, issued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        certificateNo,
        params.patientId,
        doctorId,
        doctorName,
        doctorRegNo,
        params.type,
        params.diagnosis?.trim() || null,
        params.startDate || null,
        params.endDate || null,
        params.restDays || null,
        params.referralHospital?.trim() || null,
        params.referralSpecialist?.trim() || null,
        params.remarks?.trim() || null,
        Date.now()
      );

    await logAuditEvent({
      action: 'MEDICAL_CERTIFICATE_ISSUED',
      actorRole: 'DOCTOR',
      details: `Issued ${params.type} certificate #${certificateNo} for ${patient.name}`,
      status: 'SUCCESS',
    });

    const certRow = sqlite
      .prepare('SELECT * FROM medical_certificates WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as MedicalCertificate;

    revalidatePath(`/patient/${params.patientId}`);
    return { success: true, certificate: certRow };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to issue medical certificate';
    return { success: false, error: msg };
  }
}
