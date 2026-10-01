'use server';

import { sqlite } from '@/db';
import { requirePermission, getCurrentUserRole, getCurrentUser, isPharmacist, isDoctor } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { Medication, DispensedItem, PrescriptionDispensation } from '@/types';

export interface PendingPrescriptionItem {
  id: number;
  prescriptionId: number;
  patientId: number;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientPhone?: string | null;
  patientAllergies?: string | null;
  doctorName?: string | null;
  diagnosis?: string | null;
  medications: Medication[];
  createdAt: string;
  dispensationStatus: 'PENDING' | 'DISPENSED' | 'PARTIALLY_DISPENSED';
  dispensedAt?: string | null;
  dispensedBy?: string | null;
}

export interface PendingIpdRoundItem {
  roundId: number;
  admissionId: number;
  patientId: number;
  patientName: string;
  bedName: string;
  doctorOrStaff: string;
  treatmentOrders: string;
  roundDate: string;
  dispensationStatus: 'PENDING' | 'DISPENSED';
}

/**
 * Retrieves pending outpatient prescriptions and inpatient round medication orders
 * for pharmacy review and dispensing.
 */
export async function getPendingPharmacyOrders(params?: {
  search?: string;
  status?: 'all' | 'pending' | 'dispensed';
}): Promise<{
  prescriptions: PendingPrescriptionItem[];
  ipdRounds: PendingIpdRoundItem[];
  stats: {
    totalPending: number;
    dispensedToday: number;
    totalPrescriptions: number;
  };
}> {
  await requirePermission('prescription:view', '/pharmacy');

  try {
    let sql = `
      SELECT 
        p.id as prescription_id,
        p.patient_id,
        p.doctor_name,
        p.diagnosis,
        p.medications,
        p.created_at,
        pt.name as patient_name,
        pt.age as patient_age,
        pt.gender as patient_gender,
        pt.phone as patient_phone,
        pt.allergies as patient_allergies,
        d.id as dispensation_id,
        d.status as disp_status,
        d.dispensed_by,
        d.dispensed_at
      FROM prescriptions p
      JOIN patients pt ON p.patient_id = pt.id
      LEFT JOIN prescription_dispensations d ON p.id = d.prescription_id
      WHERE 1=1
    `;
    const queryParams: (string | number)[] = [];

    if (params?.search && params.search.trim()) {
      sql += ' AND (pt.name LIKE ? OR pt.phone LIKE ? OR p.id = ?)';
      const s = `%${params.search.trim()}%`;
      const num = parseInt(params.search.trim(), 10) || 0;
      queryParams.push(s, s, num);
    }

    if (params?.status === 'pending') {
      sql += ' AND d.id IS NULL';
    } else if (params?.status === 'dispensed') {
      sql += ' AND d.id IS NOT NULL';
    }

    sql += ' ORDER BY p.created_at DESC LIMIT 100';

    const rxRows = sqlite.prepare(sql).all(...queryParams) as {
      prescription_id: number;
      patient_id: number;
      doctor_name?: string | null;
      diagnosis?: string | null;
      medications: string;
      created_at: number;
      patient_name: string;
      patient_age: number;
      patient_gender: string;
      patient_phone?: string | null;
      patient_allergies?: string | null;
      dispensation_id?: number | null;
      disp_status?: string | null;
      dispensed_by?: string | null;
      dispensed_at?: number | null;
    }[];

    const prescriptions: PendingPrescriptionItem[] = rxRows.map((r) => {
      let parsedMeds: Medication[] = [];
      try {
        parsedMeds = JSON.parse(r.medications || '[]');
      } catch {
        parsedMeds = [];
      }

      return {
        id: r.prescription_id,
        prescriptionId: r.prescription_id,
        patientId: r.patient_id,
        patientName: r.patient_name,
        patientAge: r.patient_age,
        patientGender: r.patient_gender,
        patientPhone: r.patient_phone,
        patientAllergies: r.patient_allergies,
        doctorName: r.doctor_name,
        diagnosis: r.diagnosis,
        medications: parsedMeds,
        createdAt: new Date(r.created_at).toISOString(),
        dispensationStatus: r.dispensation_id ? (r.disp_status as any || 'DISPENSED') : 'PENDING',
        dispensedAt: r.dispensed_at ? new Date(r.dispensed_at).toISOString() : null,
        dispensedBy: r.dispensed_by,
      };
    });

    // Also fetch active IPD admitted patients with doctor round orders
    const roundRows = sqlite
      .prepare(`
        SELECT 
          r.id as round_id,
          r.admission_id,
          r.round_date,
          r.doctor_or_staff,
          r.treatment_orders,
          adm.patient_id,
          adm.assigned_bed,
          pt.name as patient_name
        FROM ipd_rounds r
        JOIN ipd_admissions adm ON r.admission_id = adm.id
        JOIN patients pt ON adm.patient_id = pt.id
        WHERE adm.status = 'ADMITTED'
          AND r.treatment_orders IS NOT NULL 
          AND length(trim(r.treatment_orders)) > 0
        ORDER BY r.round_date DESC LIMIT 50
      `)
      .all() as {
        round_id: number;
        admission_id: number;
        round_date: number;
        doctor_or_staff: string;
        treatment_orders: string;
        patient_id: number;
        assigned_bed?: string | null;
        patient_name: string;
      }[];

    const ipdRounds: PendingIpdRoundItem[] = roundRows.map((r) => ({
      roundId: r.round_id,
      admissionId: r.admission_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      bedName: r.assigned_bed || 'General Bed',
      doctorOrStaff: r.doctor_or_staff,
      treatmentOrders: r.treatment_orders,
      roundDate: new Date(r.round_date).toISOString(),
      dispensationStatus: 'PENDING',
    }));

    // Calculate quick stats
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const dispensedTodayCount = sqlite
      .prepare('SELECT COUNT(*) as count FROM prescription_dispensations WHERE dispensed_at >= ?')
      .get(todayMidnight.getTime()) as { count: number } | undefined;

    const pendingCount = prescriptions.filter((p) => p.dispensationStatus === 'PENDING').length;

    return {
      prescriptions,
      ipdRounds,
      stats: {
        totalPending: pendingCount,
        dispensedToday: dispensedTodayCount?.count || 0,
        totalPrescriptions: prescriptions.length,
      },
    };
  } catch (err) {
    console.error('Failed to get pending pharmacy orders:', err);
    return {
      prescriptions: [],
      ipdRounds: [],
      stats: { totalPending: 0, dispensedToday: 0, totalPrescriptions: 0 },
    };
  }
}

/**
 * Dispenses and dispatches prescribed drugs.
 * Updates pharmacy inventory quantities, logs transactions, and records the dispensation audit slip.
 */
export async function dispensePrescriptionMedications(data: {
  prescriptionId?: number;
  admissionId?: number;
  patientId: number;
  dispensationType: 'OPD_PRESCRIPTION' | 'IPD_ROUND_MEDICATION';
  items: DispensedItem[];
  remarks?: string;
}): Promise<{ success: boolean; dispensationId?: number; error?: string }> {
  await requirePermission('pharmacy:dispense', '/pharmacy');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isPharmacist(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Only an authorized Pharmacist or Doctor can dispense medications.' };
  }

  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'At least one medication item must be selected for dispensing.' };
  }

  try {
    const now = Date.now();
    const pharmacistName = user?.name || (role === 'pharmacist' ? 'Hospital Pharmacist' : 'Chief Medical Officer');

    // 1. Record the prescription dispensation record
    const insertDisp = sqlite.prepare(`
      INSERT INTO prescription_dispensations (
        prescription_id, admission_id, patient_id, dispensation_type,
        dispensed_by, dispensed_by_user_id, items_json, status, remarks,
        dispensed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DISPENSED', ?, ?, ?)
    `);

    const result = insertDisp.run(
      data.prescriptionId || null,
      data.admissionId || null,
      data.patientId,
      data.dispensationType,
      pharmacistName,
      user?.id || null,
      JSON.stringify(data.items),
      data.remarks?.trim() || null,
      now,
      now
    );

    const dispensationId = Number(result.lastInsertRowid);

    // 2. Adjust pharmacy inventory for matching stock if available
    for (const item of data.items) {
      if (item.quantityDispensed > 0) {
        // Try to find matching stock in pharmacy inventory by name or batch
        let matchedStock: { id: number; quantity_in_stock: number } | undefined;

        if (item.batchNo && item.batchNo.trim()) {
          matchedStock = sqlite
            .prepare('SELECT id, quantity_in_stock FROM pharmacy_inventory WHERE batch_no = ? LIMIT 1')
            .get(item.batchNo.trim()) as { id: number; quantity_in_stock: number } | undefined;
        }

        if (!matchedStock) {
          matchedStock = sqlite
            .prepare('SELECT id, quantity_in_stock FROM pharmacy_inventory WHERE medicine_name LIKE ? ORDER BY expiry_date ASC LIMIT 1')
            .get(`%${item.medicationName.trim()}%`) as { id: number; quantity_in_stock: number } | undefined;
        }

        if (matchedStock) {
          const qtyToDeduct = Math.min(matchedStock.quantity_in_stock, item.quantityDispensed);
          const newStock = Math.max(0, matchedStock.quantity_in_stock - qtyToDeduct);

          sqlite
            .prepare('UPDATE pharmacy_inventory SET quantity_in_stock = ?, updated_at = ? WHERE id = ?')
            .run(newStock, now, matchedStock.id);

          sqlite
            .prepare(`
              INSERT INTO pharmacy_transactions (
                inventory_id, type, quantity, patient_id, prescription_id, remarks, created_at
              ) VALUES (?, 'DISPENSED', ?, ?, ?, ?, ?)
            `)
            .run(
              matchedStock.id,
              qtyToDeduct,
              data.patientId,
              data.prescriptionId || null,
              `Dispensed by Pharmacist ${pharmacistName} (Dispensation #${dispensationId})`,
              now
            );
        }
      }
    }

    // 3. Log audit event
    await logAuditEvent({
      action: 'MEDICATION_DISPENSED_PHARMACY',
      actorRole: role.toUpperCase(),
      details: `Prescription #${data.prescriptionId || 'IPD'} dispensed by ${pharmacistName} (${data.items.length} drugs dispatched)`,
      status: 'SUCCESS',
    });

    revalidatePath('/pharmacy');
    if (data.prescriptionId) {
      revalidatePath(`/prescription/${data.prescriptionId}`);
    }
    revalidatePath('/inventory');

    return { success: true, dispensationId };
  } catch (err: unknown) {
    console.error('Failed to dispense medications:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Gets historical drug dispensations.
 */
export async function getDispensationHistory(limit = 50): Promise<PrescriptionDispensation[]> {
  await requirePermission('prescription:view', '/pharmacy');

  try {
    const rows = sqlite
      .prepare(`
        SELECT * FROM prescription_dispensations
        ORDER BY dispensed_at DESC
        LIMIT ?
      `)
      .all(limit) as {
        id: number;
        prescription_id?: number | null;
        admission_id?: number | null;
        patient_id?: number | null;
        dispensation_type: 'OPD_PRESCRIPTION' | 'IPD_ROUND_MEDICATION';
        dispensed_by: string;
        dispensed_by_user_id?: number | null;
        items_json: string;
        status: 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'READY_FOR_PICKUP';
        remarks?: string | null;
        dispensed_at: number;
        created_at?: number | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      prescriptionId: r.prescription_id,
      admissionId: r.admission_id,
      patientId: r.patient_id,
      dispensationType: r.dispensation_type,
      dispensedBy: r.dispensed_by,
      dispensedByUserId: r.dispensed_by_user_id,
      items: JSON.parse(r.items_json || '[]'),
      status: r.status,
      remarks: r.remarks,
      dispensedAt: new Date(r.dispensed_at),
      createdAt: r.created_at ? new Date(r.created_at) : null,
    }));
  } catch (err) {
    console.error('Failed to get dispensation history:', err);
    return [];
  }
}
