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

  const DAY = 86400000;
  const now = Date.now();
  const p1 = insertPatient.run("Amit Verma", 42, "Male", "+91 98765 43210", "14-2345-6789-0123", now - 28 * DAY);
  const p2 = insertPatient.run("Priya Patel", 29, "Female", "+91 98234 56789", "14-9876-5432-1098", now - 10 * DAY);

  const insertRx = db.prepare(`
    INSERT INTO prescriptions (
      patient_id, weight, bp, pulse, temp, spo2,
      chief_complaints, clinical_history, diagnosis, medications, advice, lab_tests, follow_up_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Amit Verma - Visit 1 (28 days ago)
  const rx1Meds = JSON.stringify([
    { name: "Telmisartan", strength: "40mg", dosage: "1-0-0", timing: "After food", duration: "14 days", instruction: "Take every morning at a fixed time" },
    { name: "Paracetamol", strength: "650mg", dosage: "SOS", timing: "After food", duration: "3 days", instruction: "Take only if fever > 100°F or severe body ache" },
    { name: "Levocetirizine", strength: "5mg", dosage: "0-0-1", timing: "At bedtime", duration: "5 days", instruction: "At night before sleeping" },
  ]);
  insertRx.run(
    p1.lastInsertRowid,
    "75.5",
    "142/90",
    "84",
    "99.2",
    "97",
    "Headache, persistent fatigue, and elevated BP readings at home",
    "Sedentary lifestyle, high sodium diet, no prior BP medication",
    "Essential Stage 2 Hypertension & Mild Viral Pharyngitis",
    rx1Meds,
    "Strict low sodium diet (< 2g/day), avoid fried snacks, 30 min daily brisk walk",
    "Serum Creatinine, Fasting Blood Sugar, Lipid Profile, ECG",
    new Date(now - 14 * DAY).toISOString().split("T")[0],
    now - 28 * DAY
  );

  // Amit Verma - Visit 2 (14 days ago)
  const rx2Meds = JSON.stringify([
    { name: "Telmisartan", strength: "40mg", dosage: "1-0-0", timing: "After food", duration: "30 days", instruction: "Continue morning dose" },
    { name: "Amlodipine", strength: "2.5mg", dosage: "0-0-1", timing: "At bedtime", duration: "30 days", instruction: "Added for tighter evening control" },
  ]);
  insertRx.run(
    p1.lastInsertRowid,
    "74.6",
    "132/84",
    "78",
    "98.6",
    "98",
    "Follow-up for BP review. Headache improved, mild pedal puffiness in evenings",
    "Responding favorably to Telmisartan",
    "Essential Hypertension - Stage 1 (Improving)",
    rx2Meds,
    "Maintain daily salt restriction, continue morning walking routine",
    "Repeat serum electrolytes in 4 weeks",
    new Date(now + 14 * DAY).toISOString().split("T")[0],
    now - 14 * DAY
  );

  // Amit Verma - Visit 3 (2 days ago)
  const rx3Meds = JSON.stringify([
    { name: "Telmisartan", strength: "40mg", dosage: "1-0-0", timing: "After food", duration: "60 days", instruction: "Maintain regularly" },
    { name: "Amlodipine", strength: "2.5mg", dosage: "0-0-1", timing: "At bedtime", duration: "60 days", instruction: "Evening bedtime dose" },
  ]);
  insertRx.run(
    p1.lastInsertRowid,
    "73.8",
    "122/80",
    "72",
    "98.4",
    "99",
    "Routine follow-up. Feeling energetic, no headaches, no visual disturbances",
    "Well-controlled hypertension on combination therapy",
    "Essential Hypertension - Target Controlled (Normal Range)",
    rx3Meds,
    "Excellent response. Continue regular physical activity and diet control",
    "Annual wellness panel after 6 months",
    new Date(now + 60 * DAY).toISOString().split("T")[0],
    now - 2 * DAY
  );

  // Priya Patel - Visit 1 (10 days ago)
  const rx4Meds = JSON.stringify([
    { name: "Pantoprazole + Domperidone", strength: "40mg/30mg", dosage: "1-0-0", timing: "Before food", duration: "14 days", instruction: "Take 30 mins before breakfast on empty stomach" },
    { name: "Sucralfate Syrup", strength: "10ml", dosage: "1-1-1", timing: "Empty stomach", duration: "7 days", instruction: "Shake well before use, avoid food for 30 mins after syrup" },
  ]);
  insertRx.run(
    p2.lastInsertRowid,
    "58.0",
    "118/76",
    "74",
    "98.4",
    "99",
    "Epigastric burning sensation, post-prandial fullness for 1 week",
    "Frequent skipping of meals, high tea/coffee consumption",
    "Non-Ulcer Dyspepsia (GERD / Acid Peptic Disease)",
    rx4Meds,
    "Small frequent meals, avoid spicy/fried foods and caffeine, elevate head while sleeping",
    "Ultrasound Abdomen if symptoms persist",
    new Date(now).toISOString().split("T")[0],
    now - 10 * DAY
  );

  // Priya Patel - Visit 2 (1 day ago)
  const rx5Meds = JSON.stringify([
    { name: "Pantoprazole", strength: "40mg", dosage: "1-0-0", timing: "Before food", duration: "14 days", instruction: "Taper to single agent before breakfast" },
  ]);
  insertRx.run(
    p2.lastInsertRowid,
    "58.3",
    "116/74",
    "70",
    "98.5",
    "99",
    "Follow-up for GERD. Burning significantly subsided, no regurgitation",
    "Complete resolution of acute symptoms",
    "Acid Peptic Disease - Symptomatically Controlled",
    rx5Meds,
    "Continue regular meal timings, reduce stress and late-night snacking",
    "None required at present",
    new Date(now + 30 * DAY).toISOString().split("T")[0],
    now - 1 * DAY
  );

  console.log("✓ Seeded sample multi-visit patient records (Amit Verma: 3 visits, Priya Patel: 2 visits) with longitudinal vitals");
} else {
  console.log("• Patients already exist, skipping patient seeding");
}

console.log("✓ Database seeding complete!");
