/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.resolve(__dirname, "../sqlite.db");
const db = new Database(dbPath);

console.log("Seeding MedScript OPD database at:", dbPath);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    logo_url TEXT
  );
`);

// Seed Clinic Settings
const existingSettings = db.prepare("SELECT * FROM clinic_settings WHERE id = 1").get();
if (!existingSettings) {
  db.prepare(`
    INSERT INTO clinic_settings (id, doctor_name, qualifications, reg_number, clinic_name, address, contact)
    VALUES (1, 'Dr. Rajesh Sharma', 'MBBS, MD (General Medicine)', 'MCI-48920', 'Lifeline Family Clinic & OPD', 'Suite 104, Medicare Square, New Delhi - 110001', '+91 98101 23456')
  `).run();
  console.log("✓ Seeded Clinic Settings");
} else {
  console.log("• Clinic Settings already exist");
}

// Seed Patients and Prescriptions if empty
const patientCount = db.prepare("SELECT count(*) as count FROM patients").get().count;
if (patientCount === 0) {
  const insertPatient = db.prepare(`
    INSERT INTO patients (name, age, gender, phone, abha_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const p1 = insertPatient.run("Amit Verma", 42, "Male", "+91 98765 43210", "14-2345-6789-0123", now - 86400000 * 2);
  const p2 = insertPatient.run("Priya Patel", 29, "Female", "+91 98234 56789", "14-9876-5432-1098", now - 86400000 * 1);

  const insertRx = db.prepare(`
    INSERT INTO prescriptions (
      patient_id, weight, bp, pulse, temp, spo2,
      chief_complaints, clinical_history, diagnosis, medications, advice, lab_tests, follow_up_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rx1Meds = JSON.stringify([
    { name: "Telmisartan", strength: "40mg", dosage: "1-0-0", timing: "After food", duration: "30 days", instruction: "Take every morning at a fixed time" },
    { name: "Paracetamol", strength: "650mg", dosage: "SOS", timing: "After food", duration: "3 days", instruction: "Take only if fever > 100°F or severe body ache" },
    { name: "Levocetirizine", strength: "5mg", dosage: "0-0-1", timing: "At bedtime", duration: "5 days", instruction: "At night before sleeping" },
  ]);

  const followUp1 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  insertRx.run(
    p1.lastInsertRowid,
    "74",
    "130/84",
    "78",
    "98.6",
    "98",
    "Mild headache, occasional fatigue and dry cough for 3 days",
    "No prior chronic illnesses, no known drug allergies",
    "Essential Stage 1 Hypertension & Mild Viral URTI",
    rx1Meds,
    "Low sodium diet (< 2g/day), maintain 30 mins daily brisk walking, maintain BP log",
    "Serum Creatinine, Fasting Lipid Profile, Complete Blood Count",
    followUp1,
    now - 86400000 * 2
  );

  const rx2Meds = JSON.stringify([
    { name: "Pantoprazole + Domperidone", strength: "40mg/30mg", dosage: "1-0-0", timing: "Before food", duration: "14 days", instruction: "Take 30 mins before breakfast on empty stomach" },
    { name: "Sucralfate Syrup", strength: "10ml", dosage: "1-1-1", timing: "Empty stomach", duration: "7 days", instruction: "Shake well before use, avoid food for 30 mins after syrup" },
  ]);

  const followUp2 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  insertRx.run(
    p2.lastInsertRowid,
    "58",
    "118/76",
    "72",
    "98.4",
    "99",
    "Epigastric burning sensation, post-prandial fullness for 1 week",
    "Frequent skipping of meals, high tea/coffee consumption",
    "Non-Ulcer Dyspepsia (GERD / Acid Peptic Disease)",
    rx2Meds,
    "Small frequent meals, avoid spicy/fried foods and caffeine, elevate head while sleeping",
    "Ultrasound Abdomen if symptoms persist",
    followUp2,
    now - 86400000 * 1
  );

  console.log("✓ Seeded sample patients (Amit Verma, Priya Patel) and their prescriptions");
} else {
  console.log("• Patients already exist, skipping patient seeding");
}

console.log("✓ Database seeding complete!");
