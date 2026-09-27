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

  CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_name TEXT NOT NULL,
    brand_name TEXT,
    category TEXT NOT NULL DEFAULT 'Tablet',
    batch_no TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity_in_stock INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 20,
    purchase_cost REAL NOT NULL DEFAULT 0,
    mrp REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    rack_location TEXT,
    supplier_name TEXT,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_pharmacy_medicine ON pharmacy_inventory(medicine_name);
  CREATE INDEX IF NOT EXISTS idx_pharmacy_category ON pharmacy_inventory(category);
  CREATE INDEX IF NOT EXISTS idx_pharmacy_expiry ON pharmacy_inventory(expiry_date);

  CREATE TABLE IF NOT EXISTS pharmacy_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES pharmacy_inventory(id),
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    patient_id INTEGER REFERENCES patients(id),
    prescription_id INTEGER REFERENCES prescriptions(id),
    admission_id INTEGER REFERENCES ipd_admissions(id),
    remarks TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_inv ON pharmacy_transactions(inventory_id);

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_no INTEGER NOT NULL,
    appointment_date TEXT NOT NULL,
    time_slot TEXT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    doctor_id INTEGER REFERENCES staff_users(id),
    doctor_name TEXT,
    type TEXT NOT NULL DEFAULT 'OPD_CONSULTATION',
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    chief_complaint TEXT,
    notes TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
  CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

  CREATE TABLE IF NOT EXISTS emar_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admission_id INTEGER NOT NULL REFERENCES ipd_admissions(id),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    route TEXT DEFAULT 'Oral',
    scheduled_time INTEGER NOT NULL,
    administered_at INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING',
    nurse_name TEXT,
    notes TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_emar_admission ON emar_records(admission_id);
  CREATE INDEX IF NOT EXISTS idx_emar_scheduled ON emar_records(scheduled_time);

  CREATE TABLE IF NOT EXISTS clinical_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    admission_id INTEGER REFERENCES ipd_admissions(id),
    consent_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    patient_signature TEXT,
    signed_by_name TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'Self',
    witness_name TEXT,
    doctor_signature TEXT,
    signed_at INTEGER,
    ip_address TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_consents_patient ON clinical_consents(patient_id);
  CREATE INDEX IF NOT EXISTS idx_consents_admission ON clinical_consents(admission_id);

  CREATE TABLE IF NOT EXISTS ipd_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admission_id INTEGER NOT NULL REFERENCES ipd_admissions(id),
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    receipt_no TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    transaction_ref TEXT,
    type TEXT NOT NULL DEFAULT 'ADVANCE',
    notes TEXT,
    collected_by TEXT,
    created_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_deposits_admission ON ipd_deposits(admission_id);
  CREATE INDEX IF NOT EXISTS idx_deposits_patient ON ipd_deposits(patient_id);
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

// Auto-migrate newly added columns on patients and clinic_settings
try {
  const patientColumns = sqlite.prepare("PRAGMA table_info(patients)").all() as { name: string }[];
  const pCols = new Set(patientColumns.map((c) => c.name));
  if (!pCols.has("abha_address")) sqlite.prepare("ALTER TABLE patients ADD COLUMN abha_address TEXT").run();
  if (!pCols.has("allergies")) sqlite.prepare("ALTER TABLE patients ADD COLUMN allergies TEXT").run();
  if (!pCols.has("blood_group")) sqlite.prepare("ALTER TABLE patients ADD COLUMN blood_group TEXT").run();

  const settingsColumns = sqlite.prepare("PRAGMA table_info(clinic_settings)").all() as { name: string }[];
  const sCols = new Set(settingsColumns.map((c) => c.name));
  if (!sCols.has("gdrive_backup_enabled")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_backup_enabled INTEGER DEFAULT 0").run();
  if (!sCols.has("gdrive_folder_id")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_folder_id TEXT").run();
  if (!sCols.has("gdrive_client_email")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_client_email TEXT").run();
  if (!sCols.has("gdrive_private_key")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_private_key TEXT").run();
  if (!sCols.has("gdrive_encryption_key")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_encryption_key TEXT").run();
  if (!sCols.has("gdrive_last_backup_at")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_last_backup_at INTEGER").run();
  if (!sCols.has("gdrive_last_backup_status")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_last_backup_status TEXT").run();
  if (!sCols.has("gdrive_last_backup_file_id")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_last_backup_file_id TEXT").run();
  if (!sCols.has("gdrive_last_backup_file_name")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_last_backup_file_name TEXT").run();
  if (!sCols.has("gdrive_auto_backup_interval")) sqlite.prepare("ALTER TABLE clinic_settings ADD COLUMN gdrive_auto_backup_interval TEXT DEFAULT 'DAILY'").run();
} catch (migrErr) {
  // Ignore migration column addition errors if already present
}

// Auto-seed sample IPD admissions and lab investigations if admissions table is empty
try {
  const ipdCount = sqlite.prepare('SELECT COUNT(*) as count FROM ipd_admissions').get() as { count: number } | undefined;
  if (!ipdCount || ipdCount.count === 0) {
    const existingPatients = sqlite.prepare('SELECT id, name FROM patients ORDER BY id ASC').all() as { id: number; name: string }[];
    if (existingPatients && existingPatients.length > 0) {
      const nowMs = Date.now();
      const hourMs = 3600 * 1000;
      const dayMs = 86400 * 1000;

      const p1 = existingPatients.find(p => p.id === 9) || existingPatients[existingPatients.length - 1];
      const p2 = existingPatients.find(p => p.id === 8) || existingPatients[Math.max(0, existingPatients.length - 2)];
      const p3 = existingPatients.find(p => p.id === 7) || existingPatients[0];

      if (p1) {
        const adm1Time = nowMs - (26 * hourMs);
        const res1 = sqlite.prepare(`
          INSERT INTO ipd_admissions (
            admission_no, patient_id, admission_date, discharge_date, status,
            ward, bed_no, room_type, attending_doctor, admitting_diagnosis,
            chief_complaints, admission_vitals, discharge_condition, discharge_summary,
            discharge_advice, created_at
          ) VALUES (?, ?, ?, NULL, 'ADMITTED', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
        `).run(
          'IPD-20260926-01', p1.id, adm1Time,
          'Semi-Private Ward', 'Bed-02', 'Semi-Private',
          'Dr. Nitin Hiralal Sonare',
          'COPD with Acute Exacerbation & Bronchospasm',
          'Severe shortness of breath, bilateral wheezing, cough with yellow phlegm x 3 days',
          JSON.stringify({ bp: '130/85', pulse: '88', temp: '37.2', spo2: '93', rbs: '142' }),
          adm1Time
        );
        const adm1Id = Number(res1.lastInsertRowid);

        sqlite.prepare(`
          INSERT INTO ipd_rounds (admission_id, round_date, doctor_or_staff, role, notes, treatment_orders, vitals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          adm1Id, adm1Time + (2 * hourMs),
          'Sister Priya Nair', 'NURSE',
          'Patient received in Semi-Private Bed-02. Dyspneic on mild exertion. Supplemental O2 started via nasal cannula at 2 L/min. Nebulization with Duolin 1 respule + Budecort 0.5mg administered. IV access secured on right forearm with 20G cannula. Patient comfortable in propped up position.',
          'O2 inhalation @ 2L/min via nasal prongs, Nebulization Duolin + Budecort TDS, Monitor SpO2 and vitals Q4H.',
          JSON.stringify({ bp: '128/82', pulse: '86', temp: '37.0', spo2: '96', rbs: '138' }),
          adm1Time + (2 * hourMs)
        );

        sqlite.prepare(`
          INSERT INTO ipd_rounds (admission_id, round_date, doctor_or_staff, role, notes, treatment_orders, vitals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          adm1Id, nowMs - (4 * hourMs),
          'Dr. Nitin Hiralal Sonare', 'DOCTOR',
          'Morning clinical round. Patient reports subjective relief in breathing effort. Auscultation: Bilateral rhonchi present but significantly reduced compared to admission; air entry improved across lung bases. Tolerating warm oral fluids and soft diet well.',
          'Inj Deriphyllin 1 amp IV BD, Tab Azithromycin 500mg OD x 3 days, continue Duolin nebulization TDS, Chest physiotherapy twice daily, recheck SpO2 on room air this evening.',
          JSON.stringify({ bp: '130/80', pulse: '80', temp: '36.8', spo2: '97', rbs: '126' }),
          nowMs - (4 * hourMs)
        );

        const cbcResults = [
          { id: '1', parameter: 'Hemoglobin (Hb)', value: '13.8', unit: 'g/dL', referenceRange: '13.0 - 17.0', flag: 'NORMAL' },
          { id: '2', parameter: 'Total Leukocyte Count (TLC)', value: '13,400', unit: '/cumm', referenceRange: '4,000 - 11,000', flag: 'HIGH' },
          { id: '3', parameter: 'Neutrophils', value: '78', unit: '%', referenceRange: '40 - 75', flag: 'HIGH' },
          { id: '4', parameter: 'Lymphocytes', value: '16', unit: '%', referenceRange: '20 - 45', flag: 'LOW' },
          { id: '5', parameter: 'Eosinophils', value: '3', unit: '%', referenceRange: '1 - 6', flag: 'NORMAL' },
          { id: '6', parameter: 'Platelet Count', value: '2.6', unit: 'lakhs/cumm', referenceRange: '1.5 - 4.5', flag: 'NORMAL' },
          { id: '7', parameter: 'ESR', value: '28', unit: 'mm/1st hr', referenceRange: '0 - 15', flag: 'HIGH' },
        ];
        sqlite.prepare(`
          INSERT INTO lab_reports (
            report_no, patient_id, prescription_id, ipd_admission_id, test_name,
            category, sample_type, sample_collected_at, reported_at, status,
            referred_by, technician_name, results, interpretation, notes, created_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
        `).run(
          'LAB-20260926-001', p1.id, adm1Id,
          'Complete Blood Count (CBC)', 'Hematology', 'Blood (EDTA)',
          adm1Time + (3 * hourMs), adm1Time + (5 * hourMs),
          'Dr. Nitin Hiralal Sonare', 'Ramesh Kumar',
          JSON.stringify(cbcResults),
          'Neutrophilic leukocytosis and elevated ESR consistent with acute bacterial exacerbation of chronic obstructive airway disease.',
          'Specimen received in good condition. Processed on automated hematology analyzer.',
          adm1Time + (3 * hourMs)
        );
      }

      if (p2 && p2.id !== p1.id) {
        const adm2Time = nowMs - (14 * hourMs);
        const res2 = sqlite.prepare(`
          INSERT INTO ipd_admissions (
            admission_no, patient_id, admission_date, discharge_date, status,
            ward, bed_no, room_type, attending_doctor, admitting_diagnosis,
            chief_complaints, admission_vitals, discharge_condition, discharge_summary,
            discharge_advice, created_at
          ) VALUES (?, ?, ?, NULL, 'ADMITTED', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
        `).run(
          'IPD-20260927-01', p2.id, adm2Time,
          'General Female Ward', 'Bed-05', 'General',
          'Dr. Rajesh Sharma',
          'Acute Gastroenteritis with Moderate Dehydration',
          'Profuse watery stools x 6, nausea and vomiting x 4, generalized weakness, abdominal cramps',
          JSON.stringify({ bp: '100/70', pulse: '96', temp: '38.0', spo2: '99', rbs: '94' }),
          adm2Time
        );
        const adm2Id = Number(res2.lastInsertRowid);

        sqlite.prepare(`
          INSERT INTO ipd_rounds (admission_id, round_date, doctor_or_staff, role, notes, treatment_orders, vitals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          adm2Id, adm2Time + (1 * hourMs),
          'Dr. Rajesh Sharma', 'DOCTOR',
          'Admission round. Patient has moderate dehydration, dry oral mucosa, diminished skin turgor. Abdomen soft, diffuse mild epigastric tenderness, no guarding/rigidity. Immediate rehydration initiated.',
          'IV Ringer Lactate 500ml stat over 1 hour, then IV DNS 500ml @ 75ml/hr. Inj Ondansetron 4mg IV stat. Inj Pantoprazole 40mg IV OD. Strict intake-output chart.',
          JSON.stringify({ bp: '100/70', pulse: '96', temp: '38.0', spo2: '99', rbs: '94' }),
          adm2Time + (1 * hourMs)
        );

        sqlite.prepare(`
          INSERT INTO ipd_rounds (admission_id, round_date, doctor_or_staff, role, notes, treatment_orders, vitals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          adm2Id, nowMs - (3 * hourMs),
          'Sister Priya Nair', 'NURSE',
          '1st bottle IV RL completed, 2nd bottle DNS ongoing. No vomiting since admission. Patient tolerated small sips of oral ORS. Passed clear urine 380ml. Feeling less tired.',
          'Continue IV infusion. Sips of ORS and coconut water as tolerated. Check pulse and BP Q2H.',
          JSON.stringify({ bp: '110/74', pulse: '82', temp: '37.2', spo2: '99', rbs: '102' }),
          nowMs - (3 * hourMs)
        );

        const lytesResults = [
          { id: '1', parameter: 'Serum Sodium (Na+)', value: '135', unit: 'mEq/L', referenceRange: '135 - 145', flag: 'NORMAL' },
          { id: '2', parameter: 'Serum Potassium (K+)', value: '3.2', unit: 'mEq/L', referenceRange: '3.5 - 5.1', flag: 'LOW' },
          { id: '3', parameter: 'Serum Chloride (Cl-)', value: '99', unit: 'mEq/L', referenceRange: '96 - 106', flag: 'NORMAL' },
        ];
        sqlite.prepare(`
          INSERT INTO lab_reports (
            report_no, patient_id, prescription_id, ipd_admission_id, test_name,
            category, sample_type, sample_collected_at, reported_at, status,
            referred_by, technician_name, results, interpretation, notes, created_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
        `).run(
          'LAB-20260927-002', p2.id, adm2Id,
          'Serum Electrolytes Panel', 'Biochemistry', 'Blood (Serum)',
          adm2Time + (2 * hourMs), adm2Time + (4 * hourMs),
          'Dr. Rajesh Sharma', 'Ramesh Kumar',
          JSON.stringify(lytesResults),
          'Mild hypokalemia (K+ 3.2 mEq/L) likely secondary to diarrheal gastrointestinal fluid loss. Electrolyte repletion recommended.',
          'Specimen hemolyzed: None. Quality control passed.',
          adm2Time + (2 * hourMs)
        );
      }

      if (p3 && p3.id !== p1.id && p3.id !== p2.id) {
        const adm3Time = nowMs - (3 * dayMs);
        const disch3Time = nowMs - (2 * hourMs);
        const res3 = sqlite.prepare(`
          INSERT INTO ipd_admissions (
            admission_no, patient_id, admission_date, discharge_date, status,
            ward, bed_no, room_type, attending_doctor, admitting_diagnosis,
            chief_complaints, admission_vitals, discharge_condition, discharge_summary,
            discharge_advice, created_at
          ) VALUES (?, ?, ?, ?, 'DISCHARGED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'IPD-20260924-01', p3.id, adm3Time, disch3Time,
          'Deluxe Room', 'Deluxe-01', 'Private',
          'Dr. Nitin Hiralal Sonare',
          'Essential Hypertension with Hypertensive Urgency',
          'Severe occipital headache, dizziness, blurring of vision, palpitations. BP recorded 190/110 mmHg in OPD.',
          JSON.stringify({ bp: '190/110', pulse: '102', temp: '36.9', spo2: '98', rbs: '168' }),
          'Recovered',
          '47-year-old female admitted with hypertensive urgency (BP 190/110 mmHg) and severe headache. Systemic examination and fundoscopy showed no acute target organ damage. Initiated on combination antihypertensive therapy with Telmisartan 40mg + Amlodipine 5mg. Blood pressure showed steady gradual control: Day 1: 160/95, Day 2: 138/85, Day 3: 124/80 mmHg. Symptomatically relieved of headache. Discharged in hemodynamically stable condition.',
          '1. Tab Telmisartan 40mg + Amlodipine 5mg (1 tab OD morning after breakfast).\\n2. Strict dietary sodium restriction (< 2g/day). Avoid papad, pickles, processed snacks.\\n3. Daily morning BP record in a logbook.\\n4. Brisk walking 30 minutes daily.\\n5. Follow-up review in OPD after 7 days with BP chart, or immediately SOS if headache/chest pain occurs.',
          adm3Time
        );
        const adm3Id = Number(res3.lastInsertRowid);

        sqlite.prepare(`
          INSERT INTO ipd_rounds (admission_id, round_date, doctor_or_staff, role, notes, treatment_orders, vitals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          adm3Id, adm3Time + (2 * hourMs),
          'Dr. Nitin Hiralal Sonare', 'DOCTOR',
          'Admission round. Patient admitted to Deluxe-01 with acute hypertensive urgency (BP 190/110). Fundoscopy: Grade 1 hypertensive changes, no papilledema or hemorrhages. ECG shows normal sinus rhythm, LVH voltage criteria. Started on combination antihypertensive therapy.',
          'Tab Telmisartan 40mg + Amlodipine 5mg stat. Bed rest. Low salt diet. Monitor BP every 2 hours.',
          JSON.stringify({ bp: '190/110', pulse: '102', temp: '36.9', spo2: '98', rbs: '168' }),
          adm3Time + (2 * hourMs)
        );

        sqlite.prepare(`
          INSERT INTO ipd_rounds (admission_id, round_date, doctor_or_staff, role, notes, treatment_orders, vitals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          adm3Id, disch3Time - (1 * hourMs),
          'Dr. Nitin Hiralal Sonare', 'DOCTOR',
          'Discharge round. Patient completely asymptomatic. BP well controlled at 124/80 mmHg, pulse 74 regular. Discharge summary and take-home prescription explained in detail to patient and family.',
          'Approved for discharge. Prescribed Tab Telmisartan 40mg + Amlodipine 5mg OD morning. Review in OPD in 1 week.',
          JSON.stringify({ bp: '124/80', pulse: '74', temp: '36.7', spo2: '99', rbs: '122' }),
          disch3Time - (1 * hourMs)
        );

        const kftResults = [
          { id: '1', parameter: 'Blood Urea', value: '24.0', unit: 'mg/dL', referenceRange: '15 - 40', flag: 'NORMAL' },
          { id: '2', parameter: 'Serum Creatinine', value: '0.82', unit: 'mg/dL', referenceRange: '0.6 - 1.2', flag: 'NORMAL' },
          { id: '3', parameter: 'Serum Uric Acid', value: '4.8', unit: 'mg/dL', referenceRange: '2.6 - 6.0', flag: 'NORMAL' },
          { id: '4', parameter: 'eGFR', value: '94', unit: 'mL/min/1.73m2', referenceRange: '> 90', flag: 'NORMAL' },
        ];
        sqlite.prepare(`
          INSERT INTO lab_reports (
            report_no, patient_id, prescription_id, ipd_admission_id, test_name,
            category, sample_type, sample_collected_at, reported_at, status,
            referred_by, technician_name, results, interpretation, notes, created_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
        `).run(
          'LAB-20260925-001', p3.id, adm3Id,
          'Kidney Function Test (KFT)', 'Biochemistry', 'Blood (Serum)',
          adm3Time + (4 * hourMs), adm3Time + (7 * hourMs),
          'Dr. Nitin Hiralal Sonare', 'Ramesh Kumar',
          JSON.stringify(kftResults),
          'Renal function indices are within normal physiological range. Normal baseline renal function.',
          'Fasting blood sample processed on automated clinical chemistry analyzer.',
          adm3Time + (4 * hourMs)
        );
      }
    }
  }
} catch (ipdSeedErr) {
  console.error('Failed to auto-seed sample IPD data:', ipdSeedErr);
}

// Auto-seed sample Pharmacy Inventory
try {
  const pharmCount = sqlite.prepare('SELECT COUNT(*) as count FROM pharmacy_inventory').get() as { count: number } | undefined;
  if (!pharmCount || pharmCount.count === 0) {
    const insertPharm = sqlite.prepare(`
      INSERT INTO pharmacy_inventory (
        medicine_name, brand_name, category, batch_no, expiry_date,
        quantity_in_stock, min_threshold, purchase_cost, mrp, selling_price,
        rack_location, supplier_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    const items = [
      { name: 'Paracetamol 650mg', brand: 'Dolo 650', cat: 'Tablet', batch: 'DL-2026-08', exp: '2027-12-31', qty: 240, min: 50, cost: 1.20, mrp: 2.10, sp: 2.00, rack: 'Rack A-1', sup: 'Apex Pharma Distributors' },
      { name: 'Amoxicillin + Potassium Clavulanate 625mg', brand: 'Augmentin 625 Duo', cat: 'Tablet', batch: 'AUG-8821', exp: '2027-08-31', qty: 95, min: 30, cost: 14.50, mrp: 22.00, sp: 20.00, rack: 'Rack A-2', sup: 'Glaxo Health India' },
      { name: 'Pantoprazole 40mg', brand: 'Pan 40', cat: 'Tablet', batch: 'PN-4091', exp: '2028-01-31', qty: 180, min: 40, cost: 6.80, mrp: 11.50, sp: 10.50, rack: 'Rack A-3', sup: 'Alkem Laboratories' },
      { name: 'Telmisartan 40mg + Amlodipine 5mg', brand: 'Telma-AM', cat: 'Tablet', batch: 'TAM-104', exp: '2027-10-31', qty: 120, min: 30, cost: 7.20, mrp: 13.00, sp: 12.00, rack: 'Rack B-1', sup: 'Glenmark Pharmaceuticals' },
      { name: 'Metformin Hydrochloride 500mg SR', brand: 'Glycomet 500 SR', cat: 'Tablet', batch: 'GLY-773', exp: '2028-03-31', qty: 160, min: 40, cost: 2.10, mrp: 3.80, sp: 3.50, rack: 'Rack B-2', sup: 'USV Pharma' },
      { name: 'Inj Ondansetron 4mg/2ml', brand: 'Emeset 2ml Inj', cat: 'Injection', batch: 'EMS-302', exp: '2027-09-30', qty: 45, min: 20, cost: 8.50, mrp: 16.00, sp: 15.00, rack: 'Cold Chain / Rack C-1', sup: 'Cipla Critical Care' },
      { name: 'Inj Pantoprazole 40mg IV', brand: 'Pantocid IV', cat: 'Injection', batch: 'PTV-901', exp: '2027-06-30', qty: 38, min: 15, cost: 28.00, mrp: 52.00, sp: 48.00, rack: 'Rack C-2', sup: 'Sun Pharma' },
      { name: 'Inj Ceftriaxone 1g', brand: 'Monocef 1g', cat: 'Injection', batch: 'MCF-554', exp: '2027-05-31', qty: 50, min: 25, cost: 35.00, mrp: 68.00, sp: 62.00, rack: 'Rack C-3', sup: 'Aristo Pharmaceuticals' },
      { name: 'IV Ringer Lactate 500ml', brand: 'RL Infusion', cat: 'IV Fluid', batch: 'RL-2026-B', exp: '2028-06-30', qty: 62, min: 25, cost: 32.00, mrp: 58.00, sp: 55.00, rack: 'IV Fluid Bay - Shelf 1', sup: 'Otsuka / Baxter India' },
      { name: 'IV Normal Saline 0.9% 500ml', brand: 'NS Infusion', cat: 'IV Fluid', batch: 'NS-881', exp: '2028-05-31', qty: 70, min: 30, cost: 28.00, mrp: 52.00, sp: 50.00, rack: 'IV Fluid Bay - Shelf 2', sup: 'Otsuka / Baxter India' },
      { name: 'IV Dextrose Normal Saline 500ml', brand: 'DNS Infusion', cat: 'IV Fluid', batch: 'DNS-411', exp: '2028-04-30', qty: 48, min: 20, cost: 30.00, mrp: 55.00, sp: 52.00, rack: 'IV Fluid Bay - Shelf 3', sup: 'Otsuka / Baxter India' },
      { name: 'Duolin Respules (Levosalbutamol + Ipratropium)', brand: 'Duolin 2.5ml Respule', cat: 'Inhaler', batch: 'DLN-092', exp: '2027-04-30', qty: 85, min: 30, cost: 11.00, mrp: 21.00, sp: 19.00, rack: 'Rack D-1', sup: 'Cipla Respiratory' },
      { name: 'Budecort 0.5mg Respules (Budesonide)', brand: 'Budecort 2ml', cat: 'Inhaler', batch: 'BDC-619', exp: '2027-07-31', qty: 60, min: 25, cost: 16.50, mrp: 31.00, sp: 28.00, rack: 'Rack D-2', sup: 'Cipla Respiratory' },
      { name: 'Disposable Syringes 5ml with 24G Needle', brand: 'Dispovan 5ml', cat: 'Surgical Consumable', batch: 'DSP-2601', exp: '2029-12-31', qty: 350, min: 100, cost: 3.50, mrp: 7.50, sp: 7.00, rack: 'Consumables Bin 1', sup: 'Hindustan Syringes (HMD)' },
      { name: 'IV Cannula 20G (Pink) with Port', brand: 'Venflon 20G', cat: 'Surgical Consumable', batch: 'VNF-892', exp: '2028-11-30', qty: 110, min: 40, cost: 18.00, mrp: 45.00, sp: 40.00, rack: 'Consumables Bin 2', sup: 'BD India' },
      { name: 'Sterile Gauze Swabs 10cm x 10cm', brand: 'MedGauze Pack', cat: 'Surgical Consumable', batch: 'GZ-110', exp: '2028-09-30', qty: 18, min: 30, cost: 4.00, mrp: 9.00, sp: 8.00, rack: 'Consumables Bin 3', sup: 'Surgical Care Supplies' },
    ];

    for (const item of items) {
      insertPharm.run(
        item.name, item.brand, item.cat, item.batch, item.exp,
        item.qty, item.min, item.cost, item.mrp, item.sp,
        item.rack, item.sup, now, now
      );
    }
  }
} catch (pharmSeedErr) {
  console.error('Failed to auto-seed pharmacy inventory:', pharmSeedErr);
}

// Auto-seed sample Appointments and Token Queue
try {
  const apptCount = sqlite.prepare('SELECT COUNT(*) as count FROM appointments').get() as { count: number } | undefined;
  if (!apptCount || apptCount.count === 0) {
    const patientsList = sqlite.prepare('SELECT id, name FROM patients ORDER BY id ASC').all() as { id: number; name: string }[];
    if (patientsList && patientsList.length >= 2) {
      const todayStr = new Date().toISOString().split('T')[0];
      const insertAppt = sqlite.prepare(`
        INSERT INTO appointments (
          token_no, appointment_date, time_slot, patient_id, doctor_id, doctor_name,
          type, status, chief_complaint, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      insertAppt.run(
        1, todayStr, '09:30 AM', patientsList[0].id, 1, 'Dr. Nitin Hiralal Sonare',
        'OPD_CONSULTATION', 'COMPLETED', 'Routine hypertension review and blood pressure check',
        'BP was well controlled at 126/82. Prescription renewed.', now - 7200000
      );

      insertAppt.run(
        2, todayStr, '10:15 AM', patientsList[1].id, 1, 'Dr. Nitin Hiralal Sonare',
        'OPD_CONSULTATION', 'IN_CONSULTATION', 'Persistent dry cough and mild fever x 3 days',
        'Under physical examination currently in Consulting Room 1.', now - 1800000
      );

      if (patientsList.length >= 3) {
        insertAppt.run(
          3, todayStr, '11:00 AM', patientsList[2].id, 2, 'Dr. Rajesh Sharma',
          'FOLLOW_UP', 'WAITING', 'Follow-up for acute gastroenteritis review',
          'Waiting in reception waiting lounge.', now - 900000
        );
      }
    }
  }
} catch (apptSeedErr) {
  console.error('Failed to auto-seed appointments:', apptSeedErr);
}

// Auto-seed sample Inpatient Nurse eMAR records
try {
  const emarCount = sqlite.prepare('SELECT COUNT(*) as count FROM emar_records').get() as { count: number } | undefined;
  if (!emarCount || emarCount.count === 0) {
    const adm = sqlite.prepare("SELECT id FROM ipd_admissions WHERE status = 'ADMITTED' ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
    if (adm) {
      const now = Date.now();
      const hourMs = 3600 * 1000;
      const insertEmar = sqlite.prepare(`
        INSERT INTO emar_records (
          admission_id, medication_name, dosage, route, scheduled_time,
          administered_at, status, nurse_name, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertEmar.run(
        adm.id, 'IV Ringer Lactate 500ml', '500ml IV @ 75ml/hr', 'IV Infusion',
        now - (6 * hourMs), now - (6 * hourMs) + 300000, 'GIVEN',
        'Sister Priya Nair', 'Infusion completed uneventfully. Cannula site healthy.', now - (7 * hourMs)
      );

      insertEmar.run(
        adm.id, 'Inj Pantoprazole 40mg IV', '40mg IV stat OD', 'IV Bolus',
        now - (5 * hourMs), now - (5 * hourMs) + 120000, 'GIVEN',
        'Sister Priya Nair', 'Slow IV push over 3 minutes. Tolerated well.', now - (7 * hourMs)
      );

      insertEmar.run(
        adm.id, 'Duolin 2.5ml + Budecort 0.5mg Nebulization', '1 respule each in nebulizer', 'Nebulization',
        now - (2 * hourMs), now - (2 * hourMs) + 60000, 'GIVEN',
        'Sister Priya Nair', 'Nebulized with O2 at 6 L/min. Rhonchi significantly reduced.', now - (7 * hourMs)
      );

      insertEmar.run(
        adm.id, 'Duolin 2.5ml + Budecort 0.5mg Nebulization', '1 respule each in nebulizer', 'Nebulization',
        now + (2 * hourMs), null, 'PENDING',
        null, 'Scheduled for afternoon 02:00 PM shift', now - (7 * hourMs)
      );

      insertEmar.run(
        adm.id, 'IV DNS 500ml with 1 amp KCl', '500ml IV @ 60ml/hr', 'IV Infusion',
        now + (4 * hourMs), null, 'PENDING',
        null, 'Scheduled for evening 04:00 PM shift', now - (7 * hourMs)
      );
    }
  }
} catch (emarSeedErr) {
  console.error('Failed to auto-seed eMAR records:', emarSeedErr);
}

// Auto-seed sample Clinical Consent and IPD Advance Deposit
try {
  const consentCount = sqlite.prepare('SELECT COUNT(*) as count FROM clinical_consents').get() as { count: number } | undefined;
  if (!consentCount || consentCount.count === 0) {
    const adm = sqlite.prepare("SELECT id, patient_id FROM ipd_admissions WHERE status = 'ADMITTED' ORDER BY id ASC LIMIT 1").get() as { id: number; patient_id: number } | undefined;
    if (adm) {
      const now = Date.now();
      sqlite.prepare(`
        INSERT INTO clinical_consents (
          patient_id, admission_id, consent_type, title, content,
          signed_by_name, relationship, witness_name, doctor_signature, signed_at, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        adm.patient_id, adm.id, 'GENERAL_ADMISSION',
        'General Inpatient Admission & Medical Treatment Consent',
        'I hereby authorize the medical officers, attending physicians, and nursing staff of MedScript Hospital to administer such diagnostic procedures, clinical examinations, intravenous therapies, and routine inpatient care as deemed necessary for medical management.',
        'Suresh Sonare', 'Son', 'Sister Priya Nair (Staff Nurse)', 'VERIFIED_DIGITAL_DOCTOR_SEAL',
        now - 86400000, '127.0.0.1', now - 86400000
      );

      sqlite.prepare(`
        INSERT INTO ipd_deposits (
          admission_id, patient_id, receipt_no, amount, payment_method,
          transaction_ref, type, notes, collected_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        adm.id, adm.patient_id, 'DEP-20260926-001', 10000.00, 'UPI',
        'UPI-REF-99482184', 'ADVANCE',
        'Initial admission deposit collected at bed booking in Semi-Private Ward',
        'Sunita Verma (Reception)', now - 86400000
      );
    }
  }
} catch (consentDepErr) {
  console.error('Failed to auto-seed consent & deposit:', consentDepErr);
}

// Update sample patients with realistic allergies, blood group, and ABHA address
try {
  sqlite.prepare("UPDATE patients SET allergies = 'Sulfa drugs, Dust mite', blood_group = 'B+', abha_address = 'lalman@abdm' WHERE id = 9 AND (allergies IS NULL OR allergies = '')").run();
  sqlite.prepare("UPDATE patients SET allergies = 'Penicillins, Cephalosporins', blood_group = 'A+', abha_address = 'ramesh.sharma@abdm' WHERE id = 8 AND (allergies IS NULL OR allergies = '')").run();
  sqlite.prepare("UPDATE patients SET allergies = 'NSAIDs (Diclofenac/Ibuprofen)', blood_group = 'O+', abha_address = 'sunita.v@abdm' WHERE id = 7 AND (allergies IS NULL OR allergies = '')").run();
} catch {}

export const db = drizzle(sqlite, { schema });
