/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
import { cookies, headers } from 'next/headers';
import { db, sqlite } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

import { SafeStaffUser } from '@/types';

export const SESSION_COOKIE_NAME = 'medscript_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours max shift lifetime

export type UserRole = 'admin_doctor' | 'doctor' | 'nurse' | 'receptionist' | 'lab_technician';

export function isValidUserRole(role: string): role is UserRole {
  return ['admin_doctor', 'doctor', 'nurse', 'receptionist', 'lab_technician'].includes(role);
}

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

/**
 * Hashes PIN or Passcode using memory-hard scrypt KDF (N=16384, r=8, p=1)
 * Format: `scrypt:v1:<salt_hex>:<hash_hex>`
 * Resists GPU and ASIC offline dictionary cracking.
 */
export function hashPin(pin: string): string {
  const clean = pin.trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt:v1:${salt}:${derived.toString('hex')}`;
}

/**
 * Constant-time verification of PIN against stored hash.
 * Supports memory-hard scrypt with seamless migration from legacy HMAC.
 */
export function verifyPinHash(inputPin: string, storedHash: string): boolean {
  if (!inputPin || !storedHash) return false;
  const clean = inputPin.trim();

  // Modern scrypt KDF hash format
  if (storedHash.startsWith('scrypt:v1:')) {
    const parts = storedHash.split(':');
    if (parts.length === 4) {
      const salt = parts[2];
      const expectedHex = parts[3];
      const derived = crypto.scryptSync(clean, salt, 32, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 32 * 1024 * 1024,
      });
      return safeCompare(derived.toString('hex'), expectedHex);
    }
    return false;
  }

  // Backward compatibility: verify legacy HMAC hash using known salt candidates
  const candidates = [
    'medscript-opd-secure-pin-salt-2026',
    getSessionSecret(),
    process.env.SESSION_SECRET || '',
  ].filter(Boolean);

  for (const candidateSecret of candidates) {
    const legacyHmac = crypto
      .createHmac('sha256', candidateSecret)
      .update(`medscript:${clean}`)
      .digest('hex');
    if (safeCompare(legacyHmac, storedHash)) {
      return true;
    }
  }

  return false;
}

export function computeSubnetFingerprint(ip?: string | null): string {
  if (!ip) return 'any';
  const clean = ip.trim().replace(/^::ffff:/, '');
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return 'loopback';
  let prefix = clean;
  if (clean.includes('.')) {
    // IPv4 /24 subnet
    prefix = clean.split('.').slice(0, 3).join('.');
  } else if (clean.includes(':')) {
    // IPv6 /48 prefix
    prefix = clean.split(':').slice(0, 3).join(':');
  }
  return crypto.createHash('sha256').update(`subnet:${prefix}`).digest('hex').slice(0, 12);
}

/**
 * Creates a cryptographically signed session token encoding the user role, user ID, and optional client subnet
 * Format: `${timestamp}.${role}.${userId}.${signature}` or `${timestamp}.${role}.${userId}.${subnet}.${signature}`
 */
export function createSessionToken(role: UserRole = 'doctor', userId?: number, clientIp?: string): string {
  const secret = getSessionSecret();
  const timestamp = Date.now().toString();
  const uId = userId ? userId.toString() : '0';
  const subnet = clientIp ? computeSubnetFingerprint(clientIp) : '';

  if (subnet && subnet !== 'any') {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`session:${timestamp}:${role}:${uId}:${subnet}`)
      .digest('hex');
    return `${timestamp}.${role}.${uId}.${subnet}.${signature}`;
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`session:${timestamp}:${role}:${uId}`)
    .digest('hex');
  return `${timestamp}.${role}.${uId}.${signature}`;
}

/**
 * Revokes all currently active sessions server-side by updating session_revoked_before.
 */
export function revokeAllSessions(): void {
  try {
    const now = Date.now();
    sqlite.prepare('UPDATE clinic_settings SET session_revoked_before = ? WHERE id = 1').run(now);
  } catch (err) {
    console.error('Failed to update session_revoked_before:', err);
  }
}

/**
 * Revokes all sessions belonging specifically to a single staff user (MITRE T1078.004 blast radius containment)
 */
export function revokeStaffSessions(userId: number): void {
  try {
    const now = Date.now();
    sqlite.prepare('UPDATE staff_users SET sessions_revoked_before = ? WHERE id = ?').run(now, userId);
  } catch (err) {
    console.error('Failed to update staff_users.sessions_revoked_before:', err);
  }
}

export interface ParsedSessionToken {
  valid: boolean;
  role: UserRole;
  userId?: number;
}

/**
 * Parses and verifies the authenticity and revocation status of a session token
 */
export function parseSessionToken(token: string | undefined | null, clientIp?: string): ParsedSessionToken {
  if (!token || typeof token !== 'string') return { valid: false, role: 'receptionist' };
  const parts = token.split('.');
  const secret = getSessionSecret();

  // Subnet-Bound Format (MITRE T1550.004): timestamp.role.userId.subnet.signature
  if (parts.length === 5) {
    const [timestampStr, roleStr, userIdStr, subnetStr, signature] = parts;
    const role: UserRole = isValidUserRole(roleStr) ? roleStr : 'doctor';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`session:${timestampStr}:${roleStr}:${userIdStr}:${subnetStr}`)
      .digest('hex');

    if (!safeCompare(signature, expectedSignature)) {
      return { valid: false, role: 'receptionist' };
    }

    const timestamp = parseInt(timestampStr, 10);
    const userId = parseInt(userIdStr, 10);
    if (isNaN(timestamp)) return { valid: false, role: 'receptionist' };

    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_DURATION_MS) return { valid: false, role: 'receptionist' };

    // Verify subnet match if clientIp is provided
    if (clientIp) {
      const currentSubnet = computeSubnetFingerprint(clientIp);
      if (subnetStr !== 'loopback' && currentSubnet !== 'loopback' && subnetStr !== currentSubnet) {
        return { valid: false, role: 'receptionist' };
      }
    }

    // Check server-side global revocation timestamp
    try {
      const row = sqlite
        .prepare('SELECT session_revoked_before FROM clinic_settings WHERE id = 1')
        .get() as { session_revoked_before?: number | null } | undefined;
      if (row && row.session_revoked_before && timestamp < row.session_revoked_before) {
        return { valid: false, role: 'receptionist' };
      }
    } catch {}

    // Verify staff account is active, credentials not revoked, and per-user session not revoked
    let effectiveRole: UserRole = role;
    if (!isNaN(userId) && userId > 0) {
      try {
        const staff = sqlite
          .prepare('SELECT role, is_active, password_updated_at, sessions_revoked_before FROM staff_users WHERE id = ?')
          .get(userId) as { role?: string; is_active?: number; password_updated_at?: number | null; sessions_revoked_before?: number | null } | undefined;
        if (!staff || !Boolean(staff.is_active)) {
          return { valid: false, role: 'receptionist' };
        }
        if (staff.password_updated_at && timestamp < staff.password_updated_at) {
          return { valid: false, role: 'receptionist' };
        }
        if (staff.sessions_revoked_before && timestamp < staff.sessions_revoked_before) {
          return { valid: false, role: 'receptionist' };
        }
        if (staff.role && isValidUserRole(staff.role)) {
          effectiveRole = staff.role as UserRole;
        }
      } catch {}
    }

    return { valid: true, role: effectiveRole, userId: isNaN(userId) || userId === 0 ? undefined : userId };
  }

  // Modern Format: timestamp.role.userId.signature
  if (parts.length === 4) {
    const [timestampStr, roleStr, userIdStr, signature] = parts;
    const role: UserRole = isValidUserRole(roleStr) ? roleStr : 'doctor';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`session:${timestampStr}:${roleStr}:${userIdStr}`)
      .digest('hex');

    if (!safeCompare(signature, expectedSignature)) {
      return { valid: false, role: 'receptionist' };
    }

    const timestamp = parseInt(timestampStr, 10);
    const userId = parseInt(userIdStr, 10);
    if (isNaN(timestamp)) return { valid: false, role: 'receptionist' };

    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_DURATION_MS) return { valid: false, role: 'receptionist' };

    // Check server-side revocation timestamp
    try {
      const row = sqlite
        .prepare('SELECT session_revoked_before FROM clinic_settings WHERE id = 1')
        .get() as { session_revoked_before?: number | null } | undefined;
      if (row && row.session_revoked_before && timestamp < row.session_revoked_before) {
        return { valid: false, role: 'receptionist' };
      }
    } catch {
      // Ignore if column not present yet
    }

    // Verify staff account is still active and credentials have not been revoked
    let effectiveRole: UserRole = role;
    if (!isNaN(userId) && userId > 0) {
      try {
        const staff = sqlite
          .prepare('SELECT role, is_active, password_updated_at, sessions_revoked_before FROM staff_users WHERE id = ?')
          .get(userId) as { role?: string; is_active?: number; password_updated_at?: number | null; sessions_revoked_before?: number | null } | undefined;
        if (!staff || !Boolean(staff.is_active)) {
          // Deactivated or deleted staff member: reject session immediately
          return { valid: false, role: 'receptionist' };
        }
        if (staff.password_updated_at && timestamp < staff.password_updated_at) {
          // Password or privileges updated after this token was issued: reject session
          return { valid: false, role: 'receptionist' };
        }
        if (staff.sessions_revoked_before && timestamp < staff.sessions_revoked_before) {
          // Target user sessions revoked (MITRE T1078.004)
          return { valid: false, role: 'receptionist' };
        }
        if (staff.role && isValidUserRole(staff.role)) {
          effectiveRole = staff.role as UserRole;
        }
      } catch {
        // Fall back to token values if table schema doesn't match
      }
    }

    return { valid: true, role: effectiveRole, userId: isNaN(userId) || userId === 0 ? undefined : userId };
  }

  // Format: timestamp.role.signature
  if (parts.length === 3) {
    const [timestampStr, roleStr, signature] = parts;
    const role: UserRole = isValidUserRole(roleStr) ? roleStr : 'doctor';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`session:${timestampStr}:${role}`)
      .digest('hex');

    if (!safeCompare(signature, expectedSignature)) {
      return { valid: false, role: 'receptionist' };
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { valid: false, role: 'receptionist' };

    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_DURATION_MS) return { valid: false, role: 'receptionist' };

    // Check server-side revocation timestamp
    try {
      const row = sqlite
        .prepare('SELECT session_revoked_before FROM clinic_settings WHERE id = 1')
        .get() as { session_revoked_before?: number | null } | undefined;
      if (row && row.session_revoked_before && timestamp < row.session_revoked_before) {
        return { valid: false, role: 'receptionist' };
      }
    } catch {
      // Ignore if column not present yet
    }

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
      return { valid: false, role: 'receptionist' };
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { valid: false, role: 'receptionist' };

    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_DURATION_MS) return { valid: false, role: 'receptionist' };

    // Check server-side revocation timestamp
    try {
      const row = sqlite
        .prepare('SELECT session_revoked_before FROM clinic_settings WHERE id = 1')
        .get() as { session_revoked_before?: number | null } | undefined;
      if (row && row.session_revoked_before && timestamp < row.session_revoked_before) {
        return { valid: false, role: 'receptionist' };
      }
    } catch {
      // Ignore if column not present yet
    }

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

export async function getCurrentUser(): Promise<SafeStaffUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = parseSessionToken(token);

  if (!parsed.valid) {
    const { securityEnabled } = await getSecurityConfig();
    if (!securityEnabled) {
      try {
        const defaultAdmin = sqlite
          .prepare(
            'SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, password_updated_at as passwordUpdatedAt, created_at as createdAt FROM staff_users WHERE role = ? LIMIT 1'
          )
          .get('admin_doctor') as SafeStaffUser | undefined;
        return defaultAdmin || {
          id: 1,
          loginId: 'admin',
          name: 'Dr. Admin (CMO)',
          role: 'admin_doctor',
          subRole: 'Chief Medical Officer & Hospital Admin',
          department: 'Administration & OPD',
          isActive: true,
        };
      } catch {
        return {
          id: 1,
          loginId: 'admin',
          name: 'Dr. Admin (CMO)',
          role: 'admin_doctor',
          subRole: 'Chief Medical Officer & Hospital Admin',
          department: 'Administration & OPD',
          isActive: true,
        };
      }
    }
    return null;
  }

  // Look up user by ID from session
  if (parsed.userId && parsed.userId > 0) {
    try {
      const user = sqlite
        .prepare(
          'SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, password_updated_at as passwordUpdatedAt, created_at as createdAt FROM staff_users WHERE id = ?'
        )
        .get(parsed.userId) as SafeStaffUser | undefined;
      if (user && Boolean(user.isActive)) {
        return user;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Fallback ONLY for legacy tokens with no userId (e.g. Master PIN doctor session)
  try {
    const userByRole = sqlite
      .prepare(
        'SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, password_updated_at as passwordUpdatedAt, created_at as createdAt FROM staff_users WHERE role = ? AND is_active = 1 LIMIT 1'
      )
      .get(parsed.role) as SafeStaffUser | undefined;
    if (userByRole) return userByRole;
  } catch {}

  return null;
}

async function isLocalHostRequest(): Promise<boolean> {
  try {
    const headerList = await headers();
    const host = headerList.get('host') || '';
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')) {
      return true;
    }
    const realIp = headerList.get('x-real-ip');
    if (realIp && (realIp === '127.0.0.1' || realIp === '::1' || realIp === '::ffff:127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getCurrentUserRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = parseSessionToken(token);
  if (parsed.valid) {
    return parsed.role;
  }

  const { securityEnabled } = await getSecurityConfig();
  // Defense-in-depth: Defaulting to admin_doctor when security is disabled is ONLY permitted on the host loopback PC.
  // Anonymous network traffic over LAN receives guest/receptionist role with zero administrative access.
  if (!securityEnabled && (await isLocalHostRequest())) {
    return 'admin_doctor';
  }

  return 'receptionist';
}

export async function requireAuth(redirectPath = '/'): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (verifySessionToken(token)) {
    return;
  }

  const { securityEnabled } = await getSecurityConfig();
  if (!securityEnabled && (await isLocalHostRequest())) {
    return; // Local desktop session only
  }

  const destination = redirectPath ? `/login?redirect=${encodeURIComponent(redirectPath)}` : '/login';
  redirect(destination);
}

/**
 * Enforces role-based access control.
 * Admin Doctor has full authorities across the entire hospital system.
 */
export async function requireRole(allowedRoles: UserRole[] = ['doctor', 'admin_doctor'], redirectPath = '/'): Promise<UserRole> {
  await requireAuth(redirectPath);
  const role = await getCurrentUserRole();

  // Admin Doctor has full unrestricted authority
  if (role === 'admin_doctor') {
    return role;
  }

  // Exact role match
  if (allowedRoles.includes(role)) {
    return role;
  }

  // If 'doctor' is allowed and role is doctor
  if (allowedRoles.includes('doctor') && role === 'doctor') {
    return role;
  }

  redirect('/?unauthorized=access_denied_role_' + role);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (verifySessionToken(token)) return true;

  const { securityEnabled } = await getSecurityConfig();
  // Convenience bypass is strictly isolated to the physical desktop loopback session.
  // Remote LAN traffic (phones, tablets, adjacent terminals) must ALWAYS authenticate.
  if (!securityEnabled && (await isLocalHostRequest())) {
    return true;
  }

  return false;
}

// Role Authority Helpers
export function isAdminDoctor(role: UserRole): boolean {
  return role === 'admin_doctor';
}

export function isDoctor(role: UserRole): boolean {
  return role === 'admin_doctor' || role === 'doctor';
}

export function isNurse(role: UserRole): boolean {
  return role === 'admin_doctor' || role === 'nurse';
}

export function isReceptionist(role: UserRole): boolean {
  return role === 'admin_doctor' || role === 'receptionist';
}

export function isLabTech(role: UserRole): boolean {
  return role === 'admin_doctor' || role === 'lab_technician';
}

// ── Granular Permissions & Role Scope ──────────────────────────────────────────
import {
  type Permission,
  ROLE_PERMISSIONS,
  canDo,
  type RoleScope,
  getRoleScope,
} from '@/lib/role-scope';

export {
  type Permission,
  ROLE_PERMISSIONS,
  canDo,
  type RoleScope,
  getRoleScope,
};


/**
 * Server action guard: redirects to home if the current user
 * does not have the required permission. Returns the current role on success.
 */
export async function requirePermission(
  permission: Permission,
  redirectPath = '/'
): Promise<UserRole> {
  await requireAuth(redirectPath);
  const role = await getCurrentUserRole();
  if (!canDo(role, permission)) {
    redirect(`/?unauthorized=access_denied_role_${role}`);
  }
  return role;
}

