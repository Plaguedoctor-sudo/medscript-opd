/**
 * Autonomous Threat Sentinel & Active Deception Engine (Honeypot)
 * Generates realistic, dynamically randomized synthetic decoy medical records
 * to neutralize data exfiltration and feed false random data to adversaries.
 */

import Database from 'better-sqlite3';
import { PatientExportItem, ConsultationExportItem } from './csv-export';

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Myra', 'Ira', 'Avani', 'Riya', 'Navya',
  'Rohan', 'Karan', 'Vikram', 'Rajesh', 'Suresh', 'Manish', 'Pooja', 'Sunita', 'Rekha', 'Kavita'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Deshmukh', 'Kulkarni', 'Joshi', 'Sonare', 'Singh', 'Yadav',
  'Mehta', 'Shah', 'Iyer', 'Nair', 'Reddy', 'Rao', 'Choudhury', 'Banerjee', 'Mishra', 'Tiwari'
];

const CANARY_DIAGNOSES = [
  'Acute Viral Rhinopharyngitis (Canary-Strain-B)',
  'Type 2 Diabetes Mellitus - Compensated (Decoy Record)',
  'Essential Primary Hypertension (Synthetic Canary #804)',
  'Benign Acute Cephalea - Tension Variant (Bogus Node)',
  'Gastroesophageal Reflux Disease (Canary Trap Alpha)',
  'Chronic Bronchial Hyperresponsiveness (Decoy EMR)',
  'Lumbar Musculoskeletal Strain (Synthetic Seed)',
  'Acute Allergic Dermatitis (Honeypot Marker #102)',
];

const CANARY_DRUGS = [
  'TAB. CANARICILLIN 500MG (SYNTHETIC)',
  'TAB. DECOYPROTIN 20MG (HONEYPOT)',
  'TAB. PSEUDODEX 650MG (BOGUS COMPOUND)',
  'CAP. BOGUSOMEPRAZOLE 40MG (DECOY)',
  'TAB. PHANTOMOLOL 50MG (CANARY SEED)',
  'TAB. NULLIFIEX 10MG (DECOY MOLECULE)',
  'SYR. FICTIONINE 100ML (HONEYPOT)',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate randomized synthetic decoy patient records.
 * Contains embedded canary markers for intelligence tracking.
 */
export function generateDecoyPatients(count = 25): PatientExportItem[] {
  const result: PatientExportItem[] = [];

  for (let i = 0; i < count; i++) {
    const fName = getRandomItem(FIRST_NAMES);
    const lName = getRandomItem(LAST_NAMES);
    const age = getRandomInt(18, 78);
    const gender = Math.random() > 0.5 ? 'Male' : 'Female';
    const canaryId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const phone = `+91 99${getRandomInt(10, 99)} ${getRandomInt(10000, 99999)}`;
    const abhaId = `${getRandomInt(10, 99)}-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}`;
    const regNo = `DCOY-${new Date().getFullYear()}-${canaryId}`;

    result.push({
      id: 90000 + i,
      regNo,
      name: `${fName} ${lName} [DECOY-${canaryId}]`,
      age,
      gender,
      phone,
      abhaId,
      createdAt: new Date(Date.now() - getRandomInt(1, 90) * 86400000).toISOString(),
    });
  }

  return result;
}

/**
 * Generate randomized synthetic decoy clinical consultation records.
 */
export function generateDecoyConsultations(count = 25): ConsultationExportItem[] {
  const result: ConsultationExportItem[] = [];

  for (let i = 0; i < count; i++) {
    const fName = getRandomItem(FIRST_NAMES);
    const lName = getRandomItem(LAST_NAMES);
    const age = getRandomInt(18, 78);
    const gender = Math.random() > 0.5 ? 'Male' : 'Female';
    const canaryId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const diagnosis = getRandomItem(CANARY_DIAGNOSES);
    const drug1 = getRandomItem(CANARY_DRUGS);
    const drug2 = getRandomItem(CANARY_DRUGS);
    const systolic = getRandomInt(110, 150);
    const diastolic = getRandomInt(70, 95);

    result.push({
      id: 90000 + i,
      patientId: 90000 + i,
      createdAt: new Date(Date.now() - getRandomInt(1, 30) * 86400000).toISOString().split('T')[0],
      regNo: `DCOY-${new Date().getFullYear()}-${canaryId}`,
      patientName: `${fName} ${lName}`,
      age,
      gender,
      phone: `+91 98${getRandomInt(10, 99)} ${getRandomInt(10000, 99999)}`,
      weight: `${getRandomInt(50, 85)} kg`,
      bp: `${systolic}/${diastolic} mmHg`,
      pulse: `${getRandomInt(64, 88)} bpm`,
      temp: `${(98.2 + Math.random()).toFixed(1)} F`,
      spo2: `${getRandomInt(96, 99)}%`,
      chiefComplaints: 'Generalized fatigue, episodic discomfort, mild seasonal irritation',
      clinicalHistory: 'No known systemic drug allergies reported. Baseline vital signs evaluated.',
      diagnosis,
      medications: `${drug1} (1-0-1, 5 days) | ${drug2} (0-0-1, 3 days)`,
      advice: 'Hydrate adequately. Low sodium diet. Return for follow up review in 7 days.',
      labTests: 'CBC, Serum Creatinine, Fasting Blood Sugar',
      followUpDate: 'In 7 days',
    });
  }

  return result;
}

/**
 * Generate a standalone, fully valid in-memory SQLite database populated
 * exclusively with believable synthetic honeypot decoy data and canary tokens.
 * This is served if an adversary attempts to exfiltrate raw database backups
 * during active breach containment.
 */
export function generateDecoyDatabaseBuffer(): Buffer {
  // Create an in-memory SQLite database
  const memDb = new Database(':memory:');

  // Build realistic tables matching MedScript OPD schema
  memDb.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY,
      reg_no TEXT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT,
      abha_id TEXT,
      created_at INTEGER
    );

    CREATE TABLE clinic_settings (
      id INTEGER PRIMARY KEY,
      doctor_name TEXT,
      qualifications TEXT,
      reg_number TEXT,
      clinic_name TEXT,
      address TEXT,
      contact TEXT
    );

    CREATE TABLE prescriptions (
      id INTEGER PRIMARY KEY,
      patient_id INTEGER,
      weight TEXT,
      bp TEXT,
      pulse TEXT,
      temp TEXT,
      spo2 TEXT,
      chief_complaints TEXT,
      clinical_history TEXT,
      diagnosis TEXT,
      medications TEXT,
      advice TEXT,
      lab_tests TEXT,
      follow_up_date TEXT,
      signature_hash TEXT,
      created_at INTEGER
    );

    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY,
      invoice_no TEXT,
      patient_id INTEGER,
      items TEXT,
      total_amount REAL,
      payment_method TEXT,
      payment_status TEXT,
      created_at INTEGER
    );
  `);

  // Insert bogus clinic details
  memDb.exec(`
    INSERT INTO clinic_settings (id, doctor_name, qualifications, reg_number, clinic_name, address, contact)
    VALUES (1, 'Dr. Decoy Sentinel', 'MBBS, MD (Canary Trap)', 'CANARY-99999', 'Sentinel Decoy Medical Centre', 'Sector 99, Honeypot Enclave', '+91 99999 00000');
  `);

  // Insert 40 realistic decoy patients & prescriptions
  const insertPat = memDb.prepare(`
    INSERT INTO patients (id, reg_no, name, age, gender, phone, abha_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRx = memDb.prepare(`
    INSERT INTO prescriptions (id, patient_id, weight, bp, pulse, temp, spo2, chief_complaints, clinical_history, diagnosis, medications, advice, lab_tests, follow_up_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInv = memDb.prepare(`
    INSERT INTO invoices (id, invoice_no, patient_id, items, total_amount, payment_method, payment_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  for (let i = 1; i <= 35; i++) {
    const fName = getRandomItem(FIRST_NAMES);
    const lName = getRandomItem(LAST_NAMES);
    const age = getRandomInt(20, 75);
    const gender = i % 2 === 0 ? 'Female' : 'Male';
    const regNo = `CANARY-${new Date().getFullYear()}-${1000 + i}`;
    const phone = `+91 99${getRandomInt(10, 99)} ${getRandomInt(10000, 99999)}`;
    const abhaId = `${getRandomInt(10, 99)}-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}`;
    const patTime = now - getRandomInt(1, 60) * 86400000;

    insertPat.run(i, regNo, `${fName} ${lName}`, age, gender, phone, abhaId, patTime);

    const diag = getRandomItem(CANARY_DIAGNOSES);
    const med1 = getRandomItem(CANARY_DRUGS);
    const med2 = getRandomItem(CANARY_DRUGS);
    const rxMeds = JSON.stringify([
      { name: med1, strength: '500mg', dosage: '1-0-1', timing: 'After food', duration: '5 days' },
      { name: med2, strength: '20mg', dosage: '0-0-1', timing: 'Bedtime', duration: '7 days' },
    ]);

    insertRx.run(
      i,
      i,
      `${getRandomInt(52, 82)} kg`,
      `${getRandomInt(115, 140)}/${getRandomInt(75, 90)} mmHg`,
      `${getRandomInt(68, 84)} bpm`,
      '98.4 F',
      '98%',
      'Symptomatic distress, intermittent discomfort',
      'Nil contributory. Evaluated under standard triage protocols.',
      diag,
      rxMeds,
      'Maintain hydration, low salt intake, avoid exertion.',
      'Routine CBC, LFT, Lipid Profile',
      '5 days',
      patTime + 3600000
    );

    insertInv.run(
      i,
      `INV-DCOY-${20260000 + i}`,
      i,
      JSON.stringify([{ description: 'Consultation & Triage Fee', quantity: 1, unitPrice: 350, total: 350 }]),
      350,
      'Cash',
      'PAID',
      patTime + 4000000
    );
  }

  // Serialize to Buffer
  const buffer = memDb.serialize();
  memDb.close();
  return buffer;
}
