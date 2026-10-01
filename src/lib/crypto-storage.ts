/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
import crypto from 'crypto';
import { getSessionSecret } from '@/lib/auth';

/**
 * Derives a 256-bit (32-byte) key using SHA-256
 */
function getDerivedKey(secret?: string): Buffer {
  const effectiveSecret = secret || process.env.DATA_ENCRYPTION_KEY || getSessionSecret();
  return crypto.createHash('sha256').update(effectiveSecret).digest();
}

/**
 * Encrypts a string using AES-256-GCM (Authenticated Encryption)
 * Produces format: `enc:v1:<hex-iv>:<hex-tag>:<hex-data>`
 */
export function encryptPhi(plainText: string | null | undefined, customSecret?: string): string {
  if (!plainText) return '';
  const key = getDerivedKey(customSecret);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string, verifying authentication tag integrity
 */
export function decryptPhi(encryptedString: string | null | undefined, customSecret?: string): string {
  if (!encryptedString) return '';
  if (!encryptedString.startsWith('enc:v1:')) {
    // If not encrypted, return as-is (backward compatibility)
    return encryptedString;
  }

  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 5) return encryptedString;

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const key = getDerivedKey(customSecret);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed or data was tampered with:', err);
    return '[Encrypted PHI - Decryption Failed]';
  }
}

/**
 * Validates password/PIN policy:
 * - Minimum length requirement (e.g. 4-12 characters)
 * - Character complexity requirement (digits, letters, symbols)
 * - Common weak patterns check (sequential or repeated characters)
 */
export function validateCredentialPolicy(
  pinOrPassword: string,
  options: {
    minLength?: number;
    requireComplexity?: boolean;
  } = {}
): { valid: boolean; reason?: string } {
  const clean = pinOrPassword.trim();
  const minLength = options.minLength || 4;

  if (clean.length < minLength) {
    return { valid: false, reason: `Passcode must be at least ${minLength} characters long.` };
  }

  if (clean.length > 32) {
    return { valid: false, reason: 'Passcode cannot exceed 32 characters.' };
  }

  // Check trivial sequences (1234, 0000, 1111)
  if (/^(\d)\1+$/.test(clean)) {
    return { valid: false, reason: 'Passcode cannot consist of identical repeated characters.' };
  }
  if (['1234', '12345', '123456', '12345678', '0123', '9876'].includes(clean)) {
    return { valid: false, reason: 'Passcode cannot be a trivial sequential sequence.' };
  }

  if (options.requireComplexity) {
    const hasNumber = /\d/.test(clean);
    const hasAlpha = /[a-zA-Z]/.test(clean);

    if (!hasNumber || !hasAlpha) {
      return {
        valid: false,
        reason: 'Complex credential requires a combination of letters and numbers.',
      };
    }

    // Mitigate Password Spraying: Ban seasonal and predictable year passwords (e.g. Summer2024!, Fall2019!)
    const seasonalRegex = /^(spring|summer|autumn|fall|winter)\d{2,4}[!@#$%^&*?]?$/i;
    if (seasonalRegex.test(clean)) {
      return {
        valid: false,
        reason: 'Passcode cannot use predictable seasonal or year templates (e.g., Fall2019!).',
      };
    }

    // Ban generic spray patterns and default factory passwords
    const commonSprayPatterns = [
      'password123',
      'admin123',
      'admin1234',
      'doctor123',
      'nurse123',
      'reception123',
      'lab123',
      'pharmacy123',
      'pharm123',
      'manager123',
      'welcome123',
      'clinic1234',
      'medscript123',
      '12345678',
    ];
    if (commonSprayPatterns.includes(clean.toLowerCase())) {
      return {
        valid: false,
        reason: 'Passcode cannot be a commonly sprayed default pattern or default demo password.',
      };
    }
  }

  return { valid: true };
}

/**
 * Encrypts a binary buffer using AES-256-GCM with memory-hard scrypt key derivation (NIST SP 800-38D / SP 800-132)
 * Output structure: [Salt 16B][IV 12B][Tag 16B][Ciphertext]
 */
export function encryptBufferAesGcm(buffer: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, ciphertext]);
}

/**
 * Decrypts an AES-256-GCM encrypted binary buffer, verifying cryptographic authentication tag integrity
 */
export function decryptBufferAesGcm(encryptedBuffer: Buffer, passphrase: string): Buffer {
  if (encryptedBuffer.length < 16 + 12 + 16) {
    throw new Error('Encrypted buffer is too short to contain valid header, salt, IV, and auth tag');
  }

  const salt = encryptedBuffer.subarray(0, 16);
  const iv = encryptedBuffer.subarray(16, 28);
  const tag = encryptedBuffer.subarray(28, 44);
  const ciphertext = encryptedBuffer.subarray(44);

  const key = crypto.scryptSync(passphrase, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
