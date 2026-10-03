import { sqlite } from '@/db';
import { HospitalWard, HospitalBed, BedStatus, BedType } from '@/types';

/**
 * Returns all hospital wards with live occupancy metrics.
 */
export function getHospitalWards(): HospitalWard[] {
  try {
    const wards = sqlite
      .prepare(`
        SELECT 
          w.id, w.name, w.floor, w.type, w.nurse_in_charge,
          COUNT(b.id) as total_beds,
          COUNT(CASE WHEN b.status = 'OCCUPIED' THEN 1 END) as occupied_beds
        FROM hospital_wards w
        LEFT JOIN hospital_beds b ON w.id = b.ward_id
        GROUP BY w.id
        ORDER BY w.id ASC
      `)
      .all() as Array<{
        id: number;
        name: string;
        floor: string;
        type: string;
        nurse_in_charge: string | null;
        total_beds: number;
        occupied_beds: number;
      }>;

    return wards.map((w) => ({
      id: w.id,
      name: w.name,
      floor: w.floor,
      type: w.type as BedType,
      totalBeds: w.total_beds || 0,
      occupiedBeds: w.occupied_beds || 0,
      nurseInCharge: w.nurse_in_charge || undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Returns all beds, optionally filtered by wardId or status.
 */
export function getHospitalBeds(wardId?: number): HospitalBed[] {
  try {
    let query = `
      SELECT 
        id, ward_id, ward_name, bed_number, type, status,
        has_oxygen, has_ventilator, has_monitor, daily_rate,
        current_admission_id, patient_name, patient_reg_no,
        admitted_at, attending_doctor, notes
      FROM hospital_beds
    `;
    const params: any[] = [];

    if (wardId) {
      query += ` WHERE ward_id = ?`;
      params.push(wardId);
    }

    query += ` ORDER BY ward_id ASC, bed_number ASC`;

    const rows = sqlite.prepare(query).all(...params) as Array<{
      id: number;
      ward_id: number;
      ward_name: string;
      bed_number: string;
      type: string;
      status: string;
      has_oxygen: number;
      has_ventilator: number;
      has_monitor: number;
      daily_rate: number;
      current_admission_id: number | null;
      patient_name: string | null;
      patient_reg_no: string | null;
      admitted_at: number | null;
      attending_doctor: string | null;
      notes: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      wardId: r.ward_id,
      wardName: r.ward_name,
      bedNumber: r.bed_number,
      type: r.type as BedType,
      status: r.status as BedStatus,
      hasOxygen: Boolean(r.has_oxygen),
      hasVentilator: Boolean(r.has_ventilator),
      hasMonitor: Boolean(r.has_monitor),
      dailyRate: r.daily_rate,
      currentAdmissionId: r.current_admission_id,
      patientName: r.patient_name,
      patientRegNo: r.patient_reg_no,
      admittedAt: r.admitted_at ? new Date(r.admitted_at) : null,
      attendingDoctor: r.attending_doctor,
      notes: r.notes,
    }));
  } catch {
    return [];
  }
}

/**
 * Updates a hospital bed status (e.g. transfer, mark cleaning, mark vacant).
 */
export function updateBedStatus(
  bedId: number,
  status: BedStatus,
  admissionDetails?: {
    admissionId?: number | null;
    patientName?: string | null;
    patientRegNo?: string | null;
    attendingDoctor?: string | null;
  }
): void {
  const now = Date.now();
  if (status === 'VACANT' || status === 'CLEANING' || status === 'MAINTENANCE') {
    sqlite
      .prepare(`
        UPDATE hospital_beds 
        SET status = ?, current_admission_id = NULL, patient_name = NULL, patient_reg_no = NULL, admitted_at = NULL, attending_doctor = NULL, updated_at = ?
        WHERE id = ?
      `)
      .run(status, now, bedId);
  } else {
    sqlite
      .prepare(`
        UPDATE hospital_beds 
        SET status = ?, 
            current_admission_id = COALESCE(?, current_admission_id),
            patient_name = COALESCE(?, patient_name),
            patient_reg_no = COALESCE(?, patient_reg_no),
            attending_doctor = COALESCE(?, attending_doctor),
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        status,
        admissionDetails?.admissionId ?? null,
        admissionDetails?.patientName ?? null,
        admissionDetails?.patientRegNo ?? null,
        admissionDetails?.attendingDoctor ?? null,
        now,
        bedId
      );
  }
}
