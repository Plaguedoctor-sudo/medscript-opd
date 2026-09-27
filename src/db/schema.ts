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
  admissions: many(ipdAdmissions),
  labReports: many(labReports),
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

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
  labReports: many(labReports),
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
  sessionRevokedBefore: integer("session_revoked_before", { mode: "timestamp" }),
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

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  firstAttempt: integer("first_attempt").notNull(),
  lockedUntil: integer("locked_until").notNull().default(0),
});

export const breakGlassLimits = sqliteTable("break_glass_limits", {
  ip: text("ip").primaryKey(),
  uses: integer("uses").notNull().default(0),
  firstUse: integer("first_use").notNull(),
});

export const ipdAdmissions = sqliteTable("ipd_admissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionNo: text("admission_no").notNull().unique(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  admissionDate: integer("admission_date", { mode: "timestamp" }).notNull(),
  dischargeDate: integer("discharge_date", { mode: "timestamp" }),
  status: text("status").notNull().default("ADMITTED"), // 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED'
  ward: text("ward").notNull(), // 'General Ward', 'ICU', 'Semi-Private Room', 'Deluxe Room', 'Emergency / Triage'
  bedNo: text("bed_no").notNull(), // 'Bed-01', 'ICU-3', etc.
  roomType: text("room_type").default("General"), // 'General' | 'Semi-Private' | 'Private' | 'ICU' | 'Emergency'
  attendingDoctor: text("attending_doctor"),
  admittingDiagnosis: text("admitting_diagnosis"),
  chiefComplaints: text("chief_complaints"),
  admissionVitals: text("admission_vitals"), // JSON string: { bp, pulse, temp, spo2, weight, rbs }
  dischargeCondition: text("discharge_condition"), // 'Stable' | 'Recovered' | 'Referred' | 'LAMA' | 'Deceased'
  dischargeSummary: text("discharge_summary"),
  dischargeAdvice: text("discharge_advice"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdAdmissionsRelations = relations(ipdAdmissions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [ipdAdmissions.patientId],
    references: [patients.id],
  }),
  rounds: many(ipdRounds),
  labReports: many(labReports),
}));

export const ipdRounds = sqliteTable("ipd_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  roundDate: integer("round_date", { mode: "timestamp" }).notNull(),
  doctorOrStaff: text("doctor_or_staff").notNull(),
  role: text("role").default("DOCTOR"), // 'DOCTOR' | 'NURSE' | 'STAFF'
  notes: text("notes").notNull(),
  treatmentOrders: text("treatment_orders"),
  vitals: text("vitals"), // JSON string: { bp, pulse, temp, spo2, weight, rbs }
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdRoundsRelations = relations(ipdRounds, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdRounds.admissionId],
    references: [ipdAdmissions.id],
  }),
}));

export const labReports = sqliteTable("lab_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportNo: text("report_no").notNull().unique(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  prescriptionId: integer("prescription_id").references(() => prescriptions.id),
  ipdAdmissionId: integer("ipd_admission_id").references(() => ipdAdmissions.id),
  testName: text("test_name").notNull(),
  category: text("category").notNull().default("General"),
  sampleType: text("sample_type"),
  sampleCollectedAt: integer("sample_collected_at", { mode: "timestamp" }),
  reportedAt: integer("reported_at", { mode: "timestamp" }),
  status: text("status").notNull().default("PENDING"), // 'PENDING' | 'SAMPLE_COLLECTED' | 'COMPLETED' | 'CANCELLED'
  referredBy: text("referred_by"),
  technicianName: text("technician_name"),
  results: text("results").notNull().default("[]"), // JSON string of LabResultParameter[]
  interpretation: text("interpretation"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const labReportsRelations = relations(labReports, ({ one }) => ({
  patient: one(patients, {
    fields: [labReports.patientId],
    references: [patients.id],
  }),
  prescription: one(prescriptions, {
    fields: [labReports.prescriptionId],
    references: [prescriptions.id],
  }),
  admission: one(ipdAdmissions, {
    fields: [labReports.ipdAdmissionId],
    references: [ipdAdmissions.id],
  }),
}));

