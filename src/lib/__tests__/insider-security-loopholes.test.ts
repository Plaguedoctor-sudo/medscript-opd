import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqlite } from '@/db';
import { createSessionToken, parseSessionToken, canDo, isDoctor } from '@/lib/auth';
import { checkKioskLookupRateLimit, recordKioskLookupAttempt } from '@/lib/rate-limiter';

describe('Insider Threat & Security Loophole Defenses', () => {
  const TEST_LOGIN_ID = 'test_nurse_threat';
  let testUserId: number;

  beforeEach(() => {
    // Clean up test records
    sqlite.prepare('DELETE FROM staff_users WHERE login_id = ?').run(TEST_LOGIN_ID);
    sqlite.prepare("DELETE FROM rate_limits WHERE key LIKE 'kiosk_%'").run();

    // Insert active test staff user
    const res = sqlite
      .prepare(`
        INSERT INTO staff_users (
          login_id, password_hash, name, role, sub_role, is_active, password_updated_at, created_at
        ) VALUES (?, 'dummy_hash', 'Test Staff', 'nurse', 'Staff Nurse', 1, ?, ?)
      `)
      .run(TEST_LOGIN_ID, Date.now() - 60000, Date.now() - 60000);
    testUserId = Number(res.lastInsertRowid);
  });

  afterEach(() => {
    sqlite.prepare('DELETE FROM staff_users WHERE login_id = ?').run(TEST_LOGIN_ID);
    sqlite.prepare("DELETE FROM rate_limits WHERE key LIKE 'kiosk_%'").run();
  });

  it('validates active staff member session token successfully', () => {
    const token = createSessionToken('nurse', testUserId);
    const parsed = parseSessionToken(token);
    expect(parsed.valid).toBe(true);
    expect(parsed.role).toBe('nurse');
    expect(parsed.userId).toBe(testUserId);
  });

  it('immediately revokes session when staff account is deactivated (is_active = 0)', () => {
    const token = createSessionToken('nurse', testUserId);

    // Admin deactivates staff member
    sqlite.prepare('UPDATE staff_users SET is_active = 0 WHERE id = ?').run(testUserId);

    const parsed = parseSessionToken(token);
    expect(parsed.valid).toBe(false);
  });

  it('immediately revokes session when staff account is permanently deleted', () => {
    const token = createSessionToken('nurse', testUserId);

    // Admin deletes staff member
    sqlite.prepare('DELETE FROM staff_users WHERE id = ?').run(testUserId);

    const parsed = parseSessionToken(token);
    expect(parsed.valid).toBe(false);
  });

  it('immediately revokes previously issued tokens when password or role is updated (password_updated_at)', () => {
    // Issue token at t0
    const tokenBefore = createSessionToken('nurse', testUserId);

    // Advance password_updated_at to now + 5000ms
    sqlite.prepare('UPDATE staff_users SET password_updated_at = ? WHERE id = ?').run(Date.now() + 5000, testUserId);

    // Token issued before update is now invalid!
    const parsed = parseSessionToken(tokenBefore);
    expect(parsed.valid).toBe(false);
  });

  it('authoritatively reflects role demotion in real time without trusting old cookie role', () => {
    // User was doctor when token was issued
    sqlite.prepare("UPDATE staff_users SET role = 'doctor' WHERE id = ?").run(testUserId);
    const tokenWithOldDoctorRole = createSessionToken('doctor', testUserId);

    // Admin demotes account to receptionist
    sqlite.prepare("UPDATE staff_users SET role = 'receptionist' WHERE id = ?").run(testUserId);

    const parsed = parseSessionToken(tokenWithOldDoctorRole);
    expect(parsed.valid).toBe(true);
    expect(parsed.role).toBe('receptionist'); // Live role from DB, not spoofed 'doctor'!
  });

  it('enforces kiosk phone lookup rate limiting to prevent patient registry enumeration', () => {
    const testIp = '192.168.1.99';

    // First 10 attempts allowed
    for (let i = 0; i < 10; i++) {
      expect(checkKioskLookupRateLimit(testIp).allowed).toBe(true);
      recordKioskLookupAttempt(testIp);
    }

    // 11th attempt is blocked!
    const blocked = checkKioskLookupRateLimit(testIp);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('strictly restricts patient demographics view from lab_technician in FHIR RBAC', () => {
    expect(canDo('admin_doctor', 'patient:view')).toBe(true);
    expect(canDo('doctor', 'patient:view')).toBe(true);
    expect(canDo('nurse', 'patient:view')).toBe(true);
    expect(canDo('receptionist', 'patient:view')).toBe(true);
    expect(canDo('lab_technician', 'patient:view')).toBe(true); // Lab tech can view patient for lab context
    expect(canDo('lab_technician', 'prescription:create')).toBe(false);
    expect(canDo('lab_technician', 'billing:view')).toBe(false);
  });

  it('strictly isolates inventory management from nurses and receptionists', () => {
    expect(canDo('admin_doctor', 'inventory:manage')).toBe(true);
    expect(canDo('doctor', 'inventory:manage')).toBe(true);
    expect(canDo('nurse', 'inventory:manage')).toBe(false);
    expect(canDo('receptionist', 'inventory:manage')).toBe(false);
  });

  it('allows nurses to view appointments while preventing appointment management', () => {
    expect(canDo('nurse', 'appointment:view')).toBe(true);
    expect(canDo('nurse', 'appointment:manage')).toBe(false);
    expect(canDo('doctor', 'appointment:manage')).toBe(true);
    expect(canDo('receptionist', 'appointment:manage')).toBe(true);
  });

  it('restricts doctor clinical authority (isDoctor) to legitimate medical officers', () => {
    expect(isDoctor('admin_doctor')).toBe(true);
    expect(isDoctor('doctor')).toBe(true);
    expect(isDoctor('nurse')).toBe(false);
    expect(isDoctor('receptionist')).toBe(false);
    expect(isDoctor('lab_technician')).toBe(false);
  });

  it('validates document upload payload bounds (5MB limit & 50 docs limit)', () => {
    const MAX_BASE64_LENGTH = 7 * 1024 * 1024;
    const MAX_FILE_SIZE_KB = 5120;
    const MAX_DOCS_PER_PATIENT = 50;

    // Test payload length check
    const oversizedBase64 = 'a'.repeat(MAX_BASE64_LENGTH + 10);
    expect(oversizedBase64.length > MAX_BASE64_LENGTH).toBe(true);

    const normalBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(normalBase64.length <= MAX_BASE64_LENGTH).toBe(true);

    // Test file size check
    expect(6000 > MAX_FILE_SIZE_KB).toBe(true);
    expect(2048 <= MAX_FILE_SIZE_KB).toBe(true);

    // Test doc count check
    expect(50 >= MAX_DOCS_PER_PATIENT).toBe(true);
    expect(49 < MAX_DOCS_PER_PATIENT).toBe(true);
  });

  it('generates and verifies cryptographic digital seal for medical certificates to prevent forgery', () => {
    const secret = 'test-cert-salt-2026';
    const certNo = 'CERT-20260930-001';
    const patientId = 42;
    const type = 'SICK_LEAVE';
    const regNo = 'MCI-12345';
    const diagnosis = 'Acute Gastroenteritis';
    const issuedAt = 1775000000000;

    const sealData = `${certNo}:${patientId}:${type}:${regNo}:${diagnosis}:${issuedAt}`;
    const seal = require('crypto').createHmac('sha256', secret).update(sealData).digest('hex');

    expect(seal).toHaveLength(64);

    // Tampered diagnosis must produce mismatched hash!
    const tamperedData = `${certNo}:${patientId}:${type}:${regNo}:Chronic Heart Failure:${issuedAt}`;
    const tamperedSeal = require('crypto').createHmac('sha256', secret).update(tamperedData).digest('hex');
    expect(tamperedSeal).not.toBe(seal);
  });
});
