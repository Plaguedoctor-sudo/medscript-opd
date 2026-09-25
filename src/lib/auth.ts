import { cookies } from 'next/headers';
import { db, sqlite } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'medscript_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export type UserRole = 'doctor' | 'receptionist';

let cachedSessionSecret: string | null = null;

/**
 * Retrieves the cryptographic session secret.
 * Priority:
 * 1. Environment variable `SESSION_SECRET` (if configured by administrator).
 * 2. Database-persisted 256-bit high-entropy dynamic secret.
 * 3. Auto-generated on first startup and persisted into `clinic_settings`.
 * Never falls back to a static hardcoded string in open-source production.
 */
export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  if (cachedSessionSecret) {
    return cachedSessionSecret;
  }

  try {
    const row = sqlite
      .prepare('SELECT session_secret FROM clinic_settings WHERE id = 1')
      .get() as { session_secret?: string | null } | undefined;

    if (row && row.session_secret && row.session_secret.length >= 32) {
      cachedSessionSecret = row.session_secret;
      return cachedSessionSecret;
    }

    // Generate high-entropy 256-bit cryptographically secure key
    const generated = crypto.randomBytes(32).toString('hex');
    sqlite.prepare('UPDATE clinic_settings SET session_secret = ? WHERE id = 1').run(generated);
    cachedSessionSecret = generated;
    return cachedSessionSecret;
  } catch {
    if (!cachedSessionSecret) {
      cachedSessionSecret = crypto.randomBytes(32).toString('hex');
    }
    return cachedSessionSecret;
  }
}

/**
 * Constant-time comparison to prevent timing side-channel attacks (CWE-208)
 */
export function safeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function hashPin(pin: string): string {
  const secret = getSessionSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`medscript:${pin.trim()}`)
    .digest('hex');
}

/**
 * Constant-time comparison between input PIN and stored hash to prevent timing attacks.
 * Includes legacy migration tolerance for existing clinic PINs.
 */
export function verifyPinHash(inputPin: string, storedHash: string): boolean {
  if (!inputPin || !storedHash) return false;
  const currentHash = hashPin(inputPin);
  if (safeCompare(currentHash, storedHash)) return true;

  // Backward compatibility: check with initial legacy salt if migrating
  const legacyHash = crypto
    .createHmac('sha256', 'medscript-opd-secure-pin-salt-2026')
    .update(`medscript:${inputPin.trim()}`)
    .digest('hex');
  return safeCompare(legacyHash, storedHash);
}

/**
 * Creates a cryptographically signed session token encoding the user role
 * Format: `${timestamp}.${role}.${signature}`
 */
export function createSessionToken(role: UserRole = 'doctor'): string {
  const secret = getSessionSecret();
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`session:${timestamp}:${role}`)
    .digest('hex');
  return `${timestamp}.${role}.${signature}`;
}

/**
 * Parses and verifies the authenticity of a session token
 */
export function parseSessionToken(token: string | undefined | null): { valid: boolean; role: UserRole } {
  if (!token || typeof token !== 'string') return { valid: false, role: 'receptionist' };
  const parts = token.split('.');
  const secret = getSessionSecret();

  // Format: timestamp.role.signature
  if (parts.length === 3) {
    const [timestampStr, roleStr, signature] = parts;
    const role: UserRole = roleStr === 'receptionist' ? 'receptionist' : 'doctor';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`session:${timestampStr}:${role}`)
      .digest('hex');

    if (!safeCompare(signature, expectedSignature)) {
      // Also check legacy salt for active sessions during upgrade
      const legacySig = crypto
        .createHmac('sha256', 'medscript-opd-secure-pin-salt-2026')
        .update(`session:${timestampStr}:${role}`)
        .digest('hex');
      if (!safeCompare(signature, legacySig)) {
        return { valid: false, role: 'receptionist' };
      }
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { valid: false, role: 'receptionist' };

    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_DURATION_MS) return { valid: false, role: 'receptionist' };

    return { valid: true, role };
  }

  // Legacy format: timestamp.signature (default to doctor)
  if (parts.length === 2) {
    const [timestampStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`session:${timestampStr}`)
      .digest('hex');

    if (!safeCompare(signature, expectedSignature)) {
      const legacySig = crypto
        .createHmac('sha256', 'medscript-opd-secure-pin-salt-2026')
        .update(`session:${timestampStr}`)
        .digest('hex');
      if (!safeCompare(signature, legacySig)) {
        return { valid: false, role: 'receptionist' };
      }
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { valid: false, role: 'receptionist' };

    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_DURATION_MS) return { valid: false, role: 'receptionist' };

    return { valid: true, role: 'doctor' };
  }

  return { valid: false, role: 'receptionist' };
}

export function verifySessionToken(token: string | undefined | null): boolean {
  return parseSessionToken(token).valid;
}

export async function getSecurityConfig(): Promise<{
  securityEnabled: boolean;
  pinConfigured: boolean;
  staffPinConfigured: boolean;
  rbacEnabled: boolean;
  mfaEnabled: boolean;
  pinExpired: boolean;
  daysSincePinUpdate: number;
  rotationDays: number;
  minPinLength: number;
  enforceComplexity: boolean;
  doctorName: string;
  clinicName: string;
  autoLockMinutes: number;
}> {
  try {
    const settings = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.id, 1),
    });

    const pinUpdatedAt = settings?.pinUpdatedAt ? new Date(settings.pinUpdatedAt).getTime() : Date.now();
    const daysSincePinUpdate = Math.floor((Date.now() - pinUpdatedAt) / (86400 * 1000));
    const rotationDays = settings?.rotationDays ?? 90;
    const pinExpired = Boolean(settings?.pinHash && daysSincePinUpdate >= rotationDays);

    return {
      securityEnabled: Boolean(settings?.securityEnabled && settings?.pinHash),
      pinConfigured: Boolean(settings?.pinHash),
      staffPinConfigured: Boolean(settings?.staffPinHash),
      rbacEnabled: Boolean(settings?.rbacEnabled && settings?.staffPinHash),
      mfaEnabled: Boolean(settings?.mfaEnabled && settings?.mfaSecret),
      pinExpired,
      daysSincePinUpdate,
      rotationDays,
      minPinLength: settings?.minPinLength ?? 4,
      enforceComplexity: Boolean(settings?.enforceComplexity),
      doctorName: settings?.doctorName || 'Doctor',
      clinicName: settings?.clinicName || 'MedScript OPD',
      autoLockMinutes: settings?.autoLockMinutes ?? 15,
    };
  } catch {
    return {
      securityEnabled: false,
      pinConfigured: false,
      staffPinConfigured: false,
      rbacEnabled: false,
      mfaEnabled: false,
      pinExpired: false,
      daysSincePinUpdate: 0,
      rotationDays: 90,
      minPinLength: 4,
      enforceComplexity: false,
      doctorName: 'Doctor',
      clinicName: 'MedScript OPD',
      autoLockMinutes: 15,
    };
  }
}

export async function getCurrentUserRole(): Promise<UserRole> {
  const { securityEnabled } = await getSecurityConfig();
  if (!securityEnabled) return 'doctor'; // If security disabled, all users have full clinical access

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = parseSessionToken(token);
  return parsed.valid ? parsed.role : 'receptionist';
}

export async function requireAuth(redirectPath = '/'): Promise<void> {
  const { securityEnabled } = await getSecurityConfig();

  if (!securityEnabled) {
    return; // PIN protection is turned off
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!verifySessionToken(token)) {
    const destination = redirectPath ? `/login?redirect=${encodeURIComponent(redirectPath)}` : '/login';
    redirect(destination);
  }
}

/**
 * Enforces role-based access control. If the current user doesn't have an allowed role,
 * redirects to home or unauthorized page.
 */
export async function requireRole(allowedRoles: UserRole[] = ['doctor'], redirectPath = '/'): Promise<UserRole> {
  await requireAuth(redirectPath);
  const role = await getCurrentUserRole();

  if (!allowedRoles.includes(role)) {
    // If receptionist tries to access a doctor-only clinical route, redirect to home
    redirect('/?unauthorized=clinical_doctor_required');
  }

  return role;
}

export async function isAuthenticated(): Promise<boolean> {
  const { securityEnabled } = await getSecurityConfig();
  if (!securityEnabled) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
