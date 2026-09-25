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
  getCurrentUserRole,
  UserRole,
} from '@/lib/auth';
import {
  getClientIp,
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinRateLimit,
  checkBreakGlassRateLimit,
  recordBreakGlassAttempt,
} from '@/lib/rate-limiter';
import { logAuditEvent, AuditAction, AuditStatus } from '@/lib/audit';
import {
  generateBase32Secret,
  verifyTotpToken,
  getOtpAuthUrl,
  generateEmergencyBackupCodes,
  verifyAndConsumeBackupCode,
  generateQrCodeDataUrl,
} from '@/lib/totp';
import { validateCredentialPolicy } from '@/lib/crypto-storage';

export interface LoginResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
  role?: UserRole;
  requiresMfa?: boolean;
}

export async function loginWithPin(
  pin: string,
  targetRedirect?: string,
  mfaCode?: string
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

  // 2b. If Doctor and Multi-Factor Authentication (MFA) is enabled, verify 2nd factor
  if (userRole === 'doctor' && settings.mfaEnabled && settings.mfaSecret) {
    const trimmedMfa = mfaCode ? mfaCode.trim() : '';

    if (!trimmedMfa) {
      // PIN is valid, prompt for Step 2 Authenticator verification
      return {
        success: false,
        requiresMfa: true,
        role: 'doctor',
      };
    }

    let isMfaValid = false;
    let usedBackupCode = false;

    // Check standard 6-digit TOTP code
    if (trimmedMfa.length === 6 && /^\d{6}$/.test(trimmedMfa)) {
      isMfaValid = verifyTotpToken(trimmedMfa, settings.mfaSecret);
    }

    // Check emergency single-use backup recovery code (format: XXXX-XXXX)
    if (!isMfaValid && settings.mfaBackupCodes) {
      const backupResult = verifyAndConsumeBackupCode(trimmedMfa, settings.mfaBackupCodes);
      if (backupResult.valid) {
        isMfaValid = true;
        usedBackupCode = true;
        await db
          .update(clinicSettings)
          .set({ mfaBackupCodes: backupResult.remainingHashedCodesJson })
          .where(eq(clinicSettings.id, 1));
      }
    }

    if (!isMfaValid) {
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILURE',
        actorRole: 'DOCTOR',
        details: 'Failed 2FA / MFA authentication attempt (incorrect code)',
        status: 'FAILURE',
        ipAddress: clientIp,
      });

      return {
        success: false,
        requiresMfa: true,
        role: 'doctor',
        error: 'Incorrect 6-digit Authenticator code or recovery code. Please check your app.',
      };
    }

    await logAuditEvent({
      action: 'MFA_VERIFIED',
      actorRole: 'DOCTOR',
      details: usedBackupCode
        ? 'Doctor 2FA verified using single-use emergency backup recovery code'
        : 'Doctor 2FA verified using TOTP Authenticator code',
      status: 'SUCCESS',
      ipAddress: clientIp,
    });
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
 * Emergency Break-Glass access for life-threatening triage (CWE-306 Hardened)
 */
export async function breakGlassEmergencyAction(reason?: string): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  const clientIp = await getClientIp();
  const cleanReason = (reason || '').trim();

  // Enforce mandatory documented justification
  if (cleanReason.length < 15) {
    return {
      success: false,
      error: 'Emergency break-glass access requires a documented clinical justification (minimum 15 characters).',
    };
  }

  // Enforce rate limiting: maximum 2 uses per 60 minutes
  const rateLimit = checkBreakGlassRateLimit(clientIp);
  if (!rateLimit.allowed) {
    await logAuditEvent({
      action: 'AUTH_LOCKOUT',
      actorRole: 'SYSTEM',
      details: `Emergency break-glass rate limit exceeded from ${clientIp}. Access blocked.`,
      status: 'WARNING',
      ipAddress: clientIp,
    });
    return {
      success: false,
      error: `Emergency break-glass limit reached. Retry after ${rateLimit.retryAfterMinutes} minutes or authenticate with Doctor PIN.`,
    };
  }

  recordBreakGlassAttempt(clientIp);

  await logAuditEvent({
    action: 'AUTH_LOGIN_SUCCESS',
    actorRole: 'SYSTEM',
    details: `⚠️ EMERGENCY BREAK-GLASS TRIGGERED: Reason: "${cleanReason}". Direct patient history view granted for 30 minutes.`,
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
  rbacEnabled?: boolean,
  rotationDays?: number,
  minPinLength?: number,
  enforceComplexity?: boolean
): Promise<SecurityUpdateResult> {
  const { pinConfigured } = await getSecurityConfig();
  const validAutoLock = autoLockMinutes !== undefined && [0, 5, 10, 15, 30, 60].includes(autoLockMinutes)
    ? autoLockMinutes
    : 15;
  const validRotationDays = rotationDays !== undefined && [30, 60, 90, 180, 365].includes(rotationDays)
    ? rotationDays
    : 90;
  const validMinLength = minPinLength !== undefined && minPinLength >= 4 && minPinLength <= 16
    ? minPinLength
    : 4;

  const updatePayload: {
    securityEnabled: boolean;
    autoLockMinutes: number;
    rbacEnabled: boolean;
    rotationDays: number;
    minPinLength: number;
    enforceComplexity: boolean;
    pinHash?: string;
    pinUpdatedAt?: Date;
    staffPinHash?: string;
  } = {
    securityEnabled: enabled,
    autoLockMinutes: validAutoLock,
    rbacEnabled: Boolean(rbacEnabled),
    rotationDays: validRotationDays,
    minPinLength: validMinLength,
    enforceComplexity: Boolean(enforceComplexity),
  };

  // If setting/updating Doctor Master PIN:
  if (pin && pin.trim().length > 0) {
    const cleanPin = pin.trim();
    const policyResult = validateCredentialPolicy(cleanPin, {
      minLength: validMinLength,
      requireComplexity: Boolean(enforceComplexity),
    });

    if (!policyResult.valid) {
      return { success: false, message: policyResult.reason || 'Passcode does not meet policy requirements.' };
    }

    if (cleanPin !== confirmPin?.trim()) {
      return { success: false, message: 'Doctor PIN/Passcode and Confirm PIN do not match.' };
    }

    updatePayload.pinHash = hashPin(cleanPin);
    updatePayload.pinUpdatedAt = new Date();

    await logAuditEvent({
      action: 'PASSWORD_ROTATED',
      actorRole: 'DOCTOR',
      details: `Doctor master passcode rotated/updated. Next rotation in ${validRotationDays} days.`,
      status: 'SUCCESS',
    });
  }

  // If setting/updating Staff / Receptionist PIN:
  if (staffPin && staffPin.trim().length > 0) {
    const cleanStaffPin = staffPin.trim();

    if (cleanStaffPin.length < 4 || cleanStaffPin.length > 16) {
      return { success: false, message: 'Staff PIN must be between 4 and 16 characters.' };
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
    details: `Security updated: Active: ${enabled}, RBAC: ${Boolean(rbacEnabled)}, AutoLock: ${validAutoLock}m, Rotation: ${validRotationDays}d`,
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
 * Initializes Two-Factor Authentication setup: generates Base32 secret, OTP URI, QR Code & 5 emergency recovery scratch codes
 */
export async function setupMfaAction(): Promise<{
  success: boolean;
  secret?: string;
  otpAuthUrl?: string;
  qrCodeDataUrl?: string;
  backupCodes?: string[];
  hashedBackupCodes?: string[];
  error?: string;
}> {
  const role = await getCurrentUserRole();
  if (role !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only the doctor can configure MFA.' };
  }

  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  const secret = generateBase32Secret(20);
  const { rawCodes, hashedCodes } = generateEmergencyBackupCodes(5);
  const otpAuthUrl = getOtpAuthUrl({
    issuer: 'MedScript OPD',
    accountName: settings?.doctorName || 'Doctor',
    secret,
  });
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUrl);

  return {
    success: true,
    secret,
    otpAuthUrl,
    qrCodeDataUrl,
    backupCodes: rawCodes,
    hashedBackupCodes: hashedCodes,
  };
}

/**
 * Confirms and activates Two-Factor Authentication using a 6-digit TOTP code verification
 */
export async function confirmAndEnableMfaAction(
  secret: string,
  verificationCode: string,
  hashedBackupCodes: string[]
): Promise<{ success: boolean; message: string }> {
  const role = await getCurrentUserRole();
  if (role !== 'doctor') {
    return { success: false, message: 'Unauthorized: Only the doctor can configure MFA.' };
  }

  const isValid = verifyTotpToken(verificationCode, secret);
  if (!isValid) {
    return {
      success: false,
      message: 'Verification code incorrect. Please enter the current 6-digit code from your authenticator app.',
    };
  }

  await db
    .update(clinicSettings)
    .set({
      mfaEnabled: true,
      mfaSecret: secret,
      mfaBackupCodes: JSON.stringify(hashedBackupCodes),
    })
    .where(eq(clinicSettings.id, 1));

  await logAuditEvent({
    action: 'MFA_ENABLED',
    actorRole: 'DOCTOR',
    details: 'Two-Factor Authentication (MFA) successfully activated for doctor account',
    status: 'SUCCESS',
  });

  revalidatePath('/', 'layout');
  revalidatePath('/settings');

  return {
    success: true,
    message: 'Multi-Factor Authentication (MFA) activated! 2FA verification will now be required on login.',
  };
}

/**
 * Disables Two-Factor Authentication after verifying Doctor Master PIN
 */
export async function disableMfaAction(pin: string): Promise<{ success: boolean; message: string }> {
  const role = await getCurrentUserRole();
  if (role !== 'doctor') {
    return { success: false, message: 'Unauthorized: Only the doctor can disable MFA.' };
  }

  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  if (!settings?.pinHash || !verifyPinHash(pin, settings.pinHash)) {
    return { success: false, message: 'Incorrect Doctor PIN.' };
  }

  await db
    .update(clinicSettings)
    .set({
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    })
    .where(eq(clinicSettings.id, 1));

  await logAuditEvent({
    action: 'MFA_DISABLED',
    actorRole: 'DOCTOR',
    details: 'Two-Factor Authentication (MFA) was deactivated',
    status: 'WARNING',
  });

  revalidatePath('/', 'layout');
  revalidatePath('/settings');

  return {
    success: true,
    message: 'Multi-Factor Authentication (MFA) has been disabled.',
  };
}

/**
 * Lightweight action to record clinical viewing, printing, and exporting events for compliance
 */
export async function logClinicalAuditAction(
  action: AuditAction,
  details: string,
  status: AuditStatus = 'SUCCESS'
): Promise<void> {
  const role = await getCurrentUserRole();
  const actorRole = role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST';
  await logAuditEvent({
    action,
    actorRole,
    details,
    status,
  });
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
