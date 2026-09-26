import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
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
  invoices: many(invoices),
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
  sessionSecret: text("session_secret"), // Cryptographically generated dynamic session secret
  lockdownActive: integer("lockdown_active", { mode: "boolean" }).$defaultFn(() => false),
  lockdownReason: text("lockdown_reason"),
  lockdownTriggeredAt: integer("lockdown_triggered_at", { mode: "timestamp" }),
  deceptionModeActive: integer("deception_mode_active", { mode: "boolean" }).$defaultFn(() => false),
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

export const securityAlerts = sqliteTable("security_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  severity: text("severity").notNull(), // 'CRITICAL' | 'WARNING' | 'INFO'
  category: text("category").notNull(), // 'BRUTE_FORCE' | 'BREAK_GLASS' | 'UNUSUAL_TRANSFER' | 'ACCESS_VIOLATION' | 'INTEGRITY_TAMPER'
  title: text("title").notNull(),
  description: text("description").notNull(),
  ipAddress: text("ip_address"),
  metadata: text("metadata"), // JSON string with incident metrics (e.g. export count, attempted action)
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
  acknowledgedBy: text("acknowledged_by"),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNo: text("invoice_no").notNull().unique(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  prescriptionId: integer("prescription_id"),
  items: text("items").notNull(), // JSON string: [{ id, description, quantity, unitPrice, total, category }]
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").default(0),
  tax: real("tax").default(0),
  totalAmount: real("total_amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("Cash"), // 'Cash' | 'UPI' | 'Card' | 'Due'
  paymentStatus: text("payment_status").notNull().default("PAID"), // 'PAID' | 'PENDING' | 'REFUNDED'
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const invoicesRelations = relations(invoices, ({ one }) => ({
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
}));

