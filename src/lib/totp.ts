import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * Standard RFC 4648 Base32 alphabet
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generates a clean base64 data URL for an offline QR code
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: 256,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

/**
 * Generates a cryptographically random Base32 secret string (20 bytes = 160 bits, standard for TOTP)
 */
export function generateBase32Secret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }

  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5);
    const index = parseInt(chunk, 2);
    secret += BASE32_ALPHABET[index];
  }

  return secret;
}

/**
 * Decodes a Base32 string into a Buffer
 */
export function decodeBase32(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * Computes a 6-digit TOTP code for a given secret at a specific time counter
 * Follows RFC 6238 (TOTP) and RFC 4226 (HOTP)
 */
export function generateTotpCode(secret: string, timestampMs = Date.now(), timeStepSeconds = 30): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestampMs / 1000 / timeStepSeconds);

  // Buffer representation of 64-bit integer (big-endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a user-entered TOTP token with ± 1 time-step drift tolerance (± 30 seconds)
 */
export function verifyTotpToken(
  token: string,
  secret: string,
  timestampMs = Date.now(),
  window = 1
): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  for (let i = -window; i <= window; i++) {
    const time = timestampMs + i * 30 * 1000;
    const expected = generateTotpCode(secret, time);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Generates an OTP Auth URI compatible with Google Authenticator, Authy, Aegis, 1Password, etc.
 */
export function getOtpAuthUrl({
  issuer = 'MedScript OPD',
  accountName,
  secret,
}: {
  issuer?: string;
  accountName: string;
  secret: string;
}): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates 5 single-use emergency backup recovery scratch codes (e.g. "8A3F-9K2D")
 */
export function generateEmergencyBackupCodes(count = 5): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`;
    rawCodes.push(formatted);
    hashedCodes.push(hashBackupCode(formatted));
  }

  return { rawCodes, hashedCodes };
}

/**
 * Hashes a backup code with SHA-256 for secure database storage
 */
export function hashBackupCode(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(`medscript:backup:${clean}`).digest('hex');
}

/**
 * Verifies and consumes a backup code from stored hashed codes
 */
export function verifyAndConsumeBackupCode(
  inputCode: string,
  storedHashedCodesJson: string | null | undefined
): { valid: boolean; remainingHashedCodesJson: string } {
  if (!storedHashedCodesJson) {
    return { valid: false, remainingHashedCodesJson: '[]' };
  }

  try {
    const hashes: string[] = JSON.parse(storedHashedCodesJson);
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return { valid: false, remainingHashedCodesJson: '[]' };
    }

    const inputHash = hashBackupCode(inputCode);
    const inputBuf = Buffer.from(inputHash, 'utf8');

    const index = hashes.findIndex((h) => {
      const hBuf = Buffer.from(h, 'utf8');
      return hBuf.length === inputBuf.length && crypto.timingSafeEqual(hBuf, inputBuf);
    });

    if (index !== -1) {
      // Consume the code
      hashes.splice(index, 1);
      return { valid: true, remainingHashedCodesJson: JSON.stringify(hashes) };
    }

    return { valid: false, remainingHashedCodesJson: storedHashedCodesJson };
  } catch {
    return { valid: false, remainingHashedCodesJson: '[]' };
  }
}
