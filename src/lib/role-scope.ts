/**
 * MedScript OPD - Role Scope & Responsibilities (Client-Safe)
 */
import { UserRole } from '@/types';

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
 */
export const ROLE_PERMISSIONS: Record<Exclude<UserRole, 'admin_doctor'>, Permission[]> = {
  doctor: [
    'prescription:create', 'prescription:edit', 'prescription:view',
    'patient:register', 'patient:edit_demographics', 'patient:view',
    'appointment:manage', 'appointment:view',
    'ipd:view', 'ipd:admit_discharge', 'ipd:clinical_rounds', 'ipd:nursing_notes', 'ipd:emar', 'ipd:fluid_io', 'ipd:services', 'ipd:handovers',
    'lab:view',
    'billing:view', 'billing:manage',
    'inventory:view', 'inventory:manage',
    'reports:view', 'reports:idsp',
    'settings:view_own_pin', 'settings:clinic',
    'certificate:issue', 'document:upload', 'template:manage',
  ],
  nurse: [
    'prescription:view',
    'patient:register', 'patient:edit_demographics', 'patient:view',
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
    'prescription:view',
    'patient:view',
    'lab:view', 'lab:manage',
    'settings:view_own_pin',
  ],
};

/**
 * Returns true if the given role has the specified permission.
 * admin_doctor always returns true.
 */
export function canDo(role: UserRole, permission: Permission): boolean {
  if (role === 'admin_doctor') return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

