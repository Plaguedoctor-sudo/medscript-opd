import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'sqlite.db');
export const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Ensure tables exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reg_no TEXT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT,
    abha_id TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    weight TEXT,
    bp TEXT,
    pulse TEXT,
    temp TEXT,
    spo2 TEXT,
    chief_complaints TEXT,
    clinical_history TEXT,
    diagnosis TEXT,
    medications TEXT NOT NULL,
    advice TEXT,
    lab_tests TEXT,
    follow_up_date TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS clinic_settings (
    id INTEGER PRIMARY KEY,
    doctor_name TEXT NOT NULL,
    qualifications TEXT NOT NULL,
    reg_number TEXT NOT NULL,
    clinic_name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact TEXT NOT NULL,
    logo_url TEXT,
    pin_hash TEXT,
    security_enabled INTEGER DEFAULT 0,
    auto_lock_minutes INTEGER DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    status TEXT DEFAULT 'SUCCESS'
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

  CREATE TABLE IF NOT EXISTS security_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address TEXT,
    metadata TEXT,
    created_at INTEGER,
    acknowledged_at INTEGER,
    acknowledged_by TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_security_alerts_acknowledged ON security_alerts(acknowledged_at);
  CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at);
  CREATE INDEX IF NOT EXISTS idx_security_alerts_category ON security_alerts(category);

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    prescription_id INTEGER,
    items TEXT NOT NULL,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    payment_status TEXT DEFAULT 'PAID',
    notes TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no);

  CREATE TABLE IF NOT EXISTS ipd_admissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admission_no TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    admission_date INTEGER NOT NULL,
    discharge_date INTEGER,
    status TEXT NOT NULL DEFAULT 'ADMITTED',
    ward TEXT NOT NULL,
    bed_no TEXT NOT NULL,
    room_type TEXT DEFAULT 'General',
    attending_doctor TEXT,
    admitting_diagnosis TEXT,
    chief_complaints TEXT,
    admission_vitals TEXT,
    discharge_condition TEXT,
    discharge_summary TEXT,
    discharge_advice TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_ipd_admissions_patient ON ipd_admissions(patient_id);
  CREATE INDEX IF NOT EXISTS idx_ipd_admissions_status ON ipd_admissions(status);
  CREATE INDEX IF NOT EXISTS idx_ipd_admissions_no ON ipd_admissions(admission_no);

  CREATE TABLE IF NOT EXISTS ipd_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admission_id INTEGER NOT NULL REFERENCES ipd_admissions(id),
    round_date INTEGER NOT NULL,
    doctor_or_staff TEXT NOT NULL,
    role TEXT DEFAULT 'DOCTOR',
    notes TEXT NOT NULL,
    treatment_orders TEXT,
    vitals TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_ipd_rounds_admission ON ipd_rounds(admission_id);
  CREATE INDEX IF NOT EXISTS idx_ipd_rounds_date ON ipd_rounds(round_date);

  CREATE TABLE IF NOT EXISTS lab_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_no TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    prescription_id INTEGER REFERENCES prescriptions(id),
    ipd_admission_id INTEGER REFERENCES ipd_admissions(id),
    test_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    sample_type TEXT,
    sample_collected_at INTEGER,
    reported_at INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING',
    referred_by TEXT,
    technician_name TEXT,
    results TEXT NOT NULL DEFAULT '[]',
    interpretation TEXT,
    notes TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_lab_reports_patient ON lab_reports(patient_id);
  CREATE INDEX IF NOT EXISTS idx_lab_reports_status ON lab_reports(status);
  CREATE INDEX IF NOT EXISTS idx_lab_reports_no ON lab_reports(report_no);
  CREATE INDEX IF NOT EXISTS idx_lab_reports_rx ON lab_reports(prescription_id);
  CREATE INDEX IF NOT EXISTS idx_lab_reports_ipd ON lab_reports(ipd_admission_id);

  CREATE TABLE IF NOT EXISTS staff_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'DOCTOR',
    sub_role TEXT,
    department TEXT,
    phone TEXT,
    email TEXT,
    qualifications TEXT,
    reg_number TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at INTEGER,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_staff_users_login ON staff_users(login_id);
  CREATE INDEX IF NOT EXISTS idx_staff_users_role ON staff_users(role);
`);

// Auto-seed default staff profiles across all major roles and subcategories
try {
  const staffCount = sqlite.prepare('SELECT COUNT(*) as count FROM staff_users').get() as { count: number } | undefined;
  if (!staffCount || staffCount.count === 0) {
    const hashDefaultPassword = (pwd: string): string => {
      const salt = crypto.randomBytes(16).toString('hex');
      const derived = crypto.scryptSync(pwd, salt, 32, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 32 * 1024 * 1024,
      });
      return `scrypt:v1:${salt}:${derived.toString('hex')}`;
    };

    const insertStaff = sqlite.prepare(`
      INSERT INTO staff_users (login_id, password_hash, name, role, sub_role, department, phone, email, qualifications, reg_number, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const now = Date.now();

    // 1. Admin Doctor (Main one with full authorities)
    insertStaff.run(
      'admin',
      hashDefaultPassword('admin123'),
      'Dr. Admin (CMO)',
      'admin_doctor',
      'Chief Medical Officer & Hospital Admin',
      'Administration & OPD',
      '+91 98765 43210',
      'admin@medscript.clinic',
      'MBBS, MD (General Medicine)',
      'MCI-ADMIN-001',
      now
    );

    // 2. Doctor (Clinical Consulting Physician)
    insertStaff.run(
      'doctor',
      hashDefaultPassword('doctor123'),
      'Dr. Rajesh Sharma',
      'doctor',
      'Consulting Physician',
      'General Medicine & OPD',
      '+91 98765 43211',
      'sharma.r@medscript.clinic',
      'MBBS, DNB (Family Medicine)',
      'MCI-DOC-1048',
      now
    );

    // 3. Nurse (Inpatient Staff Nurse)
    insertStaff.run(
      'nurse',
      hashDefaultPassword('nurse123'),
      'Sister Priya Nair',
      'nurse',
      'Head Inpatient Staff Nurse',
      'IPD & Critical Care Ward',
      '+91 98765 43212',
      'priya.nair@medscript.clinic',
      'B.Sc Nursing, RN',
      'INC-NUR-8421',
      now
    );

    // 4. Receptionist (Front Desk & Patient Intake)
    insertStaff.run(
      'receptionist',
      hashDefaultPassword('reception123'),
      'Sunita Verma',
      'receptionist',
      'Front Desk & Patient Intake Officer',
      'Patient Registration & Billing',
      '+91 98765 43213',
      'reception@medscript.clinic',
      'B.A., Medical Reception & Triage',
      'FD-REC-301',
      now
    );

    // 5. Lab Technician (Pathology & Lab Diagnostics)
    insertStaff.run(
      'labtech',
      hashDefaultPassword('lab123'),
      'Ramesh Kumar',
      'lab_technician',
      'Senior Medical Laboratory Technologist',
      'Clinical Pathology & Biochemistry',
      '+91 98765 43214',
      'lab@medscript.clinic',
      'B.Sc MLT, DMLT',
      'MLT-LAB-559',
      now
    );
  }
} catch (seedErr) {
  console.error('Failed to seed default staff users:', seedErr);
}

// Auto-migrate newly added columns if existing DB
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN pin_hash TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN security_enabled INTEGER DEFAULT 0;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN auto_lock_minutes INTEGER DEFAULT 15;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN staff_pin_hash TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN rbac_enabled INTEGER DEFAULT 0;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE prescriptions ADD COLUMN signature_hash TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec("ALTER TABLE audit_logs ADD COLUMN actor_role TEXT DEFAULT 'DOCTOR';");
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE patients ADD COLUMN reg_no TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN mfa_enabled INTEGER DEFAULT 0;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN mfa_secret TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN mfa_backup_codes TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN pin_updated_at INTEGER;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN rotation_days INTEGER DEFAULT 90;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN min_pin_length INTEGER DEFAULT 4;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN enforce_complexity INTEGER DEFAULT 0;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN session_secret TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN lockdown_active INTEGER DEFAULT 0;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN lockdown_reason TEXT;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN lockdown_triggered_at INTEGER;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN deception_mode_active INTEGER DEFAULT 0;');
} catch {
  // Column already exists
}
try {
  sqlite.exec('ALTER TABLE clinic_settings ADD COLUMN session_revoked_before INTEGER;');
} catch {
  // Column already exists
}

// Enforce POSIX 0600 file permissions on database at rest
try {
  if (fs.existsSync(/*turbopackIgnore: true*/ dbPath)) fs.chmodSync(dbPath, 0o600);
  if (fs.existsSync(/*turbopackIgnore: true*/ `${dbPath}-wal`)) fs.chmodSync(`${dbPath}-wal`, 0o600);
  if (fs.existsSync(/*turbopackIgnore: true*/ `${dbPath}-shm`)) fs.chmodSync(`${dbPath}-shm`, 0o600);
} catch {
  // Ignore on non-POSIX filesystems
}

// Auto-backfill reg_no for any existing patients without one (YYYYMMDD-1, YYYYMMDD-2...)
try {
  const unassigned = sqlite
    .prepare("SELECT id, created_at FROM patients WHERE reg_no IS NULL OR reg_no = '' ORDER BY id ASC")
    .all() as { id: number; created_at?: number | string | null }[];

  if (Array.isArray(unassigned) && unassigned.length > 0) {
    const dailyCounters: Record<string, number> = {};
    for (const p of unassigned) {
      const d = p.created_at ? new Date(p.created_at) : new Date();
      const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      if (dailyCounters[yyyymmdd] === undefined) {
        const existing = sqlite
          .prepare("SELECT reg_no FROM patients WHERE reg_no LIKE ?")
          .all(`${yyyymmdd}%`) as { reg_no?: string | null }[];
        let max = 0;
        if (Array.isArray(existing)) {
          for (const row of existing) {
            const m = row.reg_no?.match(/^(\d{8})[-]?(\d+)$/);
            if (m && m[1] === yyyymmdd) {
              const seq = parseInt(m[2], 10);
              if (!isNaN(seq) && seq > max) max = seq;
            }
          }
        }
        dailyCounters[yyyymmdd] = max;
      }
      dailyCounters[yyyymmdd] += 1;
      const assignedRegNo = `${yyyymmdd}-${dailyCounters[yyyymmdd]}`;
      sqlite.prepare("UPDATE patients SET reg_no = ? WHERE id = ?").run(assignedRegNo, p.id);
    }
  }
} catch {
  // Ignore migration errors
}

export const db = drizzle(sqlite, { schema });
