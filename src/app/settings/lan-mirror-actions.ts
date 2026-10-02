'use server';

import { requirePermission, isDoctor, getCurrentUserRole, getCurrentUser } from '@/lib/auth';
import {
  getLanMirrorConfig,
  saveLanMirrorConfig,
  getLanMirrorFullStatus,
  checkPeerHeartbeat,
  syncFromPeer,
  promoteToPrimary,
  LanMirrorConfig,
  LanMirrorStatus,
} from '@/lib/lan-mirroring';
import { revalidatePath } from 'next/cache';

export async function getLanMirrorStatusAction(): Promise<LanMirrorStatus> {
  await requirePermission('settings:clinic', '/settings');
  return getLanMirrorFullStatus();
}

export async function saveLanMirrorConfigAction(
  input: Partial<LanMirrorConfig>
): Promise<{ success: boolean; message: string }> {
  const role = await requirePermission('settings:clinic', '/settings');
  if (!isDoctor(role)) {
    return { success: false, message: 'Forbidden: Only verified doctors can configure LAN clustering.' };
  }

  try {
    const user = await getCurrentUser();
    await saveLanMirrorConfig(input, user?.name || role.toUpperCase());
    revalidatePath('/settings');
    return { success: true, message: 'High Availability LAN Mirroring settings saved.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save config';
    return { success: false, message: msg };
  }
}

export async function testPeerConnectionAction(): Promise<{
  success: boolean;
  reachable: boolean;
  latencyMs: number;
  role?: string;
  nodeName?: string;
  dbHash?: string;
  error?: string;
}> {
  await requirePermission('settings:clinic', '/settings');
  const config = getLanMirrorConfig();

  if (!config.peerUrl) {
    return { success: false, reachable: false, latencyMs: 0, error: 'Peer URL not configured' };
  }

  const result = await checkPeerHeartbeat(config.peerUrl, config.clusterSecret);
  return {
    success: result.reachable,
    reachable: result.reachable,
    latencyMs: result.latencyMs,
    role: result.role,
    nodeName: result.nodeName,
    dbHash: result.dbHash,
    error: result.error,
  };
}

export async function triggerManualSyncAction(): Promise<{ success: boolean; message: string }> {
  const role = await requirePermission('settings:clinic', '/settings');
  const config = getLanMirrorConfig();

  if (!config.peerUrl) {
    return { success: false, message: 'Peer URL is not configured. Please set the peer address.' };
  }

  const result = await syncFromPeer(config.peerUrl, config.clusterSecret);
  revalidatePath('/settings');
  revalidatePath('/');
  return result;
}

export async function promoteToMasterAction(
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const role = await requirePermission('settings:clinic', '/settings');
  if (!isDoctor(role)) {
    return { success: false, message: 'Forbidden: Only doctors can trigger failover promotion.' };
  }

  const user = await getCurrentUser();
  const actorRole = user?.name ? `${user.name} (${role.toUpperCase()})` : role.toUpperCase();
  const result = await promoteToPrimary(actorRole, reason || 'Emergency failover promotion invoked from Settings UI');

  revalidatePath('/settings');
  revalidatePath('/');
  return result;
}
