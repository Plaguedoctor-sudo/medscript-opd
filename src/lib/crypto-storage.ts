import crypto from 'crypto';

const MASTER_ENCRYPTION_SECRET =
  process.env.DATA_ENCRYPTION_KEY ||
  process.env.SESSION_SECRET ||
  'medscript-opd-phi-aes256-gcm-master-key-2026';

/**
 * Derives a 256-bit (32-byte) key from the master secret using SHA-256
 */
function getDerivedKey(secret: string = MASTER_ENCRYPTION_SECRET): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
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
  }

  return { valid: true };
}
