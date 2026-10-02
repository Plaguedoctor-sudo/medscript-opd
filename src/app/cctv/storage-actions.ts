'use server';

import { requirePermission, isDoctor, getCurrentUserRole, getCurrentUser } from '@/lib/auth';
import {
  getCctvStorageStats,
  getCctvStorageConfig,
  updateCctvStorageConfig,
  getCctvRecordings,
  toggleLockRecording,
  deleteRecording,
  verifyRecordingIntegrity,
  pruneExpiredRecordings,
  seedDefaultRecordingsIfEmpty,
  CctvStorageConfig,
} from '@/lib/cctv/cctv-storage-engine';
import { CctvRecording, CctvStorageStats } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getCctvStorageDataAction(filters?: {
  zone?: string;
  cameraId?: number;
  triggerType?: string;
  isLocked?: boolean;
  limit?: number;
}): Promise<{
  stats: CctvStorageStats;
  config: CctvStorageConfig;
  recordings: CctvRecording[];
}> {
  await requirePermission('cctv:view', '/cctv');
  await seedDefaultRecordingsIfEmpty();

  const stats = getCctvStorageStats();
  const config = getCctvStorageConfig();
  const recordings = getCctvRecordings(filters ? { ...filters, limit: filters.limit || 50 } : { limit: 50 });

  return { stats, config, recordings };
}

export async function updateCctvStorageConfigAction(
  input: Partial<CctvStorageConfig>
): Promise<{ success: boolean; message: string }> {
  const role = await requirePermission('cctv:manage', '/cctv');
  const user = await getCurrentUser();

  try {
    await updateCctvStorageConfig(input, user?.name ? `${user.name} (${role.toUpperCase()})` : role.toUpperCase());
    revalidatePath('/cctv');
    return { success: true, message: 'CCTV storage policy and retention window saved.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Failed to update config' };
  }
}

export async function toggleLockRecordingAction(
  recordingId: number,
  isLocked: boolean,
  lockReason?: string
): Promise<{ success: boolean; message: string }> {
  const role = await requirePermission('cctv:manage', '/cctv');
  const user = await getCurrentUser();

  const result = await toggleLockRecording(
    recordingId,
    isLocked,
    lockReason,
    user?.name ? `${user.name} (${role.toUpperCase()})` : role.toUpperCase()
  );

  revalidatePath('/cctv');
  return result;
}

export async function verifyRecordingIntegrityAction(
  recordingId: number
): Promise<{
  verified: boolean;
  expectedHash: string;
  actualHash?: string;
  isTampered: boolean;
  error?: string;
}> {
  await requirePermission('cctv:view', '/cctv');
  return verifyRecordingIntegrity(recordingId);
}

export async function deleteRecordingAction(
  recordingId: number
): Promise<{ success: boolean; message: string }> {
  const role = await requirePermission('cctv:manage', '/cctv');
  const user = await getCurrentUser();

  const result = await deleteRecording(
    recordingId,
    user?.name ? `${user.name} (${role.toUpperCase()})` : role.toUpperCase()
  );

  revalidatePath('/cctv');
  return result;
}

export async function triggerStoragePruneAction(): Promise<{
  success: boolean;
  prunedCount: number;
  bytesFreedFormatted: string;
  message: string;
}> {
  const role = await requirePermission('cctv:manage', '/cctv');
  const user = await getCurrentUser();

  const res = await pruneExpiredRecordings(user?.name ? `${user.name} (${role.toUpperCase()})` : role.toUpperCase());
  revalidatePath('/cctv');

  return {
    success: true,
    prunedCount: res.prunedCount,
    bytesFreedFormatted: res.bytesFreedFormatted,
    message: res.prunedCount > 0
      ? `Pruned ${res.prunedCount} expired recordings (${res.bytesFreedFormatted} freed).`
      : 'Storage check complete. No recordings require pruning.',
  };
}
