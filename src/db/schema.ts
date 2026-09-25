import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const patients = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regNo: text("reg_no"),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(), // Male, Female, Other
  phone: text("phone"),
  abhaId: text("abha_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const patientsRelations = relations(patients, ({ many }) => ({
  prescriptions: many(prescriptions),
}));

export const prescriptions = sqliteTable("prescriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  
  // Vitals
  weight: text("weight"),
  bp: text("bp"),
  pulse: text("pulse"),
  temp: text("temp"),
  spo2: text("spo2"),

  // Clinical Info
  chiefComplaints: text("chief_complaints"),
  clinicalHistory: text("clinical_history"),
  diagnosis: text("diagnosis"),
  
  // Medications (Stored as JSON string for simplicity in this MVP)
  // Format: [{ name: string, strength: string, dosage: string, timing: string, duration: string }]
  medications: text("medications").notNull(), 
  
  advice: text("advice"),
  labTests: text("lab_tests"),
  followUpDate: text("follow_up_date"),
  signatureHash: text("signature_hash"), // HMAC-SHA256 tamper-evident digital seal
  
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
}));

export const clinicSettings = sqliteTable("clinic_settings", {
  id: integer("id").primaryKey().$default(() => 1), // Only one row
  doctorName: text("doctor_name").notNull(),
  qualifications: text("qualifications").notNull(),
  regNumber: text("reg_number").notNull(),
  clinicName: text("clinic_name").notNull(),
  address: text("address").notNull(),
  contact: text("contact").notNull(),
  logoUrl: text("logo_url"),
  pinHash: text("pin_hash"),
  staffPinHash: text("staff_pin_hash"), // Staff / Receptionist PIN for triage and registration
  rbacEnabled: integer("rbac_enabled", { mode: "boolean" }).$defaultFn(() => false),
  securityEnabled: integer("security_enabled", { mode: "boolean" }).$defaultFn(() => false),
  autoLockMinutes: integer("auto_lock_minutes").default(15),
  mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).$defaultFn(() => false),
  mfaSecret: text("mfa_secret"), // Base32 RFC 6238 TOTP Secret
  mfaBackupCodes: text("mfa_backup_codes"), // JSON array of SHA-256 hashed single-use recovery codes
  pinUpdatedAt: integer("pin_updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  rotationDays: integer("rotation_days").default(90), // 60 or 90 days mandatory password rotation
  minPinLength: integer("min_pin_length").default(4), // Minimum length requirement (4-12)
  enforceComplexity: integer("enforce_complexity", { mode: "boolean" }).$defaultFn(() => false),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(() => new Date()),
  action: text("action").notNull(),
  actorRole: text("actor_role").default("DOCTOR"), // 'DOCTOR' | 'RECEPTIONIST' | 'SYSTEM'
  details: text("details"),
  ipAddress: text("ip_address"),
  status: text("status").notNull().default("SUCCESS"), // 'SUCCESS' | 'FAILURE' | 'WARNING'
});
