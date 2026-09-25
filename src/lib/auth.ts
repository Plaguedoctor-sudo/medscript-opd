import { cookies } from 'next/headers';
import { db } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'medscript_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'medscript-opd-secure-pin-salt-2026';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function hashPin(pin: string): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`medscript:${pin.trim()}`)
    .digest('hex');
}

/**
 * Constant-time comparison between input PIN and stored hash to prevent timing attacks
 */
export function verifyPinHash(inputPin: string, storedHash: string): boolean {
  if (!inputPin || !storedHash) return false;
  const inputHash = hashPin(inputPin);
  const bufferA = Buffer.from(inputHash, 'utf8');
  const bufferB = Buffer.from(storedHash, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`session:${timestamp}`)
    .digest('hex');
  return `${timestamp}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`session:${timestampStr}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const age = Date.now() - timestamp;
  if (age < 0 || age > SESSION_DURATION_MS) {
    return false; // Expired
  }

  return true;
}

export async function getSecurityConfig(): Promise<{
  securityEnabled: boolean;
  pinConfigured: boolean;
  doctorName: string;
  clinicName: string;
  autoLockMinutes: number;
}> {
  try {
    const settings = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.id, 1),
    });

    return {
      securityEnabled: Boolean(settings?.securityEnabled && settings?.pinHash),
      pinConfigured: Boolean(settings?.pinHash),
      doctorName: settings?.doctorName || 'Doctor',
      clinicName: settings?.clinicName || 'MedScript OPD',
      autoLockMinutes: settings?.autoLockMinutes ?? 15,
    };
  } catch {
    return {
      securityEnabled: false,
      pinConfigured: false,
      doctorName: 'Doctor',
      clinicName: 'MedScript OPD',
      autoLockMinutes: 15,
    };
  }
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

export async function isAuthenticated(): Promise<boolean> {
  const { securityEnabled } = await getSecurityConfig();
  if (!securityEnabled) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
