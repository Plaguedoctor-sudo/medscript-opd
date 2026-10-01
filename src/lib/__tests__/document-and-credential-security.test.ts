import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqlite } from '@/db';
import {
  sanitizeDocumentFileName,
  verifyDocumentMagicBytes,
} from '@/lib/document-security';
import { validateCredentialPolicy } from '@/lib/crypto-storage';
import { createSessionToken, parseSessionToken, hashPin } from '@/lib/auth';

describe('Document Upload Security & Masquerading Defenses', () => {
  it('sanitizes malicious filenames and prevents path traversal', () => {
    expect(sanitizeDocumentFileName('../../etc/passwd')).toBe('____etc_passwd');
    expect(sanitizeDocumentFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('____windows_system32_cmd.exe');
    expect(sanitizeDocumentFileName('test<script>alert(1)</script>.pdf')).toBe('test_script_alert(1)__script_.pdf');
    expect(sanitizeDocumentFileName('')).toBe('document');
  });

  it('validates genuine PDF magic bytes (%PDF-)', () => {
    const validPdfPayload = Buffer.from('%PDF-1.7\nSample content').toString('base64');
    expect(verifyDocumentMagicBytes(validPdfPayload, 'application/pdf')).toBe(true);
  });

  it('strictly blocks SVG active content masquerading as PDF', () => {
    const svgXssPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>').toString('base64');
    expect(verifyDocumentMagicBytes(svgXssPayload, 'application/pdf')).toBe(false);
  });

  it('strictly blocks HTML disguised as medical images or PDF', () => {
    const htmlPayload = Buffer.from('<!DOCTYPE html><html><body><h1>Phish</h1></body></html>').toString('base64');
    expect(verifyDocumentMagicBytes(htmlPayload, 'application/pdf')).toBe(false);
    expect(verifyDocumentMagicBytes(htmlPayload, 'image/png')).toBe(false);
    expect(verifyDocumentMagicBytes(htmlPayload, 'image/jpeg')).toBe(false);
  });

  it('strictly blocks Windows PE executables disguised with image or pdf extension', () => {
    // MZ header: 0x4D 0x5A
    const pePayload = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]).toString('base64');
    expect(verifyDocumentMagicBytes(pePayload, 'application/pdf')).toBe(false);
    expect(verifyDocumentMagicBytes(pePayload, 'image/png')).toBe(false);
    expect(verifyDocumentMagicBytes(pePayload, 'image/jpeg')).toBe(false);
  });

  it('validates genuine JPEG binary signature (FF D8 FF)', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString('base64');
    expect(verifyDocumentMagicBytes(validJpeg, 'image/jpeg')).toBe(true);
    // Should fail if declared as PNG or PDF
    expect(verifyDocumentMagicBytes(validJpeg, 'image/png')).toBe(false);
    expect(verifyDocumentMagicBytes(validJpeg, 'application/pdf')).toBe(false);
  });

  it('validates genuine PNG binary signature (89 50 4E 47 0D 0A 1A 0A)', () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]).toString('base64');
    expect(verifyDocumentMagicBytes(validPng, 'image/png')).toBe(true);
    expect(verifyDocumentMagicBytes(validPng, 'image/jpeg')).toBe(false);
  });

  it('validates genuine WebP binary signature (RIFF ... WEBP)', () => {
    // RIFF (4 bytes) + 4 bytes size + WEBP (4 bytes)
    const validWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x20, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]).toString('base64');
    expect(verifyDocumentMagicBytes(validWebp, 'image/webp')).toBe(true);
    expect(verifyDocumentMagicBytes(validWebp, 'application/pdf')).toBe(false);
  });
});

describe('Staff Credential Hardening & Password Rotation Policy', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const res = validateCredentialPolicy('Med12', { minLength: 8, requireComplexity: true });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('8 characters');
  });

  it('rejects passwords without letter and number complexity', () => {
    const lettersOnly = validateCredentialPolicy('DoctorPassword', { minLength: 8, requireComplexity: true });
    expect(lettersOnly.valid).toBe(false);
    expect(lettersOnly.reason).toContain('combination of letters and numbers');

    const numbersOnly = validateCredentialPolicy('1234567890', { minLength: 8, requireComplexity: true });
    expect(numbersOnly.valid).toBe(false);
  });

  it('accepts compliant strong passphrases', () => {
    const strong = validateCredentialPolicy('HospitalCare2026', { minLength: 8, requireComplexity: true });
    expect(strong.valid).toBe(true);
  });

  it('rejects predictable seasonal spray passwords (e.g. Fall2019!)', () => {
    const seasonal = validateCredentialPolicy('Fall2019!', { minLength: 8, requireComplexity: true });
    expect(seasonal.valid).toBe(false);
    expect(seasonal.reason).toContain('predictable seasonal');

    const spring = validateCredentialPolicy('Spring2025', { minLength: 8, requireComplexity: true });
    expect(spring.valid).toBe(false);

    const genericSpray = validateCredentialPolicy('clinic1234', { minLength: 8, requireComplexity: true });
    expect(genericSpray.valid).toBe(false);
  });

  it('enforces immediate session revocation when password is changed', () => {
    const testLogin = 'test_rotation_nurse';
    sqlite.prepare('DELETE FROM staff_users WHERE login_id = ?').run(testLogin);

    const initialHash = hashPin('InitialPass123');
    const t0 = Date.now() - 10000;
    const res = sqlite.prepare(`
      INSERT INTO staff_users (login_id, password_hash, name, role, is_active, password_updated_at, created_at)
      VALUES (?, ?, 'Nurse Test', 'nurse', 1, ?, ?)
    `).run(testLogin, initialHash, t0, t0);
    const userId = Number(res.lastInsertRowid);

    // Session token generated with initial password
    const oldToken = createSessionToken('nurse', userId);
    expect(parseSessionToken(oldToken).valid).toBe(true);

    // Rotate password: new hash and updated timestamp
    const newHash = hashPin('NewSecurePass2026');
    const t1 = Date.now();
    sqlite.prepare('UPDATE staff_users SET password_hash = ?, password_updated_at = ? WHERE id = ?').run(newHash, t1, userId);

    // Old session token is now immediately invalidated!
    const oldParsed = parseSessionToken(oldToken);
    expect(oldParsed.valid).toBe(false);

    // New session token works
    const newToken = createSessionToken('nurse', userId);
    expect(parseSessionToken(newToken).valid).toBe(true);

    // Clean up
    sqlite.prepare('DELETE FROM staff_users WHERE id = ?').run(userId);
  });
});

describe('FHIR R4 Bulk Query Rate Limiting & API Security', () => {
  const testIp = '10.133.236.88';

  beforeEach(() => {
    sqlite.prepare('DELETE FROM rate_limits WHERE key = ?').run(`fhir_${testIp}`);
  });

  afterEach(() => {
    sqlite.prepare('DELETE FROM rate_limits WHERE key = ?').run(`fhir_${testIp}`);
  });

  it('allows queries within the 30 req/min threshold', async () => {
    const { checkFhirQueryRateLimit, recordFhirQueryAttempt } = await import('@/lib/rate-limiter');
    for (let i = 0; i < 30; i++) {
      expect(checkFhirQueryRateLimit(testIp).allowed).toBe(true);
      recordFhirQueryAttempt(testIp);
    }
  });

  it('throttles excessive requests beyond the threshold to prevent mass demographic scraping', async () => {
    const { checkFhirQueryRateLimit, recordFhirQueryAttempt } = await import('@/lib/rate-limiter');
    for (let i = 0; i < 30; i++) {
      recordFhirQueryAttempt(testIp);
    }

    const blocked = checkFhirQueryRateLimit(testIp);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('Third-Party Token Encryption at Rest', () => {
  it('encrypts Meta WhatsApp Cloud API token into AES-256-GCM format', async () => {
    const { encryptPhi, decryptPhi } = await import('@/lib/crypto-storage');
    const rawToken = 'EAABwb7Qp8e0BAOD...sensitive_meta_token';
    const encrypted = encryptPhi(rawToken);

    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain(rawToken);

    const decrypted = decryptPhi(encrypted);
    expect(decrypted).toBe(rawToken);
  });
});

