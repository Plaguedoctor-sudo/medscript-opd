import crypto from 'crypto';
import { sqlite } from '@/db';
import { getSessionSecret } from '@/lib/auth';
import { ScheduleH1Record } from '@/types';

// The 46 official Schedule H1 drugs under Drugs and Cosmetics Rules (3rd Amendment, 2013)
export const SCHEDULE_H1_DRUG_NAMES = [
  'Alprazolam', 'Balofloxacin', 'Buprenorphine', 'Capreomycin', 'Cefdinir',
  'Cefditoren', 'Cefixime', 'Cefoperazone', 'Cefotaxime', 'Cefpirome',
  'Cefpodoxime', 'Ceftazidime', 'Ceftriaxone', 'Cefuroxime', 'Chlordiazepoxide',
  'Clofazimine', 'Clonazepam', 'Clorazepate', 'Cycloserine', 'Diazepam',
  'Diphenoxylate', 'Doripenem', 'Ertapenem', 'Ethambutol', 'Ethionamide',
  'Feropenem', 'Flurazepam', 'Gatifloxacin', 'Gemifloxacin', 'Imipenem',
  'Isoniazid', 'Levofloxacin', 'Meropenem', 'Midazolam', 'Moxifloxacin',
  'Nitrazepam', 'Oxazepam', 'Paromomycin', 'Pentazocine', 'Pyrazinamide',
  'Rifabutin', 'Rifampicin', 'Sodium Oxybate', 'Sparfloxacin', 'Thiacetazone',
  'Tramadol', 'Zolpidem'
];

/**
 * Checks if a drug name matches any Schedule H1 controlled substance.
 */
export function isScheduleH1Drug(drugName: string): boolean {
  const clean = drugName.toLowerCase();
  return SCHEDULE_H1_DRUG_NAMES.some((h1) => clean.includes(h1.toLowerCase()));
}

/**
 * Computes deterministic HMAC digital seal for a Schedule H1 dispensation entry.
 */
export function computeScheduleH1Seal(record: {
  dispenseDate: Date;
  patientName: string;
  patientContact: string;
  prescribingDoctorRegNo: string;
  drugName: string;
  batchNumber: string;
  quantityDispensed: number;
  dispensedByPharmacist: string;
}): string {
  const secret = getSessionSecret();
  const canonical = [
    record.dispenseDate.toISOString().slice(0, 10),
    record.patientName.trim(),
    record.patientContact.trim(),
    record.prescribingDoctorRegNo.trim(),
    record.drugName.trim(),
    record.batchNumber.trim(),
    record.quantityDispensed,
    record.dispensedByPharmacist.trim(),
  ].join('::');

  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Records a Schedule H1 dispensation in the statutory register with tamper-evident seal.
 */
export function recordScheduleH1Dispensation(record: Omit<ScheduleH1Record, 'id' | 'verifiedSeal'>): number {
  const seal = computeScheduleH1Seal({
    dispenseDate: record.dispenseDate,
    patientName: record.patientName,
    patientContact: record.patientContact,
    prescribingDoctorRegNo: record.prescribingDoctorRegNo,
    drugName: record.drugName,
    batchNumber: record.batchNumber,
    quantityDispensed: record.quantityDispensed,
    dispensedByPharmacist: record.dispensedByPharmacist,
  });

  const res = sqlite
    .prepare(`
      INSERT INTO schedule_h1_register (
        dispense_date, patient_id, patient_name, patient_contact, patient_address,
        prescribing_doctor_name, prescribing_doctor_reg_no, drug_name, batch_number,
        expiry_date, quantity_dispensed, unit, dispensed_by_pharmacist, prescription_ref,
        verified_seal, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.dispenseDate.getTime(),
      record.patientId || null,
      record.patientName,
      record.patientContact,
      record.patientAddress || null,
      record.prescribingDoctorName,
      record.prescribingDoctorRegNo,
      record.drugName,
      record.batchNumber,
      record.expiryDate,
      record.quantityDispensed,
      record.unit || 'TABLETS',
      record.dispensedByPharmacist,
      record.prescriptionRef || null,
      seal,
      Date.now()
    );

  return Number(res.lastInsertRowid);
}

/**
 * Retrieves low-stock inventory alerts based on reorder thresholds.
 */
export function getLowStockAlerts(): Array<{
  id: number;
  name: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  isScheduleH1: boolean;
  alertLevel: 'CRITICAL_OUT_OF_STOCK' | 'LOW_STOCK';
}> {
  try {
    const rows = sqlite
      .prepare(`
        SELECT id, name, batch_number, quantity, unit
        FROM inventory_items
        WHERE quantity <= 20
        ORDER BY quantity ASC
        LIMIT 20
      `)
      .all() as Array<{ id: number; name: string; batch_number: string; quantity: number; unit: string }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      batchNumber: r.batch_number,
      quantity: r.quantity,
      unit: r.unit,
      isScheduleH1: isScheduleH1Drug(r.name),
      alertLevel: r.quantity === 0 ? 'CRITICAL_OUT_OF_STOCK' : 'LOW_STOCK',
    }));
  } catch {
    return [];
  }
}
