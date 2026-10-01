'use server';

import { cookies, headers } from 'next/headers';
import { db, sqlite } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function isSecureConnection(): Promise<boolean> {
  try {
    const headerList = await headers();
    const proto = headerList.get('x-forwarded-proto');
    if (proto) {
      return proto.toLowerCase() === 'https';
    }
    const referer = headerList.get('referer');
    if (referer && referer.startsWith('https://')) {
      return true;
    }
    const origin = headerList.get('origin');
    if (origin && origin.startsWith('https://')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
import {
  hashPin,
  verifyPinHash,
  createSessionToken,
  SESSION_COOKIE_NAME,
  getSecurityConfig,
  getCurrentUser,
  getCurrentUserRole,
  UserRole,
  isDoctor,
} from '@/lib/auth';
import { SafeStaffUser } from '@/types';
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
  isDefaultPassword?: boolean;
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
    userRole = 'admin_doctor';
    if (!settings.pinHash.startsWith('scrypt:v1:')) {
      try {
        const upgraded = hashPin(trimmedPin);
        sqlite.prepare('UPDATE clinic_settings SET pin_hash = ? WHERE id = 1').run(upgraded);
      } catch {}
    }
  } else if (settings.staffPinHash && verifyPinHash(trimmedPin, settings.staffPinHash)) {
    userRole = 'receptionist';
    if (!settings.staffPinHash.startsWith('scrypt:v1:')) {
      try {
        const upgraded = hashPin(trimmedPin);
        sqlite.prepare('UPDATE clinic_settings SET staff_pin_hash = ? WHERE id = 1').run(upgraded);
      } catch {}
    }
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
  if (isDoctor(userRole) && settings.mfaEnabled && settings.mfaSecret) {
    const trimmedMfa = mfaCode ? mfaCode.trim() : '';

    if (!trimmedMfa) {
      // PIN is valid, prompt for Step 2 Authenticator verification
      return {
        success: false,
        requiresMfa: true,
        role: userRole,
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
    actorRole: isDoctor(userRole) ? 'DOCTOR' : 'RECEPTIONIST',
    details: isDoctor(userRole)
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
    secure: await isSecureConnection(),
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60, // 12 hours clinical shift window
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
export async function breakGlassEmergencyAction(
  reason?: string,
  emergencyPin?: string
): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
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

  // Check clinic security settings
  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  if (settings?.securityEnabled) {
    const cleanPin = (emergencyPin || '').trim();
    if (!cleanPin) {
      return {
        success: false,
        error: 'Security enabled: Emergency break-glass protocol requires a valid Staff or Doctor PIN.',
      };
    }

    const isStaffValid = settings.staffPinHash ? verifyPinHash(cleanPin, settings.staffPinHash) : false;
    const isDoctorValid = settings.pinHash ? verifyPinHash(cleanPin, settings.pinHash) : false;

    if (!isStaffValid && !isDoctorValid) {
      recordFailedPinAttempt(clientIp);
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILURE',
        actorRole: 'SYSTEM',
        details: `⚠️ UNAUTHORIZED BREAK-GLASS ATTEMPT: Invalid emergency PIN supplied for reason "${cleanReason}"`,
        status: 'FAILURE',
        ipAddress: clientIp,
      });
      return {
        success: false,
        error: 'Invalid emergency PIN. Access denied and unauthorized attempt logged.',
      };
    }
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
    secure: await isSecureConnection(),
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
  const { pinConfigured, securityEnabled } = await getSecurityConfig();
  const currentRole = await getCurrentUserRole();

  // If desk security is active or PIN is configured, ONLY an authenticated Doctor can alter security
  if (pinConfigured || securityEnabled) {
    if (!isDoctor(currentRole)) {
      return {
        success: false,
        message: 'Unauthorized: Verified Doctor session required to modify consultation desk security.',
      };
    }
  }

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
      secure: await isSecureConnection(),
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
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
  if (!isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Doctor credentials required to configure MFA.' };
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
  if (!isDoctor(role)) {
    return { success: false, message: 'Unauthorized: Doctor credentials required to configure MFA.' };
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
  if (!isDoctor(role)) {
    return { success: false, message: 'Unauthorized: Doctor credentials required to disable MFA.' };
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
  if (!role) {
    return; // Silently discard unauthenticated requests to prevent audit log flooding
  }
  const actorRole = role.toUpperCase();
  await logAuditEvent({
    action,
    actorRole,
    details: details.slice(0, 500),
    status,
  });
}

/**
 * Runs SQLite live integrity verification diagnostics (Doctor only)
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
  const role = await getCurrentUserRole();
  if (!isDoctor(role)) {
    return {
      healthy: false,
      integrityResult: 'Unauthorized: Doctor credentials required',
      foreignKeyResult: 'Unauthorized',
      journalMode: 'UNKNOWN',
      pageSize: 0,
      pageCount: 0,
      totalSizeBytes: 0,
    };
  }

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

export interface CreateStaffUserInput {
  loginId: string;
  password: string;
  name: string;
  role: UserRole;
  subRole?: string;
  department?: string;
  phone?: string;
  email?: string;
  qualifications?: string;
  regNumber?: string;
}

export interface UpdateStaffUserInput {
  name: string;
  role: UserRole;
  subRole?: string;
  department?: string;
  phone?: string;
  email?: string;
  qualifications?: string;
  regNumber?: string;
  newPassword?: string;
}

/**
 * Authenticates an individual staff member using their Login ID and Password
 */
export async function loginWithCredentials(
  loginId: string,
  password: string,
  targetRedirect?: string
): Promise<LoginResult & { user?: SafeStaffUser }> {
  const cleanLoginId = loginId.trim().toLowerCase();
  const cleanPassword = password.trim();
  const clientIp = await getClientIp();

  if (!cleanLoginId || !cleanPassword) {
    return { success: false, error: 'Please enter both your Login ID and Password.' };
  }

  // 1. Check rate limit on both Client IP and Target Account (Anti-Distributed Brute Force)
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
      error: `Access temporarily locked due to repeated incorrect attempts. Please retry in ${rateLimitStatus.retryAfterSeconds} seconds.`,
    };
  }

  const accountKey = `user:${cleanLoginId}`;
  const accountRateLimit = checkPinRateLimit(accountKey);
  if (!accountRateLimit.allowed) {
    await logAuditEvent({
      action: 'AUTH_LOCKOUT',
      details: `Account rate limit triggered: Account '${cleanLoginId}' locked out for ${accountRateLimit.retryAfterSeconds}s`,
      status: 'WARNING',
      ipAddress: clientIp,
    });
    return {
      success: false,
      error: `This account has been temporarily locked due to repeated incorrect attempts. Please retry in ${accountRateLimit.retryAfterSeconds} seconds.`,
    };
  }

  // 2. Fetch user by login_id
  const user = sqlite
    .prepare('SELECT * FROM staff_users WHERE LOWER(login_id) = ?')
    .get(cleanLoginId) as {
      id: number;
      login_id: string;
      password_hash: string;
      name: string;
      role: UserRole;
      sub_role?: string | null;
      department?: string | null;
      phone?: string | null;
      email?: string | null;
      qualifications?: string | null;
      reg_number?: string | null;
      is_active: number;
      password_updated_at?: number | null;
    } | undefined;

  if (!user) {
    // Constant-time execution against dummy hash to prevent timing side-channel and user enumeration (OWASP WSTG-IDNT-04, WSTG-ATHN-02)
    const DUMMY_SCRYPT_HASH =
      'scrypt:v1:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
    verifyPinHash(cleanPassword, DUMMY_SCRYPT_HASH);

    const failedResult = recordFailedPinAttempt(clientIp);
    recordFailedPinAttempt(accountKey);
    await logAuditEvent({
      action: 'AUTH_LOGIN_FAILURE',
      details: `Failed login attempt for unknown Login ID '${cleanLoginId}'. Remaining attempts: ${failedResult.remainingAttempts}`,
      status: 'FAILURE',
      ipAddress: clientIp,
    });

    if (failedResult.isLocked) {
      return {
        success: false,
        error: 'Consultation desk locked for 5 minutes due to consecutive incorrect login attempts.',
      };
    }

    return {
      success: false,
      error: `Invalid Login ID or Password. ${failedResult.remainingAttempts} attempt(s) remaining before lockout.`,
    };
  }

  if (!Boolean(user.is_active)) {
    return {
      success: false,
      error: 'This account has been deactivated. Please contact your Chief Medical Officer (Admin Doctor).',
    };
  }

  // 2b. Block un-provisioned accounts and banned default passwords (CWE-798 compliance)
  if (!user.password_hash) {
    return {
      success: false,
      error: 'This account has not been provisioned with a secure password. Please contact your Administrator.',
    };
  }

  const BANNED_DEFAULT_PASSWORDS = [
    'admin123',
    'doctor123',
    'nurse123',
    'reception123',
    'lab123',
    'pharmacy123',
    'pharm123',
    'manager123',
    'password123',
    'admin1234',
    '12345678',
  ];

  if (BANNED_DEFAULT_PASSWORDS.includes(cleanPassword.toLowerCase())) {
    await logAuditEvent({
      action: 'SECURITY_ALERT_TRIGGERED',
      actorRole: 'ANONYMOUS',
      details: `Authentication blocked: Attempt to log in with decommissioned default password on account '${cleanLoginId}'`,
      status: 'FAILURE',
      ipAddress: clientIp,
    });
    return {
      success: false,
      error: 'Default passwords are permanently prohibited by system security policy. Please use your custom private credentials.',
    };
  }

  // 3. Verify password
  if (!verifyPinHash(cleanPassword, user.password_hash)) {
    const failedResult = recordFailedPinAttempt(clientIp);
    recordFailedPinAttempt(accountKey);
    await logAuditEvent({
      action: 'AUTH_LOGIN_FAILURE',
      details: `Failed password attempt for '${user.name}' (${cleanLoginId}). Remaining attempts: ${failedResult.remainingAttempts}`,
      status: 'FAILURE',
      ipAddress: clientIp,
    });

    if (failedResult.isLocked) {
      return {
        success: false,
        error: 'Consultation desk locked for 5 minutes due to consecutive incorrect login attempts.',
      };
    }

    return {
      success: false,
      error: `Invalid Login ID or Password. ${failedResult.remainingAttempts} attempt(s) remaining before lockout.`,
    };
  }

  // 4. Success: reset rate limit & update last login
  resetPinRateLimit(clientIp);
  resetPinRateLimit(accountKey);
  sqlite.prepare('UPDATE staff_users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id);

  // 5. Create and set cryptographic session token
  const sessionToken = createSessionToken(user.role, user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: await isSecureConnection(),
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60, // 12 hours max shift
  });

  await logAuditEvent({
    action: 'AUTH_LOGIN_SUCCESS',
    actorRole: user.role.toUpperCase(),
    details: `Staff member '${user.name}' logged in successfully as ${user.role} (${cleanLoginId})`,
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  const safeUser: SafeStaffUser = {
    id: user.id,
    loginId: user.login_id,
    name: user.name,
    role: user.role,
    subRole: user.sub_role,
    department: user.department,
    phone: user.phone,
    email: user.email,
    qualifications: user.qualifications,
    regNumber: user.reg_number,
    isActive: Boolean(user.is_active),
    passwordUpdatedAt: user.password_updated_at || null,
  };

  return {
    success: true,
    redirectUrl: targetRedirect || '/',
    role: user.role,
    user: safeUser,
    isDefaultPassword: false,
  };
}

/**
 * Logs out the active user session and redirects to /login
 */
export async function logoutUser(): Promise<{ success: boolean }> {
  const clientIp = await getClientIp();
  const currentRole = await getCurrentUserRole();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  await logAuditEvent({
    action: 'AUTH_LOGOUT',
    actorRole: currentRole.toUpperCase(),
    details: 'User logged out of consultation desk',
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  redirect('/login');
}

/**
 * Returns all registered staff profiles (safe view without password hashes)
 */
export async function getStaffUsers(): Promise<SafeStaffUser[]> {
  const currentRole = await getCurrentUserRole();
  if (!isDoctor(currentRole)) {
    return [];
  }

  try {
    const rows = sqlite
      .prepare(
        "SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, password_updated_at as passwordUpdatedAt, last_login_at as lastLoginAt, created_at as createdAt FROM staff_users ORDER BY role = 'admin_doctor' DESC, id ASC"
      )
      .all() as {
        id: number;
        loginId: string;
        name: string;
        role: UserRole;
        subRole?: string | null;
        department?: string | null;
        phone?: string | null;
        email?: string | null;
        qualifications?: string | null;
        regNumber?: string | null;
        isActive: number;
        passwordUpdatedAt?: number | null;
        lastLoginAt?: number | null;
        createdAt?: number | null;
      }[];

    return rows.map((r) => ({
      ...r,
      isActive: Boolean(r.isActive),
      passwordUpdatedAt: r.passwordUpdatedAt || null,
      lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
    }));
  } catch (err) {
    console.error('Failed to get staff users:', err);
    return [];
  }
}

/**
 * Public/sanitized persona lookup for the login screen.
 * Strips all contact and sensitive information (phone, email, regNumber, timestamps, audit info)
 * and returns only active staff names, departments, and roles for persona quick-selection.
 */
export async function getActiveStaffUsersForLogin(): Promise<SafeStaffUser[]> {
  try {
    const rows = sqlite
      .prepare(
        "SELECT id, login_id as loginId, name, role, sub_role as subRole, department FROM staff_users WHERE is_active = 1 AND password_hash NOT LIKE 'DISABLED:%' AND password_hash IS NOT NULL ORDER BY role = 'admin_doctor' DESC, id ASC"
      )
      .all() as {
        id: number;
        loginId: string;
        name: string;
        role: UserRole;
        subRole?: string | null;
        department?: string | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      loginId: r.loginId,
      name: r.name,
      role: r.role,
      subRole: r.subRole || null,
      department: r.department || null,
      phone: null,
      email: null,
      qualifications: null,
      regNumber: null,
      isActive: true,
      passwordUpdatedAt: null,
      lastLoginAt: null,
      createdAt: null,
    }));
  } catch (err) {
    console.error('Failed to get active staff users for login:', err);
    return [];
  }
}

/**
 * Checks whether the clinic system requires initial sovereign administrator provisioning.
 * Returns true if no staff accounts exist, or if the primary admin has no password configured.
 */
export async function getSetupStatus(): Promise<{ setupRequired: boolean; doctorName: string }> {
  try {
    const adminUser = sqlite
      .prepare("SELECT id, name, login_id, password_hash FROM staff_users WHERE role = 'admin_doctor' AND is_active = 1 LIMIT 1")
      .get() as { id: number; name: string; login_id: string; password_hash: string | null } | undefined;

    const clinic = sqlite
      .prepare('SELECT doctor_name FROM clinic_settings WHERE id = 1')
      .get() as { doctor_name?: string } | undefined;

    const doctorName = clinic?.doctor_name || 'Dr. Nitin Hiralal Sonare';

    if (!adminUser || !adminUser.password_hash || adminUser.password_hash.startsWith('DISABLED:')) {
      return { setupRequired: true, doctorName };
    }

    return { setupRequired: false, doctorName };
  } catch {
    return { setupRequired: true, doctorName: 'Doctor' };
  }
}

/**
 * Initializes the Sovereign Administrator (CMO) account with custom credentials.
 * Only callable when no active administrator password exists (CWE-306 protection).
 * Hardened: completely blocks default passwords (CWE-798 compliance).
 */
export async function setupInitialAdminAccount(
  loginId: string,
  password: string,
  confirmPassword: string,
  doctorName?: string
): Promise<{ success: boolean; error?: string; redirectUrl?: string }> {
  const clientIp = await getClientIp();

  // 1. Verify that setup is required
  const { setupRequired } = await getSetupStatus();
  if (!setupRequired) {
    await logAuditEvent({
      action: 'SECURITY_ALERT_TRIGGERED',
      actorRole: 'ANONYMOUS',
      details: 'Rejected attempt to call initial admin setup when admin account is already provisioned',
      status: 'FAILURE',
      ipAddress: clientIp,
    });
    return { success: false, error: 'System administrator account is already provisioned.' };
  }

  const cleanLoginId = loginId.trim().toLowerCase();
  const cleanPassword = password.trim();

  // 2. Validate Login ID
  if (!cleanLoginId || cleanLoginId.length < 3) {
    return { success: false, error: 'Login ID must be at least 3 characters long.' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanLoginId)) {
    return { success: false, error: 'Login ID can only contain letters, numbers, hyphens, and underscores.' };
  }

  // 3. Reject confirm mismatch
  if (cleanPassword !== confirmPassword.trim()) {
    return { success: false, error: 'Password and Confirm Password do not match.' };
  }

  // 4. Validate credential complexity policy
  const policy = validateCredentialPolicy(cleanPassword, { minLength: 8, requireComplexity: true });
  if (!policy.valid) {
    return { success: false, error: policy.reason || 'Password does not meet security criteria.' };
  }

  // 5. Explicitly reject any factory defaults
  const BANNED_DEFAULT_PASSWORDS = [
    'admin123',
    'doctor123',
    'nurse123',
    'reception123',
    'lab123',
    'pharmacy123',
    'pharm123',
    'manager123',
    'password123',
    'admin1234',
    '12345678',
  ];
  if (BANNED_DEFAULT_PASSWORDS.includes(cleanPassword.toLowerCase()) || cleanPassword.toLowerCase() === `${cleanLoginId}123`) {
    return {
      success: false,
      error: 'Cannot use a factory default or predictable password. Please choose a strong private passphrase.',
    };
  }

  const passwordHash = hashPin(cleanPassword);
  const now = Date.now();
  const effectiveName = (doctorName || '').trim() || 'Dr. Nitin Hiralal Sonare';

  try {
    const existingAdmin = sqlite
      .prepare("SELECT id FROM staff_users WHERE role = 'admin_doctor' LIMIT 1")
      .get() as { id: number } | undefined;

    let adminId: number;

    if (existingAdmin) {
      sqlite
        .prepare(`
          UPDATE staff_users
          SET login_id = ?, password_hash = ?, name = ?, password_updated_at = ?, is_active = 1
          WHERE id = ?
        `)
        .run(cleanLoginId, passwordHash, effectiveName, now, existingAdmin.id);
      adminId = existingAdmin.id;
    } else {
      const info = sqlite
        .prepare(`
          INSERT INTO staff_users (login_id, password_hash, name, role, sub_role, department, is_active, password_updated_at, created_at)
          VALUES (?, ?, ?, 'admin_doctor', 'Chief Medical Officer & Hospital Admin', 'Administration & OPD', 1, ?, ?)
        `)
        .run(cleanLoginId, passwordHash, effectiveName, now, now);
      adminId = Number(info.lastInsertRowid);
    }

    try {
      sqlite.prepare('UPDATE clinic_settings SET doctor_name = ? WHERE id = 1').run(effectiveName);
    } catch {}

    await logAuditEvent({
      action: 'SECURITY_SETTINGS_UPDATED',
      actorRole: 'ADMIN_DOCTOR',
      details: `Primary Administrator account '${cleanLoginId}' successfully provisioned with custom credentials. Default credentials eliminated.`,
      status: 'SUCCESS',
      ipAddress: clientIp,
    });

    const sessionToken = createSessionToken('admin_doctor', adminId);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: await isSecureConnection(),
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });

    return { success: true, redirectUrl: '/' };
  } catch (err) {
    console.error('Failed to setup admin account:', err);
    return { success: false, error: 'Failed to configure administrator account. Please check server logs.' };
  }
}



/**
 * Creates a new staff member profile with dedicated Login ID & Password
 * Protected: Admin Doctor authority required
 */
export async function createStaffUser(
  input: CreateStaffUserInput
): Promise<{ success: boolean; error?: string; userId?: number }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== 'admin_doctor' && currentRole !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only an Admin or Doctor can create new staff profiles.' };
  }

  const cleanLoginId = input.loginId.trim().toLowerCase();
  if (!cleanLoginId || cleanLoginId.length < 3) {
    return { success: false, error: 'Login ID must be at least 3 characters long.' };
  }

  if (!input.name.trim()) {
    return { success: false, error: 'Staff member name is required.' };
  }

  if (!input.password) {
    return { success: false, error: 'Password is required.' };
  }

  const policy = validateCredentialPolicy(input.password, { minLength: 8, requireComplexity: true });
  if (!policy.valid) {
    return {
      success: false,
      error: policy.reason || 'Password must be at least 8 characters long and contain both letters and numbers.',
    };
  }

  const forbiddenDefaults = ['admin123', 'doctor123', 'nurse123', 'reception123', 'lab123', 'password123'];
  if (forbiddenDefaults.includes(input.password.toLowerCase())) {
    return { success: false, error: 'Cannot use a factory default or common demo password.' };
  }

  const existing = sqlite.prepare('SELECT id FROM staff_users WHERE LOWER(login_id) = ?').get(cleanLoginId);
  if (existing) {
    return { success: false, error: `Login ID '${cleanLoginId}' is already in use by another staff member.` };
  }

  try {
    const passwordHash = hashPin(input.password);
    const now = Date.now();
    const result = sqlite
      .prepare(`
        INSERT INTO staff_users (login_id, password_hash, name, role, sub_role, department, phone, email, qualifications, reg_number, is_active, password_updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
      .run(
        cleanLoginId,
        passwordHash,
        input.name.trim(),
        input.role,
        input.subRole?.trim() || null,
        input.department?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.qualifications?.trim() || null,
        input.regNumber?.trim() || null,
        now,
        now
      );

    const newId = Number(result.lastInsertRowid);

    await logAuditEvent({
      action: 'STAFF_USER_CREATED',
      actorRole: currentRole === 'admin_doctor' ? 'ADMIN_DOCTOR' : 'DOCTOR',
      details: `Created new staff user '${input.name.trim()}' with role ${input.role} (${cleanLoginId})`,
      status: 'SUCCESS',
    });

    revalidatePath('/settings');
    return { success: true, userId: newId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create staff member.' };
  }
}

/**
 * Updates staff member details or resets their password
 * Protected: Admin Doctor or Doctor authority required
 */
export async function updateStaffUser(
  id: number,
  input: UpdateStaffUserInput
): Promise<{ success: boolean; error?: string }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== 'admin_doctor' && currentRole !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only an Admin or Doctor can update staff profiles.' };
  }

  try {
    const now = Date.now();

    // Prevent demoting the sole active Admin Doctor
    if (input.role !== 'admin_doctor') {
      const targetUser = sqlite.prepare('SELECT role FROM staff_users WHERE id = ?').get(id) as { role: string } | undefined;
      if (targetUser?.role === 'admin_doctor') {
        const adminCount = sqlite
          .prepare("SELECT COUNT(*) as count FROM staff_users WHERE role = 'admin_doctor' AND is_active = 1")
          .get() as { count: number };
        if (adminCount.count <= 1) {
          return { success: false, error: 'Cannot demote the sole active Admin Doctor account. Assign another Admin Doctor first.' };
        }
      }
    }

    if (input.newPassword && input.newPassword.trim().length > 0) {
      const trimmedPwd = input.newPassword.trim();
      const policy = validateCredentialPolicy(trimmedPwd, { minLength: 8, requireComplexity: true });
      if (!policy.valid) {
        return {
          success: false,
          error: policy.reason || 'Password must be at least 8 characters long and contain both letters and numbers.',
        };
      }

      const forbiddenDefaults = ['admin123', 'doctor123', 'nurse123', 'reception123', 'lab123', 'password123'];
      if (forbiddenDefaults.includes(trimmedPwd.toLowerCase())) {
        return { success: false, error: 'Cannot use a factory default or common demo password.' };
      }

      const newHash = hashPin(trimmedPwd);
      sqlite
        .prepare(`
          UPDATE staff_users
          SET name = ?, role = ?, sub_role = ?, department = ?, phone = ?, email = ?, qualifications = ?, reg_number = ?, password_hash = ?, password_updated_at = ?
          WHERE id = ?
        `)
        .run(
          input.name.trim(),
          input.role,
          input.subRole?.trim() || null,
          input.department?.trim() || null,
          input.phone?.trim() || null,
          input.email?.trim() || null,
          input.qualifications?.trim() || null,
          input.regNumber?.trim() || null,
          newHash,
          now,
          id
        );
    } else {
      sqlite
        .prepare(`
          UPDATE staff_users
          SET name = ?, role = ?, sub_role = ?, department = ?, phone = ?, email = ?, qualifications = ?, reg_number = ?
          WHERE id = ?
        `)
        .run(
          input.name.trim(),
          input.role,
          input.subRole?.trim() || null,
          input.department?.trim() || null,
          input.phone?.trim() || null,
          input.email?.trim() || null,
          input.qualifications?.trim() || null,
          input.regNumber?.trim() || null,
          id
        );
    }

    await logAuditEvent({
      action: 'STAFF_USER_UPDATED',
      actorRole: currentRole === 'admin_doctor' ? 'ADMIN_DOCTOR' : 'DOCTOR',
      details: `Updated staff profile id=${id} ('${input.name.trim()}', role: ${input.role})`,
      status: 'SUCCESS',
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update staff member.' };
  }
}

/**
 * Allows the currently authenticated staff member or doctor to update their own password.
 * Revokes any stale sessions and enforces credential complexity requirements.
 */
export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required. Please log in first.' };
  }

  const cleanCurrent = currentPassword.trim();
  const cleanNew = newPassword.trim();
  const cleanConfirm = confirmPassword.trim();

  if (!cleanCurrent || !cleanNew || !cleanConfirm) {
    return { success: false, error: 'Current password, new password, and confirmation are required.' };
  }

  if (cleanNew !== cleanConfirm) {
    return { success: false, error: 'New password and confirmation do not match.' };
  }

  // Retrieve user record including current password_hash
  const dbUser = sqlite
    .prepare('SELECT id, password_hash, name, role, login_id FROM staff_users WHERE id = ?')
    .get(user.id) as {
      id: number;
      password_hash: string;
      name: string;
      role: UserRole;
      login_id: string;
    } | undefined;

  if (!dbUser) {
    return { success: false, error: 'Staff account not found.' };
  }

  // Verify current password
  if (!verifyPinHash(cleanCurrent, dbUser.password_hash)) {
    const clientIp = await getClientIp();
    await logAuditEvent({
      action: 'SECURITY_ALERT_TRIGGERED',
      actorRole: user.role.toUpperCase(),
      details: `Failed password change attempt: incorrect current password for '${user.name}' (${user.loginId})`,
      status: 'FAILURE',
      ipAddress: clientIp,
    });
    return { success: false, error: 'Current password does not match.' };
  }

  // Check complexity and length policy
  const policy = validateCredentialPolicy(cleanNew, { minLength: 8, requireComplexity: true });
  if (!policy.valid) {
    return { success: false, error: policy.reason || 'New password does not meet security criteria.' };
  }

  // Block default seed passwords
  const forbidden = [
    'admin123',
    'doctor123',
    'nurse123',
    'reception123',
    'lab123',
    'password123',
    `${dbUser.login_id}123`,
  ];
  if (forbidden.includes(cleanNew.toLowerCase())) {
    return {
      success: false,
      error: 'Cannot use a known default or trivial password. Please choose a strong unique passphrase.',
    };
  }

  const now = Date.now();
  const newHash = hashPin(cleanNew);

  sqlite
    .prepare('UPDATE staff_users SET password_hash = ?, password_updated_at = ? WHERE id = ?')
    .run(newHash, now, user.id);

  // Update session cookie with the new timestamp so current user is not logged out
  const newToken = createSessionToken(dbUser.role, user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: await isSecureConnection(),
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });

  const clientIp = await getClientIp();
  await logAuditEvent({
    action: 'PASSWORD_ROTATED',
    actorRole: user.role.toUpperCase(),
    details: `Staff member '${user.name}' successfully changed their password. Default credentials revoked.`,
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  revalidatePath('/');
  return { success: true };
}

/**
 * Toggles active/inactive status of a staff member
 * Protected: Admin Doctor authority required
 */
export async function toggleStaffUserStatus(
  id: number,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== 'admin_doctor' && currentRole !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only an Admin or Doctor can change account status.' };
  }

  // Prevent disabling the last admin doctor
  if (!isActive) {
    const adminCount = sqlite
      .prepare("SELECT COUNT(*) as count FROM staff_users WHERE role = 'admin_doctor' AND is_active = 1")
      .get() as { count: number };
    const target = sqlite.prepare('SELECT role FROM staff_users WHERE id = ?').get(id) as { role: string } | undefined;
    if (target?.role === 'admin_doctor' && adminCount.count <= 1) {
      return { success: false, error: 'Cannot deactivate the sole active Admin Doctor account.' };
    }
  }

  try {
    sqlite.prepare('UPDATE staff_users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
    await logAuditEvent({
      action: 'STAFF_USER_UPDATED',
      actorRole: currentRole === 'admin_doctor' ? 'ADMIN_DOCTOR' : 'DOCTOR',
      details: `Changed staff account id=${id} status to ${isActive ? 'ACTIVE' : 'DEACTIVATED'}`,
      status: 'SUCCESS',
    });
    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update status.' };
  }
}

/**
 * Permanently removes a staff member profile
 * Protected: Admin Doctor or Doctor authority required
 */
export async function deleteStaffUser(id: number): Promise<{ success: boolean; error?: string }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== 'admin_doctor' && currentRole !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only an Admin or Doctor can delete staff accounts.' };
  }

  const target = sqlite.prepare('SELECT role, name FROM staff_users WHERE id = ?').get(id) as { role: string; name: string } | undefined;
  if (!target) {
    return { success: false, error: 'Staff member not found.' };
  }

  if (target.role === 'admin_doctor') {
    const adminCount = sqlite
      .prepare("SELECT COUNT(*) as count FROM staff_users WHERE role = 'admin_doctor'")
      .get() as { count: number };
    if (adminCount.count <= 1) {
      return { success: false, error: 'Cannot delete the sole Admin Doctor account.' };
    }
  }

  try {
    sqlite.prepare('DELETE FROM staff_users WHERE id = ?').run(id);
    await logAuditEvent({
      action: 'STAFF_USER_DELETED',
      actorRole: currentRole === 'admin_doctor' ? 'ADMIN_DOCTOR' : 'DOCTOR',
      details: `Deleted staff profile id=${id} (${target.name})`,
      status: 'SUCCESS',
    });
    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete staff member.' };
  }
}

/**
 * Targeted session revocation for a compromised staff account (MITRE T1078.004)
 */
export async function revokeStaffSessionAction(userId: number): Promise<{ success: boolean; error?: string }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== 'admin_doctor' && currentRole !== 'doctor') {
    return { success: false, error: 'Unauthorized: Only an Admin or Doctor can revoke staff sessions.' };
  }
  const { revokeStaffSessions } = await import('@/lib/auth');
  revokeStaffSessions(userId);
  await logAuditEvent({
    action: 'SECURITY_ALERT_TRIGGERED',
    actorRole: currentRole === 'admin_doctor' ? 'ADMIN_DOCTOR' : 'DOCTOR',
    details: `Targeted session revocation executed for staff user id=${userId}`,
    status: 'WARNING',
  });
  revalidatePath('/settings');
  return { success: true };
}

