'use server';

import { requireRole, getCurrentUser } from '@/lib/auth';
import {
  calculateDynamicDefcon,
  setDefconOverride,
  getActiveQuarantinedIps,
  quarantineIp,
  pardonQuarantinedIp,
  runMilitarySecurityDrill,
  runThreatHuntingScan,
} from '@/lib/military-sentinel';
import { runMilitaryFleetIntegritySweep } from '@/lib/military-crypto';
import { DefconLevel, DefconThreatStatus, QuarantinedIpRecord, FleetIntegrityReport, ThreatHuntingReport } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getMilitarySecurityDataAction(): Promise<{
  defcon: DefconThreatStatus;
  quarantinedIps: QuarantinedIpRecord[];
}> {
  await requireRole(['doctor', 'admin_doctor'], '/settings');
  const defcon = calculateDynamicDefcon();
  const quarantinedIps = getActiveQuarantinedIps();
  return { defcon, quarantinedIps };
}

export async function setDefconLevelAction(
  level: DefconLevel,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin_doctor'], '/settings');
  const currentUser = await getCurrentUser();
  const doctorName = currentUser?.name || 'Admin Doctor';

  const success = await setDefconOverride(level, reason, doctorName);
  revalidatePath('/settings');
  return { success };
}

export async function runFleetIntegritySweepAction(): Promise<FleetIntegrityReport> {
  await requireRole(['doctor', 'admin_doctor'], '/settings');
  const report = await runMilitaryFleetIntegritySweep();
  revalidatePath('/settings');
  return report;
}

export async function runThreatHuntingScanAction(): Promise<ThreatHuntingReport> {
  await requireRole(['doctor', 'admin_doctor'], '/settings');
  const report = await runThreatHuntingScan();
  revalidatePath('/settings');
  return report;
}

export async function pardonQuarantinedIpAction(
  ipAddress: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin_doctor'], '/settings');
  const currentUser = await getCurrentUser();
  const doctorName = currentUser?.name || 'Admin Doctor';

  const success = await pardonQuarantinedIp(ipAddress, doctorName);
  revalidatePath('/settings');
  return { success };
}

export async function quarantineIpManualAction(
  ipAddress: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin_doctor'], '/settings');
  await quarantineIp(ipAddress, reason);
  revalidatePath('/settings');
  return { success: true };
}

export async function runSecurityDrillAction(
  drillType: 'sqli_probe' | 'xss_probe' | 'tamper_probe' | 'brute_force_probe'
): Promise<{ success: boolean; message: string; quarantined: boolean }> {
  await requireRole(['admin_doctor'], '/settings');
  const result = await runMilitarySecurityDrill(drillType);
  revalidatePath('/settings');
  return result;
}

