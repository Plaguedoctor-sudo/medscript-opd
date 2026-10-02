import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  saveRecordingSegment,
  verifyRecordingIntegrity,
  toggleLockRecording,
  deleteRecording,
  pruneExpiredRecordings,
  getCctvStorageStats,
  getCctvStorageConfig,
  updateCctvStorageConfig,
} from '@/lib/cctv/cctv-storage-engine';
import { sqlite } from '@/db';

describe('Hospital CCTV Feed Storage, Retention & NVR Archive', () => {
  const testDir = path.join(process.cwd(), 'backups', 'test_cctv_storage');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true, mode: 0o700 });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('Recording Segment Creation & SHA-256 Forensic Sealing', () => {
    it('saves video segment to disk with deterministic SHA-256 seal', async () => {
      const dummyData = Buffer.from('TEST-CCTV-VIDEO-SEGMENT-ICU-BED-1');
      const start = new Date(Date.now() - 60000);
      const end = new Date();

      const rec = await saveRecordingSegment({
        cameraId: 1,
        cameraName: 'ICU Multi-Bed Bay 1',
        zone: 'ICU',
        durationSeconds: 60,
        startTime: start,
        endTime: end,
        triggerType: 'INCIDENT',
        buffer: dummyData,
      });

      expect(rec.id).toBeGreaterThan(0);
      expect(rec.checksumSha256).toHaveLength(64);
      expect(rec.fileSizeBytes).toBe(dummyData.length);
      expect(fs.existsSync(rec.filePath)).toBe(true);

      // Verify integrity matches
      const verify = await verifyRecordingIntegrity(rec.id);
      expect(verify.verified).toBe(true);
      expect(verify.isTampered).toBe(false);
      expect(verify.actualHash).toBe(rec.checksumSha256);

      // Clean up
      await deleteRecording(rec.id);
    });

    it('detects tampering if video file is altered on disk', async () => {
      const dummyData = Buffer.from('AUTHENTIC-HOSPITAL-SURVEILLANCE-CLIP');
      const rec = await saveRecordingSegment({
        cameraId: 2,
        cameraName: 'Emergency Bay',
        zone: 'EMERGENCY',
        durationSeconds: 30,
        startTime: new Date(Date.now() - 30000),
        endTime: new Date(),
        triggerType: 'MOTION',
        buffer: dummyData,
      });

      // Tamper with the file on disk
      fs.writeFileSync(rec.filePath, Buffer.from('TAMPERED-MALICIOUS-INJECTED-CONTENT'));

      const verify = await verifyRecordingIntegrity(rec.id);
      expect(verify.verified).toBe(false);
      expect(verify.isTampered).toBe(true);

      // Clean up
      await deleteRecording(rec.id);
    });
  });

  describe('Evidence Locking & Retention Safeguards', () => {
    it('locks recording evidence and blocks deletion while locked', async () => {
      const rec = await saveRecordingSegment({
        cameraId: 1,
        cameraName: 'ICU Bed 1',
        zone: 'ICU',
        durationSeconds: 120,
        startTime: new Date(Date.now() - 120000),
        endTime: new Date(),
        triggerType: 'INCIDENT',
        buffer: Buffer.from('CRITICAL-FALL-INCIDENT-EVIDENCE'),
      });

      // Lock evidence
      await toggleLockRecording(rec.id, true, 'Section 65B Medico-Legal hold for fall inquiry');

      // Attempting to delete locked evidence must be forbidden
      const deleteRes = await deleteRecording(rec.id);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.message).toContain('Cannot delete locked');

      // Unlock and then delete
      await toggleLockRecording(rec.id, false);
      const deleteRes2 = await deleteRecording(rec.id);
      expect(deleteRes2.success).toBe(true);
    });

    it('pruning strictly preserves locked evidence while purging expired unlocked files', async () => {
      const oldTime = new Date(Date.now() - 40 * 86400 * 1000); // 40 days old

      // 1. Unlocked expired recording
      const unlockedExpired = await saveRecordingSegment({
        cameraId: 5,
        cameraName: 'Pharmacy Vault',
        zone: 'PHARMACY',
        durationSeconds: 60,
        startTime: oldTime,
        endTime: new Date(oldTime.getTime() + 60000),
        triggerType: 'CONTINUOUS',
        buffer: Buffer.from('OLD-ROUTINE-PHARMACY-FOOTAGE'),
      });

      // 2. Locked expired evidence
      const lockedExpired = await saveRecordingSegment({
        cameraId: 3,
        cameraName: 'OT 1',
        zone: 'OT',
        durationSeconds: 60,
        startTime: oldTime,
        endTime: new Date(oldTime.getTime() + 60000),
        triggerType: 'INCIDENT',
        buffer: Buffer.from('CRITICAL-SURGICAL-AUDIT-HOLD'),
      });
      await toggleLockRecording(lockedExpired.id, true, 'Permanent surgical audit hold');

      // Run prune (retention 30 days)
      const pruneRes = await pruneExpiredRecordings();
      expect(pruneRes.prunedCount).toBeGreaterThanOrEqual(1);

      // Verify unlocked expired recording was removed
      const checkUnlocked = sqlite.prepare('SELECT id FROM hospital_cctv_recordings WHERE id = ?').get(unlockedExpired.id);
      expect(checkUnlocked).toBeUndefined();

      // Verify locked expired recording was PRESERVED
      const checkLocked = sqlite.prepare('SELECT id FROM hospital_cctv_recordings WHERE id = ?').get(lockedExpired.id);
      expect(checkLocked).toBeDefined();

      // Clean up locked recording
      await toggleLockRecording(lockedExpired.id, false);
      await deleteRecording(lockedExpired.id);
    });
  });

  describe('Storage Analytics & Policy Configuration', () => {
    it('calculates capacity usage, zone breakdown, and trigger breakdown', () => {
      const stats = getCctvStorageStats();
      expect(stats.totalRecordings).toBeGreaterThanOrEqual(0);
      expect(stats.maxStorageGb).toBeGreaterThan(0);
      expect(stats.usedPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.triggerBreakdown).toBeDefined();
      expect(stats.triggerBreakdown.CONTINUOUS).toBeDefined();
      expect(stats.triggerBreakdown.INCIDENT).toBeDefined();
      expect(stats.triggerBreakdown.MOTION).toBeDefined();
    });

    it('updates storage retention configuration', async () => {
      await updateCctvStorageConfig({
        retentionDays: 60,
        maxStorageGb: 100,
        autoPurgeEnabled: true,
      });

      const config = getCctvStorageConfig();
      expect(config.retentionDays).toBe(60);
      expect(config.maxStorageGb).toBe(100);
      expect(config.autoPurgeEnabled).toBe(true);

      // Restore to 30 days
      await updateCctvStorageConfig({
        retentionDays: 30,
        maxStorageGb: 50,
      });
    });
  });
});
