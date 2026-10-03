'use server';

import { requirePermission } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import {
  getHospitalWards,
  getHospitalBeds,
  updateBedStatus,
} from '@/lib/ipd/bed-management';
import { HospitalWard, HospitalBed, BedStatus } from '@/types';

/**
 * Returns all hospital wards and real-time bed statistics.
 */
export async function getHospitalWardsAction(): Promise<{
  success: boolean;
  wards: HospitalWard[];
  error?: string;
}> {
  await requirePermission('ipd:view');

  try {
    const wards = getHospitalWards();
    return { success: true, wards };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve wards';
    return { success: false, wards: [], error: msg };
  }
}

/**
 * Returns all beds, optionally filtered by ward ID.
 */
export async function getHospitalBedsAction(wardId?: number): Promise<{
  success: boolean;
  beds: HospitalBed[];
  error?: string;
}> {
  await requirePermission('ipd:view');

  try {
    const beds = getHospitalBeds(wardId);
    return { success: true, beds };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve beds';
    return { success: false, beds: [], error: msg };
  }
}

/**
 * Updates a bed's status (e.g., marks for cleaning, maintenance, or releases to vacant).
 */
export async function updateBedStatusAction(
  bedId: number,
  status: BedStatus,
  details?: {
    admissionId?: number | null;
    patientName?: string | null;
    patientRegNo?: string | null;
    attendingDoctor?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const role = await requirePermission('ipd:admit_discharge');

  try {
    updateBedStatus(bedId, status, details);

    await logAuditEvent({
      action: 'IPD_ADMISSION_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Bed #${bedId} status updated to ${status}`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update bed status';
    return { success: false, error: msg };
  }
}
