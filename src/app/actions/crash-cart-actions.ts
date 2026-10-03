'use server';

import { requirePermission } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import {
  recordCrashCartAudit,
  getRecentCrashCartAudits,
} from '@/lib/emergency/crash-cart';
import { CrashCartAuditRecord } from '@/types';

/**
 * Records a daily shift crash cart audit inspection.
 */
export async function recordCrashCartAuditAction(
  record: Omit<CrashCartAuditRecord, 'id'>
): Promise<{ success: boolean; recordId?: number; error?: string }> {
  const role = await requirePermission('ipd:nursing_notes');

  try {
    const recordId = recordCrashCartAudit(record);

    await logAuditEvent({
      action: 'IPD_ADMISSION_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Emergency Crash Cart audit completed for ${record.cartLocation} (${record.shift} shift): Status=${record.status}`,
      status: 'SUCCESS',
    });

    return { success: true, recordId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record crash cart audit';
    return { success: false, error: msg };
  }
}

/**
 * Returns recent crash cart audits.
 */
export async function getCrashCartAuditsAction(limit = 10): Promise<{
  success: boolean;
  audits: CrashCartAuditRecord[];
  error?: string;
}> {
  await requirePermission('ipd:view');

  try {
    const audits = getRecentCrashCartAudits(limit);
    return { success: true, audits };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve crash cart audits';
    return { success: false, audits: [], error: msg };
  }
}
