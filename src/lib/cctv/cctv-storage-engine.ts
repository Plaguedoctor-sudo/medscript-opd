import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import { CctvRecording, CctvStorageStats, CctvTriggerType, CctvZone } from '@/types';

export interface CctvStorageConfig {
  storagePath: string;
  retentionDays: number;
  maxStorageGb: number;
  autoPurgeEnabled: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Retrieves the CCTV NVR storage configuration from clinic_settings.
 */
export function getCctvStorageConfig(): CctvStorageConfig {
  try {
    const row = sqlite
      .prepare(`
        SELECT 
          cctv_storage_path,
          cctv_retention_days,
          cctv_max_storage_gb,
          cctv_auto_purge_enabled
        FROM clinic_settings 
        WHERE id = 1
      `)
      .get() as {
        cctv_storage_path?: string;
        cctv_retention_days?: number;
        cctv_max_storage_gb?: number;
        cctv_auto_purge_enabled?: number;
      } | undefined;

    return {
      storagePath: row?.cctv_storage_path || 'cctv_recordings',
      retentionDays: row?.cctv_retention_days ?? 30,
      maxStorageGb: row?.cctv_max_storage_gb ?? 50,
      autoPurgeEnabled: row?.cctv_auto_purge_enabled !== undefined ? Boolean(row.cctv_auto_purge_enabled) : true,
    };
  } catch {
    return {
      storagePath: 'cctv_recordings',
      retentionDays: 30,
      maxStorageGb: 50,
      autoPurgeEnabled: true,
    };
  }
}

/**
 * Updates CCTV storage and retention settings.
 */
export async function updateCctvStorageConfig(
  config: Partial<CctvStorageConfig>,
  actorRole = 'DOCTOR'
): Promise<void> {
  const current = getCctvStorageConfig();
  const storagePath = config.storagePath ? config.storagePath.trim() : current.storagePath;
  const retentionDays = config.retentionDays !== undefined ? Number(config.retentionDays) : current.retentionDays;
  const maxStorageGb = config.maxStorageGb !== undefined ? Number(config.maxStorageGb) : current.maxStorageGb;
  const autoPurgeEnabled = config.autoPurgeEnabled !== undefined ? (config.autoPurgeEnabled ? 1 : 0) : (current.autoPurgeEnabled ? 1 : 0);

  sqlite
    .prepare(`
      UPDATE clinic_settings 
      SET 
        cctv_storage_path = ?,
        cctv_retention_days = ?,
        cctv_max_storage_gb = ?,
        cctv_auto_purge_enabled = ?
      WHERE id = 1
    `)
    .run(storagePath, retentionDays, maxStorageGb, autoPurgeEnabled);

  await logAuditEvent({
    action: 'SYSTEM_CONFIG_UPDATED',
    actorRole,
    details: `Updated CCTV storage policy: Retention=${retentionDays} days, MaxStorage=${maxStorageGb} GB, AutoPurge=${Boolean(autoPurgeEnabled)}`,
    status: 'SUCCESS',
  });
}

/**
 * Computes storage metrics, disk consumption, and retention breakdowns.
 */
export function getCctvStorageStats(): CctvStorageStats {
  const config = getCctvStorageConfig();

  interface RecordingRow {
    file_size_bytes: number;
    zone: string;
    trigger_type: string;
    is_locked: number;
    start_time: number;
  }

  const rows = sqlite
    .prepare('SELECT file_size_bytes, zone, trigger_type, is_locked, start_time FROM hospital_cctv_recordings')
    .all() as RecordingRow[];

  let totalSizeBytes = 0;
  let lockedCount = 0;
  let lockedSizeBytes = 0;
  let oldestTime: number | null = null;
  let newestTime: number | null = null;

  const zoneBreakdown: Record<string, { count: number; sizeBytes: number; sizeFormatted: string }> = {};
  const triggerBreakdown: Record<CctvTriggerType, number> = {
    CONTINUOUS: 0,
    MOTION: 0,
    INCIDENT: 0,
    MANUAL: 0,
  };

  for (const r of rows) {
    const bytes = Number(r.file_size_bytes) || 0;
    totalSizeBytes += bytes;

    if (r.is_locked) {
      lockedCount++;
      lockedSizeBytes += bytes;
    }

    if (r.start_time) {
      if (oldestTime === null || r.start_time < oldestTime) oldestTime = r.start_time;
      if (newestTime === null || r.start_time > newestTime) newestTime = r.start_time;
    }

    // Zone
    if (!zoneBreakdown[r.zone]) {
      zoneBreakdown[r.zone] = { count: 0, sizeBytes: 0, sizeFormatted: '0 B' };
    }
    zoneBreakdown[r.zone].count++;
    zoneBreakdown[r.zone].sizeBytes += bytes;
    zoneBreakdown[r.zone].sizeFormatted = formatBytes(zoneBreakdown[r.zone].sizeBytes);

    // Trigger
    const t = (r.trigger_type || 'CONTINUOUS') as CctvTriggerType;
    if (triggerBreakdown[t] !== undefined) {
      triggerBreakdown[t]++;
    }
  }

  const maxStorageBytes = config.maxStorageGb * 1024 * 1024 * 1024;
  const usedPercentage = maxStorageBytes > 0 ? Math.min(100, Math.round((totalSizeBytes / maxStorageBytes) * 100)) : 0;

  return {
    totalRecordings: rows.length,
    totalSizeBytes,
    totalSizeFormatted: formatBytes(totalSizeBytes),
    maxStorageGb: config.maxStorageGb,
    usedPercentage,
    retentionDays: config.retentionDays,
    oldestRecordingAt: oldestTime ? new Date(oldestTime) : null,
    newestRecordingAt: newestTime ? new Date(newestTime) : null,
    lockedRecordingsCount: lockedCount,
    lockedRecordingsSizeFormatted: formatBytes(lockedSizeBytes),
    autoPurgeEnabled: config.autoPurgeEnabled,
    zoneBreakdown,
    triggerBreakdown,
  };
}

/**
 * Saves a new CCTV recorded segment with SHA-256 seal.
 */
export async function saveRecordingSegment(data: {
  cameraId: number;
  cameraName: string;
  zone: CctvZone;
  durationSeconds: number;
  startTime: Date;
  endTime: Date;
  triggerType: CctvTriggerType;
  incidentId?: number | null;
  buffer?: Buffer;
  thumbnailData?: string;
}): Promise<CctvRecording> {
  const config = getCctvStorageConfig();
  const rootDir = path.isAbsolute(config.storagePath)
    ? config.storagePath
    : path.resolve(process.cwd(), config.storagePath);

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true, mode: 0o700 });
  }

  const timestampStr = data.startTime.toISOString().replace(/[:.]/g, '-');
  const filename = `cctv-${data.zone.toLowerCase()}-${data.cameraId}-${timestampStr}.mp4`;
  const fullPath = path.join(rootDir, filename);

  const fileBuffer = data.buffer || Buffer.from(`[MEDSCRIPT-CCTV-STREAM-SEGMENT: ${filename}]`);
  fs.writeFileSync(fullPath, fileBuffer);

  try {
    fs.chmodSync(fullPath, 0o600);
  } catch {}

  const checksumSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const fileSizeBytes = fileBuffer.length;
  const now = Date.now();

  const res = sqlite
    .prepare(`
      INSERT INTO hospital_cctv_recordings (
        camera_id, camera_name, zone, filename, file_path, file_size_bytes,
        duration_seconds, start_time, end_time, trigger_type, incident_id,
        is_locked, checksum_sha256, thumbnail_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `)
    .run(
      data.cameraId,
      data.cameraName,
      data.zone,
      filename,
      fullPath,
      fileSizeBytes,
      data.durationSeconds,
      data.startTime.getTime(),
      data.endTime.getTime(),
      data.triggerType,
      data.incidentId || null,
      checksumSha256,
      data.thumbnailData || null,
      now
    );

  const newId = Number(res.lastInsertRowid);

  // Auto-prune if enabled and storage exceeds 90% quota
  if (config.autoPurgeEnabled) {
    try {
      const maxBytes = config.maxStorageGb * 1024 * 1024 * 1024;
      const totalRow = sqlite.prepare('SELECT SUM(file_size_bytes) as total FROM hospital_cctv_recordings').get() as { total: number | null } | undefined;
      if (totalRow?.total && totalRow.total > maxBytes * 0.9) {
        await pruneExpiredRecordings();
      }
    } catch (pruneErr) {
      console.warn('Auto-prune check failed:', pruneErr);
    }
  }

  return {
    id: newId,
    cameraId: data.cameraId,
    cameraName: data.cameraName,
    zone: data.zone,
    filename,
    filePath: fullPath,
    fileSizeBytes,
    durationSeconds: data.durationSeconds,
    startTime: data.startTime,
    endTime: data.endTime,
    triggerType: data.triggerType,
    incidentId: data.incidentId || null,
    isLocked: false,
    lockReason: null,
    checksumSha256,
    thumbnailData: data.thumbnailData || null,
    createdAt: new Date(now),
  };
}

/**
 * Prunes expired and excess recordings according to retention policy.
 * NEVER deletes locked evidence (is_locked = 1).
 * Complies with NIST SP 800-88 zeroization before unlink.
 */
export async function pruneExpiredRecordings(actorRole = 'SYSTEM'): Promise<{
  prunedCount: number;
  bytesFreed: number;
  bytesFreedFormatted: string;
}> {
  const config = getCctvStorageConfig();
  const now = Date.now();
  const cutoffTime = now - config.retentionDays * 86400 * 1000;
  const maxBytes = config.maxStorageGb * 1024 * 1024 * 1024;

  // 1. Find recordings older than retention window that are NOT locked
  interface CandidateRow {
    id: number;
    file_path: string;
    file_size_bytes: number;
    filename: string;
  }

  const expiredCandidates = sqlite
    .prepare(`
      SELECT id, file_path, file_size_bytes, filename 
      FROM hospital_cctv_recordings 
      WHERE is_locked = 0 AND start_time < ?
      ORDER BY start_time ASC
    `)
    .all(cutoffTime) as CandidateRow[];

  let toPrune: CandidateRow[] = [...expiredCandidates];

  // 2. Check if total size exceeds max quota even after time-based expiry
  const totalRow = sqlite
    .prepare('SELECT SUM(file_size_bytes) as total FROM hospital_cctv_recordings')
    .get() as { total: number | null } | undefined;
  let currentTotal = totalRow?.total || 0;

  // If still above quota, prune oldest unlocked recordings until under 85% capacity
  if (currentTotal > maxBytes) {
    const targetSize = maxBytes * 0.85;
    const existingIds = new Set(toPrune.map((p) => p.id));
    const sizeCandidates = sqlite
      .prepare(`
        SELECT id, file_path, file_size_bytes, filename 
        FROM hospital_cctv_recordings 
        WHERE is_locked = 0
        ORDER BY start_time ASC
      `)
      .all() as CandidateRow[];

    for (const cand of sizeCandidates) {
      if (currentTotal <= targetSize) break;
      if (!existingIds.has(cand.id)) {
        toPrune.push(cand);
        existingIds.add(cand.id);
        currentTotal -= cand.file_size_bytes;
      }
    }
  }

  let prunedCount = 0;
  let bytesFreed = 0;

  for (const cand of toPrune) {
    try {
      if (fs.existsSync(cand.file_path)) {
        // Zeroize before file deletion (NIST SP 800-88)
        try {
          const size = fs.statSync(cand.file_path).size;
          fs.writeFileSync(cand.file_path, Buffer.alloc(size, 0));
        } catch {}
        fs.unlinkSync(cand.file_path);
      }
    } catch {
      // File already removed or permission issue
    }

    sqlite.prepare('DELETE FROM hospital_cctv_recordings WHERE id = ?').run(cand.id);
    prunedCount++;
    bytesFreed += cand.file_size_bytes;
  }

  if (prunedCount > 0) {
    await logAuditEvent({
      action: 'SYSTEM_CONFIG_UPDATED',
      actorRole,
      details: `CCTV Storage Retention Prune: Zeroized and removed ${prunedCount} unlocked recording segments (${formatBytes(bytesFreed)} freed).`,
      status: 'SUCCESS',
    });
  }

  return {
    prunedCount,
    bytesFreed,
    bytesFreedFormatted: formatBytes(bytesFreed),
  };
}

/**
 * Toggles evidence lock status to permanently protect or release recordings.
 */
export async function toggleLockRecording(
  recordingId: number,
  isLocked: boolean,
  lockReason?: string,
  actorRole = 'DOCTOR'
): Promise<{ success: boolean; message: string }> {
  try {
    const now = Date.now();
    sqlite
      .prepare(`
        UPDATE hospital_cctv_recordings 
        SET is_locked = ?, lock_reason = ? 
        WHERE id = ?
      `)
      .run(isLocked ? 1 : 0, lockReason?.trim() || null, recordingId);

    await logAuditEvent({
      action: isLocked ? 'CCTV_INCIDENT_FLAGGED' : 'CCTV_INCIDENT_ACKNOWLEDGED',
      actorRole,
      details: `${isLocked ? 'LOCKED' : 'UNLOCKED'} CCTV recording evidence id=${recordingId}. Reason: ${lockReason || 'None provided'}`,
      status: 'SUCCESS',
    });

    return {
      success: true,
      message: isLocked
        ? 'Recording locked as permanent medico-legal evidence. Exempt from auto-purge.'
        : 'Recording unlocked. Eligible for standard rolling retention.',
    };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lock update failed' };
  }
}

/**
 * Verifies cryptographic SHA-256 seal of a recording against stored checksum.
 * Satisfies Section 65B Indian Evidence Act / BSA electronic records admissibility.
 */
export async function verifyRecordingIntegrity(recordingId: number): Promise<{
  verified: boolean;
  expectedHash: string;
  actualHash?: string;
  isTampered: boolean;
  error?: string;
}> {
  const row = sqlite
    .prepare('SELECT file_path, checksum_sha256 FROM hospital_cctv_recordings WHERE id = ?')
    .get(recordingId) as { file_path: string; checksum_sha256: string } | undefined;

  if (!row) {
    return { verified: false, expectedHash: '', isTampered: false, error: 'Recording record not found' };
  }

  if (!fs.existsSync(row.file_path)) {
    return { verified: false, expectedHash: row.checksum_sha256, isTampered: true, error: 'Video file missing from storage disk' };
  }

  try {
    const buffer = fs.readFileSync(row.file_path);
    const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const verified = crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(row.checksum_sha256));

    return {
      verified,
      expectedHash: row.checksum_sha256,
      actualHash,
      isTampered: !verified,
    };
  } catch (err: unknown) {
    return {
      verified: false,
      expectedHash: row.checksum_sha256,
      isTampered: true,
      error: err instanceof Error ? err.message : 'Integrity check error',
    };
  }
}

/**
 * Manually deletes an unlocked recording segment.
 */
export async function deleteRecording(
  recordingId: number,
  actorRole = 'DOCTOR'
): Promise<{ success: boolean; message: string }> {
  const row = sqlite
    .prepare('SELECT file_path, is_locked, filename FROM hospital_cctv_recordings WHERE id = ?')
    .get(recordingId) as { file_path: string; is_locked: number; filename: string } | undefined;

  if (!row) {
    return { success: false, message: 'Recording not found' };
  }

  if (row.is_locked) {
    return { success: false, message: 'Forbidden: Cannot delete locked medico-legal evidence. Unlock first.' };
  }

  try {
    if (fs.existsSync(row.file_path)) {
      const size = fs.statSync(row.file_path).size;
      fs.writeFileSync(row.file_path, Buffer.alloc(size, 0));
      fs.unlinkSync(row.file_path);
    }
  } catch {}

  sqlite.prepare('DELETE FROM hospital_cctv_recordings WHERE id = ?').run(recordingId);

  await logAuditEvent({
    action: 'SYSTEM_CONFIG_UPDATED',
    actorRole,
    details: `Manually deleted CCTV recording: ${row.filename}`,
    status: 'SUCCESS',
  });

  return { success: true, message: 'Recording permanently zeroized and deleted.' };
}

/**
 * Retrieves recordings with optional filtering.
 */
export function getCctvRecordings(filters?: {
  zone?: string;
  cameraId?: number;
  triggerType?: string;
  isLocked?: boolean;
  limit?: number;
}): CctvRecording[] {
  let query = 'SELECT * FROM hospital_cctv_recordings WHERE 1=1';
  const params: any[] = [];

  if (filters?.zone && filters.zone !== 'ALL') {
    query += ' AND zone = ?';
    params.push(filters.zone);
  }
  if (filters?.cameraId) {
    query += ' AND camera_id = ?';
    params.push(filters.cameraId);
  }
  if (filters?.triggerType && filters.triggerType !== 'ALL') {
    query += ' AND trigger_type = ?';
    params.push(filters.triggerType);
  }
  if (filters?.isLocked !== undefined) {
    query += ' AND is_locked = ?';
    params.push(filters.isLocked ? 1 : 0);
  }

  query += ' ORDER BY start_time DESC LIMIT ?';
  params.push(filters?.limit || 50);

  const rows = sqlite.prepare(query).all(...params) as Array<{
    id: number;
    camera_id: number;
    camera_name: string;
    zone: CctvZone;
    filename: string;
    file_path: string;
    file_size_bytes: number;
    duration_seconds: number;
    start_time: number;
    end_time: number;
    trigger_type: CctvTriggerType;
    incident_id: number | null;
    is_locked: number;
    lock_reason: string | null;
    checksum_sha256: string;
    thumbnail_data: string | null;
    created_at: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    cameraId: r.camera_id,
    cameraName: r.camera_name,
    zone: r.zone,
    filename: r.filename,
    filePath: r.file_path,
    fileSizeBytes: r.file_size_bytes,
    durationSeconds: r.duration_seconds,
    startTime: new Date(r.start_time),
    endTime: new Date(r.end_time),
    triggerType: r.trigger_type,
    incidentId: r.incident_id,
    isLocked: Boolean(r.is_locked),
    lockReason: r.lock_reason || null,
    checksumSha256: r.checksum_sha256,
    thumbnailData: r.thumbnail_data,
    createdAt: r.created_at ? new Date(r.created_at) : null,
  }));
}

/**
 * Seeds default realistic simulated CCTV recordings if the table is empty.
 */
export async function seedDefaultRecordingsIfEmpty(): Promise<void> {
  const countRow = sqlite.prepare('SELECT COUNT(*) as count FROM hospital_cctv_recordings').get() as { count: number } | undefined;
  if (countRow && countRow.count > 0) return;

  const now = Date.now();
  const m = 60 * 1000;
  const h = 60 * m;

  const samples = [
    {
      cameraId: 1,
      cameraName: 'ICU Multi-Bed Bay 1',
      zone: 'ICU' as CctvZone,
      durationSeconds: 180,
      startTime: new Date(now - 45 * m),
      endTime: new Date(now - 42 * m),
      triggerType: 'INCIDENT' as CctvTriggerType,
      incidentId: 1,
      isLocked: true,
      lockReason: 'Patient fall risk alert - Bed 3 telemetry review',
      dummyText: 'SIMULATED-VIDEO-CLIP: ICU Bed 3 unassisted patient transfer attempt captured. Nurse response time 22 seconds.',
    },
    {
      cameraId: 2,
      cameraName: 'Emergency Resuscitation & Trauma Bay',
      zone: 'EMERGENCY' as CctvZone,
      durationSeconds: 300,
      startTime: new Date(now - 2 * h),
      endTime: new Date(now - 2 * h + 5 * m),
      triggerType: 'MOTION' as CctvTriggerType,
      isLocked: false,
      dummyText: 'SIMULATED-VIDEO-CLIP: Trauma ambulance gurney arrival. Acute triage team activated.',
    },
    {
      cameraId: 3,
      cameraName: 'Operation Theatre Main Sterile Field',
      zone: 'OT' as CctvZone,
      durationSeconds: 600,
      startTime: new Date(now - 5 * h),
      endTime: new Date(now - 5 * h + 10 * m),
      triggerType: 'CONTINUOUS' as CctvTriggerType,
      isLocked: true,
      lockReason: 'Surgical sterile protocol audit record',
      dummyText: 'SIMULATED-VIDEO-CLIP: General Laparoscopy surgery sterile boundary verification.',
    },
    {
      cameraId: 5,
      cameraName: 'Pharmacy Vault & Schedule H Drug Storage',
      zone: 'PHARMACY' as CctvZone,
      durationSeconds: 120,
      startTime: new Date(now - 8 * h),
      endTime: new Date(now - 8 * h + 2 * m),
      triggerType: 'MOTION' as CctvTriggerType,
      isLocked: false,
      dummyText: 'SIMULATED-VIDEO-CLIP: Night shift registered pharmacist drug dispensing inventory check.',
    },
    {
      cameraId: 6,
      cameraName: 'OPD Reception Token Triage Area',
      zone: 'OPD_RECEPTION' as CctvZone,
      durationSeconds: 240,
      startTime: new Date(now - 12 * h),
      endTime: new Date(now - 12 * h + 4 * m),
      triggerType: 'CONTINUOUS' as CctvTriggerType,
      isLocked: false,
      dummyText: 'SIMULATED-VIDEO-CLIP: Morning OPD queue distribution and token counter opening.',
    },
  ];

  for (const s of samples) {
    const buf = Buffer.from(s.dummyText);
    const rec = await saveRecordingSegment({
      cameraId: s.cameraId,
      cameraName: s.cameraName,
      zone: s.zone,
      durationSeconds: s.durationSeconds,
      startTime: s.startTime,
      endTime: s.endTime,
      triggerType: s.triggerType,
      incidentId: s.incidentId,
      buffer: buf,
    });

    if (s.isLocked) {
      await toggleLockRecording(rec.id, true, s.lockReason, 'SYSTEM');
    }
  }
}
