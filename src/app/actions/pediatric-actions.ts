'use server';

import { requirePermission, isDoctor } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import {
  calculatePediatricGrowthMetrics,
  getGrowthReferenceCurves,
} from '@/lib/pediatrics/growth-charts';
import {
  generateChildImmunizationSchedule,
} from '@/lib/pediatrics/immunization-schedule';
import { PediatricGrowthRecord, PatientImmunization } from '@/types';

/**
 * Saves a pediatric growth measurement with automated WHO Z-scores and percentiles.
 */
export async function saveGrowthRecordAction(data: {
  patientId: number;
  gender: 'Male' | 'Female' | 'Other';
  ageMonths: number;
  weightKg: number;
  heightCm: number;
  headCircumferenceCm?: number;
  notes?: string;
  doctorName: string;
}): Promise<{ success: boolean; recordId?: number; error?: string }> {
  const role = await requirePermission('patient:view');

  try {
    const metrics = calculatePediatricGrowthMetrics(
      data.gender,
      data.ageMonths,
      data.weightKg,
      data.heightCm
    );

    const now = Date.now();
    const res = sqlite
      .prepare(`
        INSERT INTO pediatric_growth_records (
          patient_id, recorded_at, age_months, weight_kg, height_cm,
          head_circumference_cm, bmi, weight_for_age_z_score, height_for_age_z_score,
          bmi_for_age_z_score, percentile_weight, percentile_height, notes,
          recorded_by_doctor, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.patientId,
        now,
        data.ageMonths,
        data.weightKg,
        data.heightCm,
        data.headCircumferenceCm || null,
        metrics.bmi,
        metrics.weightForAgeZScore,
        metrics.heightForAgeZScore,
        metrics.bmiForAgeZScore,
        metrics.percentileWeight,
        metrics.percentileHeight,
        data.notes || null,
        data.doctorName,
        now
      );

    await logAuditEvent({
      action: 'PATIENT_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Recorded pediatric growth milestone for patient #${data.patientId}: WZ=${metrics.weightForAgeZScore}, HZ=${metrics.heightForAgeZScore}`,
      status: 'SUCCESS',
    });

    return { success: true, recordId: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record growth measurement';
    return { success: false, error: msg };
  }
}

/**
 * Retrieves pediatric growth history for a patient.
 */
export async function getPatientGrowthRecordsAction(patientId: number): Promise<{
  success: boolean;
  records: PediatricGrowthRecord[];
  curves: { weight: any[]; height: any[] };
  error?: string;
}> {
  await requirePermission('patient:view');

  try {
    const rows = sqlite
      .prepare(`
        SELECT 
          id, patient_id, recorded_at, age_months, weight_kg, height_cm,
          head_circumference_cm, bmi, weight_for_age_z_score, height_for_age_z_score,
          bmi_for_age_z_score, percentile_weight, percentile_height, notes, recorded_by_doctor
        FROM pediatric_growth_records
        WHERE patient_id = ?
        ORDER BY age_months ASC
      `)
      .all(patientId) as any[];

    const patient = sqlite.prepare('SELECT gender FROM patients WHERE id = ?').get(patientId) as { gender?: string } | undefined;
    const gender = (patient?.gender as 'Male' | 'Female') || 'Male';

    const records: PediatricGrowthRecord[] = rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      recordedAt: new Date(r.recorded_at),
      ageMonths: r.age_months,
      weightKg: r.weight_kg,
      heightCm: r.height_cm,
      headCircumferenceCm: r.head_circumference_cm,
      bmi: r.bmi,
      weightForAgeZScore: r.weight_for_age_z_score,
      heightForAgeZScore: r.height_for_age_z_score,
      bmiForAgeZScore: r.bmi_for_age_z_score,
      percentileWeight: r.percentile_weight,
      percentileHeight: r.percentile_height,
      notes: r.notes,
      recordedByDoctor: r.recorded_by_doctor,
    }));

    return {
      success: true,
      records,
      curves: {
        weight: getGrowthReferenceCurves(gender, 'weight'),
        height: getGrowthReferenceCurves(gender, 'height'),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve growth history';
    return { success: false, records: [], curves: { weight: [], height: [] }, error: msg };
  }
}

/**
 * Initializes and retrieves the IAP Immunization Schedule for a pediatric patient.
 */
export async function getOrInitImmunizationScheduleAction(
  patientId: number,
  approxBirthDate?: Date
): Promise<{ success: boolean; immunizations: PatientImmunization[]; error?: string }> {
  await requirePermission('patient:view');

  try {
    let rows = sqlite
      .prepare(`
        SELECT 
          id, patient_id, vaccine_name, vaccine_code, dose_number,
          due_age_months, scheduled_date, administered_date, status,
          batch_number, manufacturer, administered_by, site, route, adverse_reaction, reminder_sent
        FROM patient_immunizations
        WHERE patient_id = ?
        ORDER BY due_age_months ASC, dose_number ASC
      `)
      .all(patientId) as any[];

    if (rows.length === 0) {
      const birth = approxBirthDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const schedule = generateChildImmunizationSchedule(birth);

      const insert = sqlite.prepare(`
        INSERT INTO patient_immunizations (
          patient_id, vaccine_name, vaccine_code, dose_number, due_age_months,
          scheduled_date, status, site, route, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
      `);

      const now = Date.now();
      sqlite.transaction(() => {
        for (const v of schedule) {
          insert.run(
            patientId,
            v.vaccineName,
            v.vaccineCode,
            v.doseNumber,
            v.dueAgeMonths,
            v.scheduledDate.getTime(),
            v.site,
            v.route,
            now
          );
        }
      })();

      rows = sqlite
        .prepare('SELECT * FROM patient_immunizations WHERE patient_id = ? ORDER BY due_age_months ASC, dose_number ASC')
        .all(patientId) as any[];
    }

    const immunizations: PatientImmunization[] = rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      vaccineName: r.vaccine_name,
      vaccineCode: r.vaccine_code,
      doseNumber: r.dose_number,
      dueAgeMonths: r.due_age_months,
      scheduledDate: new Date(r.scheduled_date),
      administeredDate: r.administered_date ? new Date(r.administered_date) : null,
      status: r.status,
      batchNumber: r.batch_number,
      manufacturer: r.manufacturer,
      administeredBy: r.administered_by,
      site: r.site,
      route: r.route,
      adverseReaction: r.adverse_reaction,
      reminderSent: Boolean(r.reminder_sent),
    }));

    return { success: true, immunizations };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve immunization schedule';
    return { success: false, immunizations: [], error: msg };
  }
}

/**
 * Records administration of a vaccine dose.
 */
export async function administerVaccineAction(data: {
  immunizationId: number;
  patientId: number;
  batchNumber: string;
  manufacturer?: string;
  administeredBy: string;
  administeredDate?: Date;
}): Promise<{ success: boolean; error?: string }> {
  const role = await requirePermission('patient:view');

  try {
    const adminDate = data.administeredDate ? data.administeredDate.getTime() : Date.now();

    sqlite
      .prepare(`
        UPDATE patient_immunizations 
        SET status = 'GIVEN', administered_date = ?, batch_number = ?, manufacturer = ?, administered_by = ?
        WHERE id = ? AND patient_id = ?
      `)
      .run(
        adminDate,
        data.batchNumber.trim(),
        data.manufacturer?.trim() || null,
        data.administeredBy.trim(),
        data.immunizationId,
        data.patientId
      );

    await logAuditEvent({
      action: 'PATIENT_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Administered vaccine dose #${data.immunizationId} for patient #${data.patientId}`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to administer vaccine';
    return { success: false, error: msg };
  }
}
