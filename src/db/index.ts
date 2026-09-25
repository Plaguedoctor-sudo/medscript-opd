import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

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
`);

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
