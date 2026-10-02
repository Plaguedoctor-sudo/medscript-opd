import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  verifyClusterToken,
  computeDatabaseHash,
  createReplicationPackage,
  applyReplicationSnapshot,
  promoteToPrimary,
  getLanMirrorConfig,
  saveLanMirrorConfig,
} from '@/lib/lan-mirroring';
import { sqlite } from '@/db';

describe('High Availability & Automated LAN Peer Mirroring', () => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('verifyClusterToken (Constant-Time Verification)', () => {
    it('accepts identical cluster tokens', () => {
      expect(verifyClusterToken(testSecret, testSecret)).toBe(true);
    });

    it('rejects altered tokens', () => {
      const altered = testSecret.slice(0, -1) + (testSecret.slice(-1) === 'a' ? 'b' : 'a');
      expect(verifyClusterToken(altered, testSecret)).toBe(false);
    });

    it('rejects tokens of different lengths without timing leak', () => {
      expect(verifyClusterToken('short-token', testSecret)).toBe(false);
      expect(verifyClusterToken(testSecret + 'extra', testSecret)).toBe(false);
    });

    it('rejects null, undefined, or empty tokens', () => {
      expect(verifyClusterToken('', testSecret)).toBe(false);
      expect(verifyClusterToken(null, testSecret)).toBe(false);
      expect(verifyClusterToken(undefined, testSecret)).toBe(false);
      expect(verifyClusterToken(testSecret, '')).toBe(false);
    });
  });

  describe('Database Hash Computation', () => {
    it('computes a valid 64-character SHA-256 seal of the SQLite database', () => {
      const hash = computeDatabaseHash();
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe('Replication Snapshot Packaging & Integrity', () => {
    it('generates a signed replication package with matching HMAC-SHA256 signature', async () => {
      const pkg = await createReplicationPackage(testSecret);
      expect(pkg.buffer).toBeInstanceOf(Buffer);
      expect(pkg.buffer.length).toBeGreaterThan(0);
      expect(pkg.sha256).toHaveLength(64);
      expect(pkg.signature).toHaveLength(64);

      // Verify HMAC matches buffer
      const expectedSig = crypto.createHmac('sha256', testSecret).update(pkg.buffer).digest('hex');
      expect(pkg.signature).toBe(expectedSig);
    });

    it('rejects snapshot if HMAC signature is tampered or signed with wrong secret', async () => {
      const pkg = await createReplicationPackage(testSecret);
      const wrongSecret = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

      await expect(
        applyReplicationSnapshot(pkg.buffer, pkg.signature, wrongSecret)
      ).rejects.toThrow(/HMAC signature verification failed/i);
    });

    it('successfully applies valid snapshot and verifies block integrity', async () => {
      const pkg = await createReplicationPackage(testSecret);
      const tempDir = path.join(process.cwd(), 'backups', 'lan_temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const testDbPath = path.join(tempDir, `test-replica-${Date.now()}.db`);

      const res = await applyReplicationSnapshot(pkg.buffer, pkg.signature, testSecret, 'http://192.168.1.150:3000', testDbPath);
      expect(res.success).toBe(true);
      expect(res.hash).toBe(pkg.sha256);

      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    });
  });

  describe('Failover Promotion & State Transition', () => {
    it('promotes local node to PRIMARY_MASTER and logs HA audit', async () => {
      const res = await promoteToPrimary('DOCTOR', 'Test hardware failure drill');
      expect(res.success).toBe(true);

      const config = getLanMirrorConfig();
      expect(config.role).toBe('PRIMARY_MASTER');

      // Verify audit record exists
      const audit = sqlite
        .prepare("SELECT * FROM lan_mirror_audit WHERE event_type = 'FAILOVER_PROMOTION' ORDER BY id DESC LIMIT 1")
        .get() as { status: string; error_message: string } | undefined;
      expect(audit).toBeDefined();
      expect(audit?.status).toBe('SUCCESS');
      expect(audit?.error_message).toContain('Test hardware failure drill');
    });

    it('saves and updates LAN Mirror configuration', async () => {
      await saveLanMirrorConfig({
        role: 'STANDBY_REPLICA',
        nodeName: 'Reception Desk Test Node',
        peerUrl: 'https://192.168.1.200:3000',
        autoFailover: true,
        heartbeatIntervalSec: 20,
      });

      const config = getLanMirrorConfig();
      expect(config.role).toBe('STANDBY_REPLICA');
      expect(config.nodeName).toBe('Reception Desk Test Node');
      expect(config.peerUrl).toBe('https://192.168.1.200:3000');
      expect(config.autoFailover).toBe(true);
      expect(config.heartbeatIntervalSec).toBe(20);

      // Restore to STANDALONE
      await saveLanMirrorConfig({
        role: 'STANDALONE',
        nodeName: 'Doctor Desk (Primary)',
        peerUrl: '',
        autoFailover: false,
      });
    });
  });
});
