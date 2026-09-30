import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sqlite } from '@/db';
import {
  createSessionToken,
  parseSessionToken,
  revokeStaffSessions,
  computeSubnetFingerprint,
} from '../auth';
import { checkApkDownloadRateLimit, recordApkDownloadAttempt } from '../rate-limiter';
import { runThreatHuntingScan } from '../military-sentinel';
import { lookupReturningPatientAction } from '@/app/checkin/actions';

describe('MITRE ATT&CK Post-Breach & Threat Hunting Hardening Suite', () => {
  const testUserId = 9991;
  const testPatientPhone = '9876543210';
  let testPatientId: number;

  beforeAll(() => {
    // Seed test staff user
    try {
      sqlite
        .prepare(`
          INSERT OR REPLACE INTO staff_users (id, login_id, password_hash, name, role, is_active)
          VALUES (?, 'test_threat_user', 'scrypt:v1:fake:fake', 'Threat Test Staff', 'nurse', 1)
        `)
        .run(testUserId);
    } catch {}

    // Seed test patient
    try {
      const info = sqlite
        .prepare(`
          INSERT INTO patients (name, age, gender, phone, reg_no, allergies, blood_group)
          VALUES ('Rajesh Kumar Sharma', 45, 'Male', ?, '20261001-THREAT-1', 'Severe Penicillin Allergy', 'B+')
        `)
        .run(testPatientPhone);
      testPatientId = Number(info.lastInsertRowid);
    } catch {}
  });

  afterAll(() => {
    try {
      sqlite.prepare('DELETE FROM staff_users WHERE id = ?').run(testUserId);
    } catch {}
    try {
      if (testPatientId) {
        sqlite.prepare('DELETE FROM patients WHERE id = ?').run(testPatientId);
      }
    } catch {}
  });

  describe('T1070.002: Audit Log WORM (Write-Once-Read-Many) Engine Triggers', () => {
    it('blocks DELETE operations on audit_logs at the database engine level', () => {
      // Seed an audit log entry
      const res = sqlite
        .prepare("INSERT INTO audit_logs (action, actor_role, details, status) VALUES ('TEST_EVENT', 'DOCTOR', 'Test WORM', 'SUCCESS')")
        .run();
      const insertId = res.lastInsertRowid;

      // Attempting to delete must throw SQLite exception from trigger
      expect(() => {
        sqlite.prepare('DELETE FROM audit_logs WHERE id = ?').run(insertId);
      }).toThrow(/MITRE T1070/);
    });

    it('blocks UPDATE operations on audit_logs at the database engine level', () => {
      const res = sqlite
        .prepare("INSERT INTO audit_logs (action, actor_role, details, status) VALUES ('TEST_EVENT_2', 'DOCTOR', 'Test WORM 2', 'SUCCESS')")
        .run();
      const insertId = res.lastInsertRowid;

      // Attempting to update must throw SQLite exception from trigger
      expect(() => {
        sqlite.prepare("UPDATE audit_logs SET details = 'TAMPERED' WHERE id = ?").run(insertId);
      }).toThrow(/MITRE T1070/);
    });
  });

  describe('T1078.004 & T1550.004: Targeted Session Revocation & Subnet Fingerprinting', () => {
    it('computes correct subnet fingerprints for LAN and WAN IPs', () => {
      expect(computeSubnetFingerprint('127.0.0.1')).toBe('loopback');
      expect(computeSubnetFingerprint('::1')).toBe('loopback');
      expect(computeSubnetFingerprint(null)).toBe('any');

      // IPs on the same subnet have identical fingerprints
      const fp1 = computeSubnetFingerprint('192.168.1.55');
      const fp2 = computeSubnetFingerprint('192.168.1.120');
      expect(fp1).toBe(fp2);

      // IPs on different subnets have different fingerprints
      const fp3 = computeSubnetFingerprint('10.0.5.21');
      expect(fp1).not.toBe(fp3);
    });

    it('creates and verifies subnet-bound session tokens', () => {
      const lanIp = '192.168.1.100';
      const token = createSessionToken('nurse', testUserId, lanIp);

      // Verifying from the same subnet passes
      const validCheck = parseSessionToken(token, '192.168.1.105');
      expect(validCheck.valid).toBe(true);
      expect(validCheck.role).toBe('nurse');
      expect(validCheck.userId).toBe(testUserId);

      // Verifying from a completely different remote subnet rejects the session
      const hijackedCheck = parseSessionToken(token, '203.0.113.42');
      expect(hijackedCheck.valid).toBe(false);
    });

    it('revokes sessions specifically for a target user without affecting global sessions', async () => {
      const tokenBefore = createSessionToken('nurse', testUserId);
      expect(parseSessionToken(tokenBefore).valid).toBe(true);

      // Wait 5ms and execute targeted user revocation
      await new Promise((r) => setTimeout(r, 5));
      revokeStaffSessions(testUserId);

      // Token issued before revocation is rejected
      expect(parseSessionToken(tokenBefore).valid).toBe(false);

      // Token issued after revocation is valid
      const tokenAfter = createSessionToken('nurse', testUserId);
      expect(parseSessionToken(tokenAfter).valid).toBe(true);
    });
  });

  describe('T1087 / CWE-359: Kiosk Demographic Masking & PHI Redaction', () => {
    it('masks patient name and redacts allergies/bloodGroup during public kiosk lookup', async () => {
      const result = await lookupReturningPatientAction(testPatientPhone);

      expect(result.found).toBe(true);
      expect(result.patient).toBeDefined();

      // Full name "Rajesh Kumar Sharma" should be masked (e.g. "R****h K***r S****a")
      expect(result.patient?.name).not.toBe('Rajesh Kumar Sharma');
      expect(result.patient?.name).toContain('*');

      // Clinical details must be redacted to null prior to check-in confirmation
      expect(result.patient?.allergies).toBeNull();
      expect(result.patient?.bloodGroup).toBeNull();
    });
  });

  describe('T1499 / DoS: APK Download Endpoint Rate Limiter', () => {
    const testIp = '198.51.100.222';

    beforeAll(() => {
      try {
        sqlite.prepare('DELETE FROM rate_limits WHERE key = ?').run(`apk_${testIp}`);
      } catch {}
    });

    it('enforces download rate limits after maximum attempts', () => {
      // First attempt is allowed
      const check1 = checkApkDownloadRateLimit(testIp);
      expect(check1.allowed).toBe(true);

      // Simulate 10 attempts
      for (let i = 0; i < 11; i++) {
        recordApkDownloadAttempt(testIp);
      }

      // 11th attempt must be blocked
      const checkBlocked = checkApkDownloadRateLimit(testIp);
      expect(checkBlocked.allowed).toBe(false);
      expect(checkBlocked.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('MITRE D3FEND™: Active Threat Hunting & Post-Breach IOC Scanner', () => {
    it('executes deep forensic scan and produces valid threat hunting report structure', async () => {
      const report = await runThreatHuntingScan();

      expect(report.scannedAt).toBeDefined();
      expect(typeof report.totalFindings).toBe('number');
      expect(typeof report.criticalCount).toBe('number');
      expect(typeof report.warningCount).toBe('number');
      expect(typeof report.cleanStatus).toBe('boolean');
      expect(Array.isArray(report.findings)).toBe(true);

      // Each finding adheres to ThreatHuntingFinding schema
      for (const finding of report.findings) {
        expect(['AUDIT_GAP', 'SESSION_ANOMALY', 'UNSEALED_RECORD', 'OFF_HOURS_ACTIVITY', 'RATE_LIMIT_SPIKE']).toContain(finding.category);
        expect(['CRITICAL', 'WARNING', 'INFO']).toContain(finding.severity);
        expect(finding.title).toBeDefined();
        expect(finding.description).toBeDefined();
        expect(finding.mitigation).toBeDefined();
      }
    });
  });
});
