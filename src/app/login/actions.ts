'use server';

import { cookies } from 'next/headers';
import { db, sqlite } from '@/db';
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
  UserRole,
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
  role?: UserRole;
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

  // 2. Check Doctor PIN vs Staff PIN (Multi-Role Access Control)
  let userRole: UserRole | null = null;

  if (verifyPinHash(trimmedPin, settings.pinHash)) {
    userRole = 'doctor';
  } else if (settings.staffPinHash && verifyPinHash(trimmedPin, settings.staffPinHash)) {
    userRole = 'receptionist';
  }

  if (!userRole) {
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
    actorRole: userRole === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
    details: userRole === 'doctor'
      ? 'Doctor authenticated with full clinical prescribing authority'
      : 'Front desk staff authenticated with triage and patient intake role',
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  // 4. Create cryptographically signed role session token and set secure HTTP-only cookie
  const token = createSessionToken(userRole);
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

  return { success: true, redirectUrl: destination, role: userRole };
}

export async function lockDeskAction(): Promise<void> {
  const clientIp = await getClientIp();
  await logAuditEvent({
    action: 'AUTH_LOGOUT',
    details: 'Consultation desk screen locked by user',
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}

/**
 * Emergency Break-Glass access for life-threatening triage
 */
export async function breakGlassEmergencyAction(reason?: string): Promise<{ success: boolean; redirectUrl: string }> {
  const clientIp = await getClientIp();
  await logAuditEvent({
    action: 'AUTH_LOGIN_SUCCESS',
    actorRole: 'SYSTEM',
    details: `⚠️ EMERGENCY BREAK-GLASS TRIGGERED: Reason: ${reason || 'Immediate Emergency Care / Triage'}. Direct patient history view granted.`,
    status: 'WARNING',
    ipAddress: clientIp,
  });

  const token = createSessionToken('receptionist');
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60, // 30-minute emergency access window
  });

  return { success: true, redirectUrl: '/patients' };
}

export interface SecurityUpdateResult {
  success: boolean;
  message: string;
}

export async function updateSecuritySettings(
  enabled: boolean,
  pin?: string,
  confirmPin?: string,
  autoLockMinutes?: number,
  staffPin?: string,
  confirmStaffPin?: string,
  rbacEnabled?: boolean
): Promise<SecurityUpdateResult> {
  const { pinConfigured } = await getSecurityConfig();
  const validAutoLock = autoLockMinutes !== undefined && [0, 5, 10, 15, 30, 60].includes(autoLockMinutes)
    ? autoLockMinutes
    : 15;

  const updatePayload: {
    securityEnabled: boolean;
    autoLockMinutes: number;
    rbacEnabled: boolean;
    pinHash?: string;
    staffPinHash?: string;
  } = {
    securityEnabled: enabled,
    autoLockMinutes: validAutoLock,
    rbacEnabled: Boolean(rbacEnabled),
  };

  // If setting/updating Doctor Master PIN:
  if (pin && pin.trim().length > 0) {
    const cleanPin = pin.trim();

    if (cleanPin.length < 4 || cleanPin.length > 8) {
      return { success: false, message: 'Doctor PIN must be between 4 and 8 digits.' };
    }
    if (!/^\d+$/.test(cleanPin)) {
      return { success: false, message: 'Doctor PIN must contain only digits (0–9).' };
    }
    if (cleanPin !== confirmPin?.trim()) {
      return { success: false, message: 'Doctor PIN and Confirm PIN do not match.' };
    }

    updatePayload.pinHash = hashPin(cleanPin);
  }

  // If setting/updating Staff / Receptionist PIN:
  if (staffPin && staffPin.trim().length > 0) {
    const cleanStaffPin = staffPin.trim();

    if (cleanStaffPin.length < 4 || cleanStaffPin.length > 8) {
      return { success: false, message: 'Staff PIN must be between 4 and 8 digits.' };
    }
    if (!/^\d+$/.test(cleanStaffPin)) {
      return { success: false, message: 'Staff PIN must contain only digits (0–9).' };
    }
    if (cleanStaffPin !== confirmStaffPin?.trim()) {
      return { success: false, message: 'Staff PIN and Confirm Staff PIN do not match.' };
    }

    updatePayload.staffPinHash = hashPin(cleanStaffPin);
  }

  // Ensure Doctor PIN is configured before enabling security
  if (enabled && !pinConfigured && !updatePayload.pinHash) {
    return {
      success: false,
      message: 'Please set a Doctor PIN before enabling consultation desk security.',
    };
  }

  await db
    .update(clinicSettings)
    .set(updatePayload)
    .where(eq(clinicSettings.id, 1));

  await logAuditEvent({
    action: 'SECURITY_SETTINGS_UPDATED',
    actorRole: 'DOCTOR',
    details: `Security updated: Active: ${enabled}, RBAC: ${Boolean(rbacEnabled)}, AutoLock: ${validAutoLock}m`,
    status: 'SUCCESS',
  });

  // Keep current active session authenticated as doctor
  if (enabled) {
    const token = createSessionToken('doctor');
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
      ? 'Medical security settings saved! Multi-Role protection is active.'
      : 'PIN protection disabled. Direct clinic access restored.',
  };
}

/**
 * Runs SQLite live integrity verification diagnostics
 */
export async function runDatabaseDiagnostics(): Promise<{
  healthy: boolean;
  integrityResult: string;
  foreignKeyResult: string;
  journalMode: string;
  pageSize: number;
  pageCount: number;
  totalSizeBytes: number;
}> {
  try {
    const integrity = sqlite.pragma('integrity_check') as { integrity_check?: string }[];
    const foreignKeys = sqlite.pragma('foreign_key_check') as unknown[];
    const journalMode = sqlite.pragma('journal_mode') as { journal_mode?: string }[];
    const pageSize = sqlite.pragma('page_size', { simple: true }) as number;
    const pageCount = sqlite.pragma('page_count', { simple: true }) as number;

    const integrityText = integrity && integrity.length > 0 ? String(integrity[0].integrity_check) : 'ok';
    const isHealthy = integrityText.toLowerCase() === 'ok' && foreignKeys.length === 0;

    return {
      healthy: isHealthy,
      integrityResult: integrityText,
      foreignKeyResult: foreignKeys.length === 0 ? 'OK (0 violations)' : `${foreignKeys.length} FK violations`,
      journalMode: journalMode && journalMode.length > 0 ? String(journalMode[0].journal_mode).toUpperCase() : 'WAL',
      pageSize: Number(pageSize) || 4096,
      pageCount: Number(pageCount) || 0,
      totalSizeBytes: (Number(pageSize) || 4096) * (Number(pageCount) || 0),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error running check';
    return {
      healthy: false,
      integrityResult: errorMsg,
      foreignKeyResult: 'Error',
      journalMode: 'UNKNOWN',
      pageSize: 4096,
      pageCount: 0,
      totalSizeBytes: 0,
    };
  }
}
