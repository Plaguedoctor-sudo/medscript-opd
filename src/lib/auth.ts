/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
import { cookies } from 'next/headers';
import { db, sqlite } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

import { SafeStaffUser } from '@/types';

export const SESSION_COOKIE_NAME = 'medscript_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

/**
 * Creates a cryptographically signed session token encoding the user role and user ID
 * Format: `${timestamp}.${role}.${userId}.${signature}`
 */
export function createSessionToken(role: UserRole = 'doctor', userId?: number): string {
  const secret = getSessionSecret();
  const timestamp = Date.now().toString();
  const uId = userId ? userId.toString() : '0';
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

export interface ParsedSessionToken {
  valid: boolean;
  role: UserRole;
  userId?: number;
}

/**
 * Parses and verifies the authenticity and revocation status of a session token
 */
export function parseSessionToken(token: string | undefined | null): ParsedSessionToken {
  if (!token || typeof token !== 'string') return { valid: false, role: 'receptionist' };
  const parts = token.split('.');
  const secret = getSessionSecret();

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

    return { valid: true, role, userId: isNaN(userId) || userId === 0 ? undefined : userId };
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
            'SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, created_at as createdAt FROM staff_users WHERE role = ? LIMIT 1'
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
          'SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, created_at as createdAt FROM staff_users WHERE id = ?'
        )
        .get(parsed.userId) as SafeStaffUser | undefined;
      if (user && Boolean(user.isActive)) {
        return user;
      }
    } catch {
      // Fall through to role lookup
    }
  }

  // Fallback: look up first active user by role
  try {
    const userByRole = sqlite
      .prepare(
        'SELECT id, login_id as loginId, name, role, sub_role as subRole, department, phone, email, qualifications, reg_number as regNumber, is_active as isActive, created_at as createdAt FROM staff_users WHERE role = ? AND is_active = 1 LIMIT 1'
      )
      .get(parsed.role) as SafeStaffUser | undefined;
    if (userByRole) return userByRole;
  } catch {}

  return null;
}

export async function getCurrentUserRole(): Promise<UserRole> {
  const { securityEnabled } = await getSecurityConfig();
  if (!securityEnabled) return 'admin_doctor'; // If security disabled, sovereign local doctor has full authority

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
  const { securityEnabled } = await getSecurityConfig();
  if (!securityEnabled) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
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

// ── Granular Permission Keys ──────────────────────────────────────────────────
export type Permission =
  // Prescriptions / Consultations
  | 'prescription:create'
  | 'prescription:edit'
  | 'prescription:view'
  // Patients
  | 'patient:register'
  | 'patient:edit_demographics'
  | 'patient:view'
  // Appointments / Queue
  | 'appointment:manage'
  | 'appointment:view'
  // IPD
  | 'ipd:view'
  | 'ipd:admit_discharge'
  | 'ipd:clinical_rounds'
  | 'ipd:nursing_notes'
  | 'ipd:emar'
  | 'ipd:fluid_io'
  | 'ipd:services'
  | 'ipd:handovers'
  // Labs
  | 'lab:view'
  | 'lab:manage'
  // Billing / Invoicing
  | 'billing:view'
  | 'billing:manage'
  // Pharmacy / Inventory
  | 'inventory:view'
  | 'inventory:manage'
  // Reports & Analytics
  | 'reports:view'
  | 'reports:idsp'
  // Settings / Admin
  | 'settings:view_own_pin'
  | 'settings:clinic'
  | 'settings:staff_management'
  | 'settings:security'
  | 'settings:backup'
  // Medical Documents
  | 'certificate:issue'
  | 'document:upload'
  | 'template:manage';

/**
 * Declarative permission matrix.
 * admin_doctor inherits ALL permissions (checked first in canDo).
 *
 * Specific Role Constraints:
 * - Lab Technician: Can view prescriptions/requisitions & manage lab data; cannot edit prescriptions or register patients.
 * - Lab data can ONLY be edited by the Lab Technician (and admin_doctor).
 * - Nurse: Can view prescriptions, create new patient bio & manage inpatient care (eMAR, fluid balance, handovers, procedures);
 *   cannot create/edit prescriptions or other exclusive doctor work, and cannot edit lab data.
 */
const ROLE_PERMISSIONS: Record<Exclude<UserRole, 'admin_doctor'>, Permission[]> = {
  doctor: [
    'prescription:create', 'prescription:edit', 'prescription:view',
    'patient:register', 'patient:edit_demographics', 'patient:view',
    'appointment:manage', 'appointment:view',
    'ipd:view', 'ipd:admit_discharge', 'ipd:clinical_rounds', 'ipd:nursing_notes', 'ipd:emar', 'ipd:fluid_io', 'ipd:services', 'ipd:handovers',
    'lab:view', // Doctors view and order labs, but lab data is exclusively edited by lab technician
    'billing:view', 'billing:manage',
    'inventory:view', 'inventory:manage',
    'reports:view', 'reports:idsp',
    'settings:view_own_pin', 'settings:clinic',
    'certificate:issue', 'document:upload', 'template:manage',
  ],
  nurse: [
    'prescription:view', // Can view prescriptions, cannot create or edit
    'patient:register', 'patient:edit_demographics', 'patient:view', // Can create new patient bio
    'appointment:view',
    'ipd:view', 'ipd:nursing_notes', 'ipd:emar', 'ipd:fluid_io', 'ipd:services', 'ipd:handovers',
    'lab:view',
    'inventory:view',
    'settings:view_own_pin',
    'document:upload',
  ],
  receptionist: [
    'prescription:view',
    'patient:register', 'patient:edit_demographics', 'patient:view',
    'appointment:manage', 'appointment:view',
    'ipd:view',
    'billing:view', 'billing:manage',
    'inventory:view',
    'settings:view_own_pin',
    'document:upload',
  ],
  lab_technician: [
    'prescription:view', // Can view prescription / test requisition
    'patient:view',
    'lab:view', 'lab:manage', // Exclusive editor of lab data & results
    'settings:view_own_pin',
  ],
};

export interface RoleScope {
  role: UserRole;
  title: string;
  department: string;
  allowedWork: string[];
  restrictedWork: string[];
  exclusiveWork: string[];
}

export function getRoleScope(role: UserRole): RoleScope {
  switch (role) {
    case 'lab_technician':
      return {
        role: 'lab_technician',
        title: 'Laboratory Technician / Pathologist',
        department: 'Pathology & Diagnostic Laboratory',
        allowedWork: [
          'View doctor prescriptions & lab test requisitions',
          'Enter, calculate, and edit diagnostic laboratory test results & parameter values (Exclusive)',
          'Update test progress and verify report completion status',
          'View patient list & basic clinical profiles',
          'Print and dispatch laboratory diagnostic reports (WhatsApp / PDF)',
          'Manage own security PIN & credentials',
        ],
        restrictedWork: [
          'CANNOT prescribe medications or create prescriptions',
          'CANNOT edit doctor prescriptions or outpatient consultations',
          'CANNOT register new patients or modify patient demographics',
          'CANNOT conduct inpatient clinical rounds or alter treatment orders',
          'CANNOT administer inpatient drugs or perform nursing procedures',
          'CANNOT discharge admitted patients or issue discharge summaries',
          'CANNOT access hospital billing, financial ledgers, or clinic settings',
        ],
        exclusiveWork: [
          'Sole authority to enter, calibrate, and edit laboratory investigation parameters & diagnostic results',
        ],
      };
    case 'nurse':
      return {
        role: 'nurse',
        title: 'Staff Nurse / Nursing Officer',
        department: 'Inpatient (IPD) Ward & Bedside Care',
        allowedWork: [
          'View doctor prescriptions and active treatment orders',
          'Register new patient bio & edit patient demographic records',
          'Record bedside medication administration (eMAR checklist)',
          'Track 24-hour fluid balance (intake & output monitoring)',
          'Administer oxygen therapy, suctioning, drain care & nursing procedures',
          'Record shift-to-shift nursing handover notes & view round handovers',
          'View inpatient diagnostic laboratory reports',
          'Record patient baseline vitals (BP, Pulse, Temp, SpO2, RBS)',
          'Upload patient clinical documents and investigation attachments',
        ],
        restrictedWork: [
          'CANNOT create new clinical prescriptions (Doctor exclusive)',
          'CANNOT edit doctor prescriptions or outpatient consultations (Doctor exclusive)',
          'CANNOT authorize inpatient discharge or generate discharge summaries (Doctor exclusive)',
          'CANNOT issue medical fitness or leave certificates (Doctor exclusive)',
          'CANNOT edit laboratory test result parameters or lab data (Lab Technician exclusive)',
          'CANNOT modify clinic administrative configuration, master PIN, or cloud backups',
        ],
        exclusiveWork: [
          'Bedside medication administration (eMAR verification)',
          'Shift-to-shift nursing handovers and inpatient surveillance',
          'Procedure execution: Oxygen administration, airway suctioning, surgical drain care',
        ],
      };
    case 'doctor':
      return {
        role: 'doctor',
        title: 'Consulting Physician / Doctor',
        department: 'Outpatient (OPD) & Inpatient (IPD) Clinical Care',
        allowedWork: [
          'Create, diagnose, and edit outpatient prescriptions (Exclusive)',
          'Register patients and update clinical histories',
          'Conduct daily inpatient clinical rounds & order treatment plans',
          'Conduct doctor round handovers and view nursing shift handovers',
          'Order laboratory investigations and diagnostic tests',
          'Authorize inpatient patient discharges & generate discharge summaries',
          'Issue formal medical fitness, leave, and referral certificates',
          'Schedule bedside medication orders on eMAR',
          'Order oxygen, suction, and drainage protocols for nursing execution',
        ],
        restrictedWork: [
          'CANNOT edit laboratory test results/parameter data (Exclusively edited by Lab Technician)',
          'CANNOT alter hospital-wide security settings, master lockouts, or staff credentials (Admin Doctor exclusive)',
        ],
        exclusiveWork: [
          'Prescribing medications, diagnosing diseases, clinical rounds & formal hospital discharge authorization',
        ],
      };
    case 'receptionist':
      return {
        role: 'receptionist',
        title: 'Front Desk & Receptionist',
        department: 'Front Desk, OPD Queue & Billing',
        allowedWork: [
          'View prescriptions and consultations',
          'Register new patient bio and update demographics',
          'Manage appointment bookings and OPD token queue',
          'Generate billing invoices and collect consultation & IPD payments',
          'View pharmacy inventory and upload referral documents',
        ],
        restrictedWork: [
          'CANNOT create or edit clinical prescriptions',
          'CANNOT conduct clinical rounds, eMAR, or administer medications',
          'CANNOT edit laboratory test results',
          'CANNOT discharge inpatient patients or issue medical certificates',
          'CANNOT modify clinic administrative settings or security PINs',
        ],
        exclusiveWork: [
          'Front-desk patient intake and OPD billing receipt management',
        ],
      };
    case 'admin_doctor':
    default:
      return {
        role: 'admin_doctor',
        title: 'Chief Medical Officer & Administrator',
        department: 'Hospital Administration & Clinical Direction',
        allowedWork: [
          'Full unrestricted authorities across all OPD, IPD, Diagnostics, Pharmacy, Staff, and Security modules',
        ],
        restrictedWork: [],
        exclusiveWork: [
          'Staff user management, credential generation, clinic configuration, backup orchestration, security lockdown control',
        ],
      };
  }
}

/**
 * Returns true if the given role has the specified permission.
 * admin_doctor always returns true.
 */
export function canDo(role: UserRole, permission: Permission): boolean {
  if (role === 'admin_doctor') return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

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

