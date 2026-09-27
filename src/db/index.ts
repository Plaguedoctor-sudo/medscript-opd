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

export const db = drizzle(sqlite, { schema });
