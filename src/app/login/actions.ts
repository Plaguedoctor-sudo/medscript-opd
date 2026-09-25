'use server';

import { cookies } from 'next/headers';
import { db } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  hashPin,
  verifyPinHash,
  createSessionToken,
  SESSION_COOKIE_NAME,
  getSecurityConfig,
} from '@/lib/auth';
import {
  getClientIp,
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinRateLimit,
} from '@/lib/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

export interface LoginResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

export async function loginWithPin(
  pin: string,
  targetRedirect?: string
): Promise<LoginResult> {
  const trimmedPin = pin.trim();
  const clientIp = await getClientIp();

  if (!trimmedPin) {
    return { success: false, error: 'Please enter your consultation desk PIN.' };
  }

  // 1. Check rate limit
  const rateLimitStatus = checkPinRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    await logAuditEvent({
      action: 'AUTH_LOCKOUT',
      details: `Rate limit triggered: IP locked out for ${rateLimitStatus.retryAfterSeconds}s`,
      status: 'WARNING',
      ipAddress: clientIp,
    });
    return {
      success: false,
      error: `Consultation desk temporarily locked due to repeated incorrect attempts. Please retry in ${rateLimitStatus.retryAfterSeconds} seconds.`,
    };
  }

  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  if (!settings || !settings.pinHash) {
    return { success: false, error: 'No PIN has been configured in Clinic Settings.' };
  }

  // 2. Constant-time PIN verification to prevent timing attacks
  const isValid = verifyPinHash(trimmedPin, settings.pinHash);

  if (!isValid) {
    const failedResult = recordFailedPinAttempt(clientIp);

    await logAuditEvent({
      action: 'AUTH_LOGIN_FAILURE',
      details: `Failed PIN entry attempt. Remaining attempts: ${failedResult.remainingAttempts}`,
      status: 'FAILURE',
      ipAddress: clientIp,
    });

    if (failedResult.isLocked) {
      return {
        success: false,
        error: `Consultation desk locked for 5 minutes due to 5 consecutive incorrect PIN attempts.`,
      };
    }

    return {
      success: false,
      error: `Incorrect PIN. ${failedResult.remainingAttempts} attempt(s) remaining before 5-minute lockout.`,
    };
  }

  // 3. Reset failed attempts counter on success
  resetPinRateLimit(clientIp);

  await logAuditEvent({
    action: 'AUTH_LOGIN_SUCCESS',
    details: 'Consultation desk successfully unlocked',
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  // Create session token and set secure HTTP-only cookie
  const token = createSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  });

  const destination = targetRedirect && targetRedirect.startsWith('/') && !targetRedirect.startsWith('//')
    ? targetRedirect
    : '/';

  return { success: true, redirectUrl: destination };
}

export async function lockDeskAction(): Promise<void> {
  const clientIp = await getClientIp();
  await logAuditEvent({
    action: 'AUTH_LOGOUT',
    details: 'Consultation desk locked',
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}

export interface SecurityUpdateResult {
  success: boolean;
  message: string;
}

export async function updateSecuritySettings(
  enabled: boolean,
  pin?: string,
  confirmPin?: string,
  autoLockMinutes?: number
): Promise<SecurityUpdateResult> {
  const { pinConfigured } = await getSecurityConfig();
  const validAutoLock = autoLockMinutes !== undefined && [0, 5, 10, 15, 30, 60].includes(autoLockMinutes)
    ? autoLockMinutes
    : 15;

  // If enabling security or changing PIN:
  if (pin && pin.trim().length > 0) {
    const cleanPin = pin.trim();

    if (cleanPin.length < 4 || cleanPin.length > 8) {
      return {
        success: false,
        message: 'PIN must be between 4 and 8 digits.',
      };
    }

    if (!/^\d+$/.test(cleanPin)) {
      return {
        success: false,
        message: 'PIN should contain only numbers (0–9).',
      };
    }

    if (cleanPin !== confirmPin?.trim()) {
      return {
        success: false,
        message: 'PIN and Confirm PIN do not match.',
      };
    }

    const hashed = hashPin(cleanPin);

    await db
      .update(clinicSettings)
      .set({
        pinHash: hashed,
        securityEnabled: enabled,
        autoLockMinutes: validAutoLock,
      })
      .where(eq(clinicSettings.id, 1));

    await logAuditEvent({
      action: 'SECURITY_SETTINGS_UPDATED',
      details: `PIN updated. Protection: ${enabled ? 'Enabled' : 'Disabled'}, AutoLock: ${validAutoLock}min`,
      status: 'SUCCESS',
    });

    // Also auto-login the current session so doctor isn't locked out immediately
    if (enabled) {
      const token = createSessionToken();
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
      });
    }

    revalidatePath('/', 'layout');
    return {
      success: true,
      message: enabled
        ? 'PIN protection enabled successfully! Your consultation desk is secured.'
        : 'PIN updated successfully.',
    };
  }

  // Enabling without setting a new PIN:
  if (enabled) {
    if (!pinConfigured) {
      return {
        success: false,
        message: 'Please set a 4 to 8 digit PIN before enabling protection.',
      };
    }

    await db
      .update(clinicSettings)
      .set({
        securityEnabled: true,
        autoLockMinutes: validAutoLock,
      })
      .where(eq(clinicSettings.id, 1));

    await logAuditEvent({
      action: 'SECURITY_SETTINGS_UPDATED',
      details: `PIN protection enabled. AutoLock: ${validAutoLock}min`,
      status: 'SUCCESS',
    });

    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'PIN protection is now active.',
    };
  }

  // Disabling security
  await db
    .update(clinicSettings)
    .set({
      securityEnabled: false,
      autoLockMinutes: validAutoLock,
    })
    .where(eq(clinicSettings.id, 1));

  await logAuditEvent({
    action: 'SECURITY_SETTINGS_UPDATED',
    details: 'PIN protection disabled. Direct access restored.',
    status: 'WARNING',
  });

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'PIN protection has been disabled. Direct access is restored.',
  };
}
