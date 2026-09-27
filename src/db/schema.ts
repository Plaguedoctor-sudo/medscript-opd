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
  abhaAddress: text("abha_address"),
  allergies: text("allergies"),
  bloodGroup: text("blood_group"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const patientsRelations = relations(patients, ({ many }) => ({
  prescriptions: many(prescriptions),
  invoices: many(invoices),
  admissions: many(ipdAdmissions),
  labReports: many(labReports),
  appointments: many(appointments),
  consents: many(clinicalConsents),
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
  // Google Drive Cloud Backup
  gdriveBackupEnabled: integer("gdrive_backup_enabled", { mode: "boolean" }).$defaultFn(() => false),
  gdriveFolderId: text("gdrive_folder_id"),
  gdriveClientEmail: text("gdrive_client_email"),
  gdrivePrivateKey: text("gdrive_private_key"),
  gdriveEncryptionKey: text("gdrive_encryption_key"),
  gdriveLastBackupAt: integer("gdrive_last_backup_at", { mode: "timestamp" }),
  gdriveLastBackupStatus: text("gdrive_last_backup_status"),
  gdriveLastBackupFileId: text("gdrive_last_backup_file_id"),
  gdriveLastBackupFileName: text("gdrive_last_backup_file_name"),
  gdriveAutoBackupInterval: text("gdrive_auto_backup_interval").default("DAILY"),
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
  emarRecords: many(emarRecords),
  consents: many(clinicalConsents),
  deposits: many(ipdDeposits),
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

export const staffUsers = sqliteTable("staff_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loginId: text("login_id").notNull().unique(), // e.g. 'admin', 'doctor', 'nurse', 'receptionist', 'labtech'
  passwordHash: text("password_hash").notNull(), // scrypt memory-hard hash
  name: text("name").notNull(), // Full Name e.g. "Dr. Admin (CMO)"
  role: text("role").notNull().default("DOCTOR"), // 'ADMIN_DOCTOR' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'LAB_TECHNICIAN'
  subRole: text("sub_role"), // e.g. "Chief Medical Officer", "Consulting Physician", "Inpatient Staff Nurse"
  department: text("department"), // e.g. "Administration", "General Medicine", "IPD Ward", "Pathology"
  phone: text("phone"),
  email: text("email"),
  qualifications: text("qualifications"), // e.g. "MBBS, MD", "B.Sc Nursing", "DMLT"
  regNumber: text("reg_number"), // License / Council Reg No.
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Pharmacy & Consumables Inventory
export const pharmacyInventory = sqliteTable("pharmacy_inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicineName: text("medicine_name").notNull(),
  brandName: text("brand_name"),
  category: text("category").notNull().default("Tablet"), // Tablet, Capsule, Syrup, Injection, IV Fluid, Ointment, Surgical Consumable
  batchNo: text("batch_no").notNull(),
  expiryDate: text("expiry_date").notNull(), // YYYY-MM-DD
  quantityInStock: integer("quantity_in_stock").notNull().default(0),
  minThreshold: integer("min_threshold").notNull().default(20),
  purchaseCost: real("purchase_cost").notNull().default(0),
  mrp: real("mrp").notNull().default(0),
  sellingPrice: real("selling_price").notNull().default(0),
  rackLocation: text("rack_location"), // e.g. "Rack A-2"
  supplierName: text("supplier_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const pharmacyTransactions = sqliteTable("pharmacy_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inventoryId: integer("inventory_id")
    .notNull()
    .references(() => pharmacyInventory.id),
  type: text("type").notNull(), // 'INWARD' | 'DISPENSED' | 'ADJUSTMENT' | 'EXPIRED'
  quantity: integer("quantity").notNull(),
  patientId: integer("patient_id").references(() => patients.id),
  prescriptionId: integer("prescription_id").references(() => prescriptions.id),
  admissionId: integer("admission_id").references(() => ipdAdmissions.id),
  remarks: text("remarks"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const pharmacyTransactionsRelations = relations(pharmacyTransactions, ({ one }) => ({
  inventory: one(pharmacyInventory, {
    fields: [pharmacyTransactions.inventoryId],
    references: [pharmacyInventory.id],
  }),
  patient: one(patients, {
    fields: [pharmacyTransactions.patientId],
    references: [patients.id],
  }),
}));

// OPD Appointments & Waiting Room Token Queue
export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenNo: integer("token_no").notNull(),
  appointmentDate: text("appointment_date").notNull(), // YYYY-MM-DD
  timeSlot: text("time_slot"), // e.g. "10:30 AM"
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: integer("doctor_id").references(() => staffUsers.id),
  doctorName: text("doctor_name"),
  type: text("type").notNull().default("OPD_CONSULTATION"), // 'OPD_CONSULTATION' | 'FOLLOW_UP' | 'EMERGENCY' | 'VACCINATION'
  status: text("status").notNull().default("SCHEDULED"), // 'SCHEDULED' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  chiefComplaint: text("chief_complaint"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
}));

// Inpatient Nurse eMAR (Electronic Medication Administration Record)
export const emarRecords = sqliteTable("emar_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  medicationName: text("medication_name").notNull(),
  dosage: text("dosage").notNull(),
  route: text("route").default("Oral"), // Oral, IV, IM, SC, Topical, Nebulization
  scheduledTime: integer("scheduled_time", { mode: "timestamp" }).notNull(),
  administeredAt: integer("administered_at", { mode: "timestamp" }),
  status: text("status").notNull().default("PENDING"), // 'PENDING' | 'GIVEN' | 'WITHHELD' | 'REFUSED'
  nurseName: text("nurse_name"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const emarRecordsRelations = relations(emarRecords, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [emarRecords.admissionId],
    references: [ipdAdmissions.id],
  }),
}));

// Clinical Consents & Digital Signature Pad
export const clinicalConsents = sqliteTable("clinical_consents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  admissionId: integer("admission_id").references(() => ipdAdmissions.id),
  consentType: text("consent_type").notNull(), // 'GENERAL_ADMISSION' | 'SURGICAL_PROCEDURE' | 'HIGH_RISK' | 'DISCHARGE_LAMA' | 'DATA_SHARING_ABDM'
  title: text("title").notNull(),
  content: text("content").notNull(),
  patientSignature: text("patient_signature"), // Base64 data URL PNG
  signedByName: text("signed_by_name").notNull(),
  relationship: text("relationship").notNull().default("Self"), // 'Self' | 'Spouse' | 'Parent' | 'Child' | 'Guardian'
  witnessName: text("witness_name"),
  doctorSignature: text("doctor_signature"),
  signedAt: integer("signed_at", { mode: "timestamp" }),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const clinicalConsentsRelations = relations(clinicalConsents, ({ one }) => ({
  patient: one(patients, {
    fields: [clinicalConsents.patientId],
    references: [patients.id],
  }),
  admission: one(ipdAdmissions, {
    fields: [clinicalConsents.admissionId],
    references: [ipdAdmissions.id],
  }),
}));

// Inpatient Advance Deposits & Ledger
export const ipdDeposits = sqliteTable("ipd_deposits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  receiptNo: text("receipt_no").notNull().unique(),
  amount: real("amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("Cash"), // 'Cash' | 'UPI' | 'Card' | 'Bank Transfer'
  transactionRef: text("transaction_ref"),
  type: text("type").notNull().default("ADVANCE"), // 'ADVANCE' | 'TOP_UP' | 'REFUND'
  notes: text("notes"),
  collectedBy: text("collected_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdDepositsRelations = relations(ipdDeposits, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdDeposits.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [ipdDeposits.patientId],
    references: [patients.id],
  }),
}));

