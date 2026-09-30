/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
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
  documents: many(patientDocuments),
  certificates: many(medicalCertificates),
}));

export const prescriptions = sqliteTable("prescriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  
  // Vitals
  weight: text("weight"),
  height: text("height"), // in cm
  bmi: text("bmi"), // computed Body Mass Index
  bp: text("bp"),
  pulse: text("pulse"),
  temp: text("temp"),
  spo2: text("spo2"),
  rbs: text("rbs"), // Random / Fasting Blood Sugar in mg/dL
  respiratoryRate: text("respiratory_rate"), // breaths/min

  // Doctor Attribution
  doctorId: integer("doctor_id"),
  doctorName: text("doctor_name"),

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
  // Dynamic UPI Payments & Invoicing GST
  upiId: text("upi_id"), // e.g. "sonarehospital@upi" or "9876543210@paytm"
  gstNumber: text("gst_number"), // e.g. "27AAAAA0000A1Z5"
  // Automated Meta WhatsApp Cloud API
  whatsappCloudToken: text("whatsapp_cloud_token"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  // Off-Site Cloud Sync Provider
  cloudSyncProvider: text("cloud_sync_provider").default("disabled"), // 'disabled' | 'custom_webhook' | 's3' | 'drive'
  cloudSyncEndpoint: text("cloud_sync_endpoint"),
  cloudSyncApiKey: text("cloud_sync_api_key"),
  // Military Level Security & Threat Posture
  defconLevel: integer("defcon_level").default(5), // 1 (Lockdown) to 5 (Normal)
  militaryModeEnabled: integer("military_mode_enabled", { mode: "boolean" }).$defaultFn(() => true),
  ipQuarantineEnabled: integer("ip_quarantine_enabled", { mode: "boolean" }).$defaultFn(() => true),
  lastIntegritySweepAt: integer("last_integrity_sweep_at", { mode: "timestamp" }),
  lastIntegrityStatus: text("last_integrity_status"),
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
  admissionId: integer("admission_id").references(() => ipdAdmissions.id),
  items: text("items").notNull(), // JSON string: [{ id, description, quantity, unitPrice, total, category }]
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").default(0),
  tax: real("tax").default(0),
  cgst: real("cgst").default(0),
  sgst: real("sgst").default(0),
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
  admission: one(ipdAdmissions, {
    fields: [invoices.admissionId],
    references: [ipdAdmissions.id],
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
  fluidBalance: many(ipdFluidBalance),
  handovers: many(ipdHandovers),
  clinicalServices: many(ipdClinicalServices),
  invoices: many(invoices),
  devices: many(medicalDevices),
  deviceTelemetry: many(deviceTelemetryRecords),
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
  digitalSealHash: text("digital_seal_hash"),
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
  passwordUpdatedAt: integer("password_updated_at", { mode: "timestamp" }),
  sessionsRevokedBefore: integer("sessions_revoked_before", { mode: "timestamp" }),
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
  prescribedBy: text("prescribed_by"),
  notes: text("notes"),
  digitalSealHash: text("digital_seal_hash"),
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

// Inpatient Nurse Fluid Balance & Input/Output Chart
export const ipdFluidBalance = sqliteTable("ipd_fluid_balance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  entryType: text("entry_type").notNull(), // 'INTAKE' | 'OUTPUT'
  route: text("route").notNull(), // 'IV_INFUSION' | 'ORAL' | 'RT_FEED' | 'BLOOD' | 'MEDICATION_DILUTION' | 'URINE' | 'VOMIT' | 'DRAIN' | 'STOOL' | 'OTHER'
  fluidName: text("fluid_name").notNull(), // e.g. "Normal Saline 0.9%", "Ringer Lactate", "Water / Tea", "Urine (Catheter)", "Wound Drain"
  volumeMl: real("volume_ml").notNull(), // volume in mL
  shift: text("shift").default("MORNING"), // 'MORNING' | 'EVENING' | 'NIGHT'
  recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
  nurseName: text("nurse_name").notNull(),
  role: text("role").default("NURSE"), // 'NURSE' | 'DOCTOR'
  appearance: text("appearance"), // e.g. "Clear straw", "Blood-tinged", "Bilious green", "Concentrated"
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdFluidBalanceRelations = relations(ipdFluidBalance, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdFluidBalance.admissionId],
    references: [ipdAdmissions.id],
  }),
}));

// Reusable Prescription Sets / Clinical Protocols
export const prescriptionTemplates = sqliteTable("prescription_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description"),
  chiefComplaints: text("chief_complaints"),
  diagnosis: text("diagnosis"),
  medications: text("medications").notNull(), // JSON string of Medication[]
  advice: text("advice"),
  labTests: text("lab_tests"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Patient Clinical Documents & Radiology/Lab/Photo Attachments
export const patientDocuments = sqliteTable("patient_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  prescriptionId: integer("prescription_id").references(() => prescriptions.id),
  title: text("title").notNull(),
  documentType: text("document_type").notNull().default("LAB_REPORT"), // 'LAB_REPORT' | 'IMAGING_XRAY' | 'ECG' | 'CLINICAL_PHOTO' | 'REFERRAL' | 'OTHER'
  fileData: text("file_data").notNull(), // Base64 data URL or file storage URI
  fileName: text("file_name"),
  fileSizeKb: integer("file_size_kb"),
  mimeType: text("mime_type"),
  notes: text("notes"),
  uploadedBy: text("uploaded_by"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const patientDocumentsRelations = relations(patientDocuments, ({ one }) => ({
  patient: one(patients, {
    fields: [patientDocuments.patientId],
    references: [patients.id],
  }),
  prescription: one(prescriptions, {
    fields: [patientDocuments.prescriptionId],
    references: [prescriptions.id],
  }),
}));

// Outpatient Medical Certificates & Referral Letters
export const medicalCertificates = sqliteTable("medical_certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  certificateNo: text("certificate_no").notNull().unique(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: integer("doctor_id"),
  doctorName: text("doctor_name").notNull(),
  doctorRegNo: text("doctor_reg_no"),
  type: text("type").notNull().default("FITNESS"), // 'FITNESS' | 'LEAVE' | 'REFERRAL'
  diagnosis: text("diagnosis"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  restDays: integer("rest_days"),
  referralHospital: text("referral_hospital"),
  referralSpecialist: text("referral_specialist"),
  remarks: text("remarks"),
  digitalSealHash: text("digital_seal_hash"),
  issuedAt: integer("issued_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const medicalCertificatesRelations = relations(medicalCertificates, ({ one }) => ({
  patient: one(patients, {
    fields: [medicalCertificates.patientId],
    references: [patients.id],
  }),
}));

// Inpatient Hospital Discharge Summaries & Death / LAMA Certificates
export const ipdDischarges = sqliteTable("ipd_discharges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .unique()
    .references(() => ipdAdmissions.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  dischargeDate: text("discharge_date").notNull(), // YYYY-MM-DD
  dischargeTime: text("discharge_time"), // e.g. "04:30 PM"
  dischargeCondition: text("discharge_condition").notNull().default("Recovered"), // 'Recovered' | 'Improved' | 'Stable' | 'LAMA' | 'Referred' | 'Deceased'
  admissionDiagnosis: text("admission_diagnosis"),
  finalDiagnosis: text("final_diagnosis").notNull(),
  clinicalSummary: text("clinical_summary").notNull(), // Hospital course and clinical summary
  investigationSummary: text("investigation_summary"),
  proceduresPerformed: text("procedures_performed"),
  dischargeVitals: text("discharge_vitals"), // JSON string { bp, pulse, temp, spo2, rr }
  dischargeMedications: text("discharge_medications").notNull().default("[]"), // JSON Medication[]
  dietAdvice: text("diet_advice"),
  activityRestrictions: text("activity_restrictions"),
  followUpDate: text("follow_up_date"), // YYYY-MM-DD
  followUpInstructions: text("follow_up_instructions"),
  urgentWarningSigns: text("urgent_warning_signs"), // When to report back to emergency
  consultantDoctorName: text("consultant_doctor_name").notNull(),
  doctorRegNo: text("doctor_reg_no"),
  digitalSealHash: text("digital_seal_hash"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdDischargesRelations = relations(ipdDischarges, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdDischarges.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [ipdDischarges.patientId],
    references: [patients.id],
  }),
}));

// Inpatient Shift-to-Shift Nursing Handover Notes
export const ipdNursingNotes = sqliteTable("ipd_nursing_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  shift: text("shift").notNull().default("Morning"), // 'Morning' | 'Evening' | 'Night'
  shiftDate: text("shift_date").notNull(), // YYYY-MM-DD
  nurseName: text("nurse_name").notNull(),
  observations: text("observations").notNull(), // General condition, complaints, IV lines, site dressings
  vitalsSummary: text("vitals_summary"), // e.g. "BP 120/80, Pulse 74, SpO2 99%"
  handoverNotes: text("handover_notes"), // Specific tasks handed over to next shift
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdNursingNotesRelations = relations(ipdNursingNotes, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdNursingNotes.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [ipdNursingNotes.patientId],
    references: [patients.id],
  }),
}));

// Inpatient Shift & Round Handovers (for Doctors and Nurses)
export const ipdHandovers = sqliteTable("ipd_handovers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  handoverType: text("handover_type").notNull().default("NURSING_SHIFT"), // 'NURSING_SHIFT' | 'DOCTOR_ROUND'
  shift: text("shift").notNull().default("Morning"), // 'Morning' | 'Evening' | 'Night' | 'Day Round' | 'Night On-Call'
  handoverDate: integer("handover_date", { mode: "timestamp" }).notNull(),
  outgoingStaffName: text("outgoing_staff_name").notNull(),
  outgoingStaffRole: text("outgoing_staff_role").notNull().default("NURSE"), // 'DOCTOR' | 'NURSE'
  incomingStaffName: text("incoming_staff_name").notNull(),
  patientCondition: text("patient_condition").notNull().default("Stable"), // 'Stable' | 'Critical' | 'Guarded' | 'Improving' | 'Post-Op' | 'Discharge Ready'
  vitalsSummary: text("vitals_summary"), // e.g. "BP 120/80, Pulse 74, SpO2 98%"
  summaryNotes: text("summary_notes").notNull(),
  activeTreatmentOrders: text("active_treatment_orders"),
  pendingTasks: text("pending_tasks"),
  specialPrecautions: text("special_precautions"), // e.g. "Fall risk, NPO after midnight, strict fluid balance"
  digitalSealHash: text("digital_seal_hash"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdHandoversRelations = relations(ipdHandovers, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdHandovers.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [ipdHandovers.patientId],
    references: [patients.id],
  }),
}));

// Inpatient Nursing Procedures & Clinical Services (Oxygen, Suction, Drainage, etc.)
export const ipdClinicalServices = sqliteTable("ipd_clinical_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id")
    .notNull()
    .references(() => ipdAdmissions.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  serviceType: text("service_type").notNull().default("OXYGEN_THERAPY"), // 'OXYGEN_THERAPY' | 'SUCTIONING' | 'DRAINAGE_CARE' | 'NEBULIZATION' | 'CATHETER_CARE' | 'WOUND_DRESSING' | 'OTHER'
  serviceName: text("service_name").notNull(),
  performedAt: integer("performed_at", { mode: "timestamp" }).notNull(),
  nurseName: text("nurse_name").notNull(), // Administering nurse name
  attendingDoctorName: text("attending_doctor_name").notNull(), // Ordering/supervising doctor name
  flowRateOrDetails: text("flow_rate_or_details"), // e.g. "3 L/min via Nasal Cannula, SpO2 99%", "120 mL serosanguinous output"
  observations: text("observations"),
  status: text("status").notNull().default("COMPLETED"), // 'COMPLETED' | 'ONGOING' | 'DISCONTINUED'
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ipdClinicalServicesRelations = relations(ipdClinicalServices, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [ipdClinicalServices.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [ipdClinicalServices.patientId],
    references: [patients.id],
  }),
}));

// Military Security Threat Sentinel - Automated IP Quarantine & Blacklist
export const quarantinedIps = sqliteTable("quarantined_ips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason").notNull(),
  violationCount: integer("violation_count").notNull().default(1),
  quarantinedAt: integer("quarantined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  pardonedAt: integer("pardoned_at", { mode: "timestamp" }),
  pardonedBy: text("pardoned_by"),
});

// ==========================================
// ICU & IPD MEDICAL DEVICE TELEMETRY ENGINE
// ==========================================
export const medicalDevices = sqliteTable("medical_devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull().unique(), // e.g. "DEV-ICU-MON-01"
  name: text("name").notNull(), // e.g. "Mindray BeneVision N17 Bedside Monitor"
  deviceType: text("device_type").notNull().default("patient_monitor"), // 'patient_monitor' | 'ventilator' | 'infusion_pump' | 'dialysis_crrt' | 'capnograph' | 'defibrillator_monitor'
  model: text("model"),
  serialNumber: text("serial_number"),
  locationWard: text("location_ward").notNull().default("ICU"), // 'ICU' | 'HDU' | 'General Ward' | 'Emergency / Triage' | 'Post-Op Recovery'
  assignedBed: text("assigned_bed"), // e.g. "ICU-01", "Bed-03"
  currentAdmissionId: integer("current_admission_id").references(() => ipdAdmissions.id),
  status: text("status").notNull().default("STANDBY"), // 'ONLINE' | 'STREAMING' | 'STANDBY' | 'ALARM' | 'MAINTENANCE' | 'OFFLINE'
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  protocol: text("protocol").default("HL7_V2_ORU"), // 'HL7_V2_ORU' | 'IEEE_11073' | 'FHIR_OBSERVATION' | 'REST_JSON'
  batteryPercent: integer("battery_percent").default(100),
  lastTelemetryAt: integer("last_telemetry_at", { mode: "timestamp" }),
  config: text("config"), // JSON string with alarm thresholds: { hrLow: 50, hrHigh: 120, spo2Low: 92, sysLow: 90, sysHigh: 160, rrLow: 10, rrHigh: 30, pipHigh: 35 }
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const medicalDevicesRelations = relations(medicalDevices, ({ one, many }) => ({
  admission: one(ipdAdmissions, {
    fields: [medicalDevices.currentAdmissionId],
    references: [ipdAdmissions.id],
  }),
  telemetryRecords: many(deviceTelemetryRecords),
  alerts: many(deviceAlerts),
}));

export const deviceTelemetryRecords = sqliteTable("device_telemetry_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  admissionId: integer("admission_id").references(() => ipdAdmissions.id),
  patientId: integer("patient_id").references(() => patients.id),
  // Vitals Parameters
  heartRate: integer("heart_rate"), // bpm
  pulseRate: integer("pulse_rate"), // bpm
  spo2: integer("spo2"), // %
  systolicBp: integer("systolic_bp"), // mmHg
  diastolicBp: integer("diastolic_bp"), // mmHg
  meanArterialPressure: integer("mean_arterial_pressure"), // MAP mmHg
  respiratoryRate: integer("respiratory_rate"), // breaths/min
  bodyTemperature: real("body_temperature"), // °C
  etco2: integer("etco2"), // mmHg
  // Ventilator Parameters
  ventilatorMode: text("ventilator_mode"), // e.g. 'VCV', 'PCV', 'SIMV+PS', 'CPAP/PSV'
  fio2: integer("fio2"), // FiO2 % (21 - 100)
  peep: real("peep"), // cmH2O
  tidalVolume: integer("tidal_volume"), // mL
  peakInspiratoryPressure: real("peak_inspiratory_pressure"), // PIP cmH2O
  minuteVentilation: real("minute_ventilation"), // L/min
  // Infusion / Syringe Pump Parameters
  infusionDrug: text("infusion_drug"), // e.g. 'Noradrenaline', 'Propofol', 'Fentanyl'
  infusionRate: real("infusion_rate"), // mL/h
  infusionDose: text("infusion_dose"), // e.g. '0.08 mcg/kg/min'
  totalVolumeInfused: real("total_volume_infused"), // mL
  infusionStatus: text("infusion_status"), // 'INFUSING' | 'KVO' | 'PAUSED' | 'OCCLUSION' | 'COMPLETE'
  // Clinical Scoring & Alerts
  news2Score: integer("news2_score"), // 0 - 20
  alertLevel: text("alert_level").default("NORMAL"), // 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  activeAlerts: text("active_alerts"), // JSON array of active alarm strings
  rawPayload: text("raw_payload"), // Optional raw HL7 or JSON packet
  recordedAt: integer("recorded_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const deviceTelemetryRecordsRelations = relations(deviceTelemetryRecords, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [deviceTelemetryRecords.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [deviceTelemetryRecords.patientId],
    references: [patients.id],
  }),
}));

export const deviceAlerts = sqliteTable("device_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  admissionId: integer("admission_id").references(() => ipdAdmissions.id),
  severity: text("severity").notNull().default("WARNING"), // 'INFO' | 'WARNING' | 'CRITICAL' | 'LIFE_THREATENING'
  category: text("category").notNull().default("VITALS"), // 'VITALS' | 'VENTILATOR' | 'INFUSION' | 'TECHNICAL' | 'LEADS_OFF'
  title: text("title").notNull(),
  description: text("description").notNull(),
  isAcknowledged: integer("is_acknowledged", { mode: "boolean" }).notNull().default(false),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const deviceAlertsRelations = relations(deviceAlerts, ({ one }) => ({
  admission: one(ipdAdmissions, {
    fields: [deviceAlerts.admissionId],
    references: [ipdAdmissions.id],
  }),
}));




