import { sqlite } from '@/db';
import { CrashCartAuditRecord } from '@/types';

/**
 * Records a daily shift crash cart audit inspection.
 */
export function recordCrashCartAudit(record: Omit<CrashCartAuditRecord, 'id'>): number {
  const res = sqlite
    .prepare(`
      INSERT INTO crash_cart_audits (
        audit_date, shift, cart_location, seal_number, seal_intact,
        defibrillator_test_passed, laryngoscope_blades_tested, suction_machine_tested,
        oxygen_cylinder_pressure_psi, ambubag_tested, expired_drugs_found,
        expired_drugs_details, missing_items_reported, audited_by_nurse,
        verified_by_doctor, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.auditDate.getTime(),
      record.shift,
      record.cartLocation,
      record.sealNumber,
      record.sealIntact ? 1 : 0,
      record.defibrillatorTestPassed ? 1 : 0,
      record.laryngoscopeBladesTested ? 1 : 0,
      record.suctionMachineTested ? 1 : 0,
      record.oxygenCylinderPressurePsi,
      record.ambubagTested ? 1 : 0,
      record.expiredDrugsFound ? 1 : 0,
      record.expiredDrugsDetails || null,
      record.missingItemsReported || null,
      record.auditedByNurse,
      record.verifiedByDoctor || null,
      record.status,
      Date.now()
    );

  return Number(res.lastInsertRowid);
}

/**
 * Returns recent crash cart audits.
 */
export function getRecentCrashCartAudits(limit = 10): CrashCartAuditRecord[] {
  try {
    const rows = sqlite
      .prepare(`
        SELECT 
          id, audit_date, shift, cart_location, seal_number, seal_intact,
          defibrillator_test_passed, laryngoscope_blades_tested, suction_machine_tested,
          oxygen_cylinder_pressure_psi, ambubag_tested, expired_drugs_found,
          expired_drugs_details, missing_items_reported, audited_by_nurse,
          verified_by_doctor, status
        FROM crash_cart_audits
        ORDER BY audit_date DESC, id DESC
        LIMIT ?
      `)
      .all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      auditDate: new Date(r.audit_date),
      shift: r.shift,
      cartLocation: r.cart_location,
      sealNumber: r.seal_number,
      sealIntact: Boolean(r.seal_intact),
      defibrillatorTestPassed: Boolean(r.defibrillator_test_passed),
      laryngoscopeBladesTested: Boolean(r.laryngoscope_blades_tested),
      suctionMachineTested: Boolean(r.suction_machine_tested),
      oxygenCylinderPressurePsi: r.oxygen_cylinder_pressure_psi,
      ambubagTested: Boolean(r.ambubag_tested),
      expiredDrugsFound: Boolean(r.expired_drugs_found),
      expiredDrugsDetails: r.expired_drugs_details,
      missingItemsReported: r.missing_items_reported,
      auditedByNurse: r.audited_by_nurse,
      verifiedByDoctor: r.verified_by_doctor,
      status: r.status,
    }));
  } catch {
    return [];
  }
}
