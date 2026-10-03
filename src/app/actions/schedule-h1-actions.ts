'use server';

import { requirePermission } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import {
  recordScheduleH1Dispensation,
  getLowStockAlerts,
  isScheduleH1Drug,
} from '@/lib/pharmacy/schedule-h1';
import { ScheduleH1Record } from '@/types';

/**
 * Records a statutory Schedule H1 / narcotic drug dispensation in the ledger.
 */
export async function recordScheduleH1Action(
  record: Omit<ScheduleH1Record, 'id' | 'verifiedSeal'>
): Promise<{ success: boolean; recordId?: number; error?: string }> {
  const role = await requirePermission('pharmacy:dispense');

  try {
    const recordId = recordScheduleH1Dispensation(record);

    await logAuditEvent({
      action: 'SETTINGS_SAVED',
      actorRole: role.toUpperCase(),
      details: `Statutory Schedule H1 dispensation recorded: ${record.drugName} (Qty: ${record.quantityDispensed}) for ${record.patientName}`,
      status: 'SUCCESS',
    });

    return { success: true, recordId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record Schedule H1 dispensation';
    return { success: false, error: msg };
  }
}

/**
 * Returns recent entries from the statutory Schedule H1 ledger.
 */
export async function getScheduleH1RegisterAction(limit = 50): Promise<{
  success: boolean;
  records: ScheduleH1Record[];
  error?: string;
}> {
  await requirePermission('inventory:view');

  try {
    const rows = sqlite
      .prepare(`
        SELECT 
          id, dispense_date, patient_id, patient_name, patient_contact,
          patient_address, prescribing_doctor_name, prescribing_doctor_reg_no,
          drug_name, batch_number, expiry_date, quantity_dispensed, unit,
          dispensed_by_pharmacist, prescription_ref, verified_seal
        FROM schedule_h1_register
        ORDER BY dispense_date DESC
        LIMIT ?
      `)
      .all(limit) as any[];

    const records: ScheduleH1Record[] = rows.map((r) => ({
      id: r.id,
      dispenseDate: new Date(r.dispense_date),
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientContact: r.patient_contact,
      patientAddress: r.patient_address,
      prescribingDoctorName: r.prescribing_doctor_name,
      prescribingDoctorRegNo: r.prescribing_doctor_reg_no,
      drugName: r.drug_name,
      batchNumber: r.batch_number,
      expiryDate: r.expiry_date,
      quantityDispensed: r.quantity_dispensed,
      unit: r.unit,
      dispensedByPharmacist: r.dispensed_by_pharmacist,
      prescriptionRef: r.prescription_ref,
      verifiedSeal: r.verified_seal,
    }));

    return { success: true, records };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve Schedule H1 register';
    return { success: false, records: [], error: msg };
  }
}

/**
 * Retrieves low-stock and reorder alerts across the clinic pharmacy inventory.
 */
export async function getPharmacyAlertsAction(): Promise<{
  success: boolean;
  alerts: ReturnType<typeof getLowStockAlerts>;
  error?: string;
}> {
  await requirePermission('inventory:view');

  try {
    const alerts = getLowStockAlerts();
    return { success: true, alerts };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve pharmacy alerts';
    return { success: false, alerts: [], error: msg };
  }
}
