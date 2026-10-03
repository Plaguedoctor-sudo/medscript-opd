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
  // High-Availability LAN Peer Mirroring & Zero-Data-Loss Replication
  lanMirrorRole: text("lan_mirror_role").default("STANDALONE"), // 'PRIMARY_MASTER' | 'STANDBY_REPLICA' | 'STANDALONE'
  lanMirrorPeerUrl: text("lan_mirror_peer_url"), // e.g. "https://192.168.1.150:3000"
  lanMirrorClusterSecret: text("lan_mirror_cluster_secret"), // Pre-shared HMAC cluster replication secret
  lanMirrorNodeName: text("lan_mirror_node_name").default("Doctor Desk (Primary)"),
  lanMirrorAutoFailover: integer("lan_mirror_auto_failover", { mode: "boolean" }).$defaultFn(() => false),
  lanMirrorLastSyncAt: integer("lan_mirror_last_sync_at", { mode: "timestamp" }),
  lanMirrorLastSyncStatus: text("lan_mirror_last_sync_status").default("IDLE"),
  lanMirrorLastSyncHash: text("lan_mirror_last_sync_hash"),
  lanMirrorHeartbeatIntervalSec: integer("lan_mirror_heartbeat_interval_sec").default(15),
  // CCTV Feed Storage & NVR Retention Policy
  cctvStoragePath: text("cctv_storage_path").default("cctv_recordings"),
  cctvRetentionDays: integer("cctv_retention_days").default(30),
  cctvMaxStorageGb: integer("cctv_max_storage_gb").default(50),
  cctvAutoPurgeEnabled: integer("cctv_auto_purge_enabled", { mode: "boolean" }).$defaultFn(() => true),
});

export const lanMirrorAudit = sqliteTable("lan_mirror_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(() => new Date()),
  eventType: text("event_type").notNull(), // 'HEARTBEAT' | 'SNAPSHOT_PULL' | 'SNAPSHOT_PUSH' | 'FAILOVER_PROMOTION' | 'PEER_DISCOVERY'
  peerUrl: text("peer_url"),
  direction: text("direction"), // 'INBOUND' | 'OUTBOUND'
  status: text("status").notNull(), // 'SUCCESS' | 'FAILURE' | 'LAGGING'
  bytesTransferred: integer("bytes_transferred").default(0),
  checksum: text("checksum"),
  errorMessage: text("error_message"),
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

// ===========================================================================
// PHARMACIST DRUG DISPENSATION MODULE
// ===========================================================================
export const prescriptionDispensations = sqliteTable("prescription_dispensations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prescriptionId: integer("prescription_id").references(() => prescriptions.id),
  admissionId: integer("admission_id").references(() => ipdAdmissions.id),
  patientId: integer("patient_id").references(() => patients.id),
  dispensationType: text("dispensation_type").notNull().default("OPD_PRESCRIPTION"), // 'OPD_PRESCRIPTION' | 'IPD_ROUND_MEDICATION'
  dispensedBy: text("dispensed_by").notNull(),
  dispensedByUserId: integer("dispensed_by_user_id").references(() => staffUsers.id),
  itemsJson: text("items_json").notNull(), // JSON string of DispensedItem[]
  status: text("status").notNull().default("DISPENSED"), // 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'READY_FOR_PICKUP'
  remarks: text("remarks"),
  dispensedAt: integer("dispensed_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const prescriptionDispensationsRelations = relations(prescriptionDispensations, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [prescriptionDispensations.prescriptionId],
    references: [prescriptions.id],
  }),
  admission: one(ipdAdmissions, {
    fields: [prescriptionDispensations.admissionId],
    references: [ipdAdmissions.id],
  }),
  patient: one(patients, {
    fields: [prescriptionDispensations.patientId],
    references: [patients.id],
  }),
  dispensedByUser: one(staffUsers, {
    fields: [prescriptionDispensations.dispensedByUserId],
    references: [staffUsers.id],
  }),
}));

// ===========================================================================
// HOSPITAL MANAGER: SURGICAL INSTRUMENTS, CONSUMABLES, SERVICING & PROCUREMENT
// ===========================================================================
export const hospitalAssets = sqliteTable("hospital_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // 'SURGICAL_INSTRUMENT' | 'CLEANING_AGENT' | 'TOILETRIES' | 'LINEN_BEDSHEET' | 'GENERAL_CONSUMABLE'
  specification: text("specification"),
  quantityInStock: integer("quantity_in_stock").notNull().default(0),
  unit: text("unit").notNull().default("units"), // sets, pieces, liters, bottles, packs, boxes
  minThreshold: integer("min_threshold").notNull().default(5),
  location: text("location"), // e.g. "Central Store", "OT Sterile Room", "Linen Wardrobe", "Housekeeping Store"
  purchaseCost: real("purchase_cost").notNull().default(0),
  supplierName: text("supplier_name"),
  maintenanceStatus: text("maintenance_status").notNull().default("OPERATIONAL"), // 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'CALIBRATION_DUE' | 'OUT_OF_SERVICE' | 'NOT_APPLICABLE'
  lastServiceDate: text("last_service_date"), // YYYY-MM-DD
  nextServiceDue: text("next_service_due"), // YYYY-MM-DD
  serviceVendor: text("service_vendor"),
  serviceVendorPhone: text("service_vendor_phone"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalServiceLogs = sqliteTable("hospital_service_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull().references(() => hospitalAssets.id),
  serviceDate: text("service_date").notNull(), // YYYY-MM-DD
  serviceType: text("service_type").notNull(), // 'PREVENTIVE' | 'BREAKDOWN' | 'CALIBRATION' | 'AMC_VISIT' | 'SHARPENING'
  technicianName: text("technician_name"),
  vendorName: text("vendor_name"),
  cost: real("cost").notNull().default(0),
  workDescription: text("work_description").notNull(),
  partsReplaced: text("parts_replaced"),
  nextDueDate: text("next_due_date"), // YYYY-MM-DD
  status: text("status").notNull().default("COMPLETED"), // 'COMPLETED' | 'PENDING_PARTS' | 'SCHEDULED'
  loggedBy: text("logged_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalServiceLogsRelations = relations(hospitalServiceLogs, ({ one }) => ({
  asset: one(hospitalAssets, {
    fields: [hospitalServiceLogs.assetId],
    references: [hospitalAssets.id],
  }),
}));

export const hospitalProcurementOrders = sqliteTable("hospital_procurement_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNo: text("order_no").notNull(), // PO-YYYY-NNNN
  vendorName: text("vendor_name").notNull(),
  category: text("category").notNull(), // 'SURGICAL_INSTRUMENT' | 'CLEANING_AGENT' | 'TOILETRIES' | 'LINEN_BEDSHEET' | 'GENERAL_CONSUMABLE'
  itemsJson: text("items_json").notNull(), // JSON string of ProcurementOrderItem[]
  totalAmount: real("total_amount").notNull().default(0),
  orderDate: text("order_date").notNull(), // YYYY-MM-DD
  expectedDeliveryDate: text("expected_delivery_date"),
  receivedDate: text("received_date"),
  status: text("status").notNull().default("ORDERED"), // 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  orderedBy: text("ordered_by"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalDepartmentDispatches = sqliteTable("hospital_department_dispatches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dispatchNo: text("dispatch_no").notNull(), // DSP-YYYY-NNNN
  assetId: integer("asset_id").references(() => hospitalAssets.id),
  assetName: text("asset_name").notNull(),
  category: text("category").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  targetDepartment: text("target_department").notNull(), // 'OPERATION_THEATRE' | 'ICU' | 'IPD_WARD' | 'OPD' | 'EMERGENCY' | 'LAB' | 'DIALYSIS' | 'GENERAL'
  recipientStaff: text("recipient_staff").notNull(),
  dispatchedBy: text("dispatched_by").notNull(),
  dispatchDate: text("dispatch_date").notNull(), // YYYY-MM-DD
  remarks: text("remarks"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalDepartmentDispatchesRelations = relations(hospitalDepartmentDispatches, ({ one }) => ({
  asset: one(hospitalAssets, {
    fields: [hospitalDepartmentDispatches.assetId],
    references: [hospitalAssets.id],
  }),
}));

export const hospitalCctvCameras = sqliteTable("hospital_cctv_cameras", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  zone: text("zone").notNull(), // 'ICU' | 'EMERGENCY' | 'OT' | 'IPD_WARD' | 'PHARMACY' | 'OPD_RECEPTION' | 'STORES_ASSETS' | 'PERIMETER'
  location: text("location"),
  streamUrl: text("stream_url").notNull().default("simulated:icu"),
  status: text("status").notNull().default("ONLINE"), // 'ONLINE' | 'OFFLINE' | 'MAINTENANCE'
  resolution: text("resolution").notNull().default("1080p"), // '1080p' | '4K' | '720p'
  fps: integer("fps").notNull().default(25),
  hasPtz: integer("has_ptz").notNull().default(0), // 0 or 1
  privacyMasking: integer("privacy_masking").notNull().default(0), // 0 or 1
  motionDetectionEnabled: integer("motion_detection_enabled").notNull().default(1),
  ipAddress: text("ip_address"),
  lastPingAt: integer("last_ping_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalCctvIncidents = sqliteTable("hospital_cctv_incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cameraId: integer("camera_id").references(() => hospitalCctvCameras.id),
  cameraName: text("camera_name").notNull(),
  zone: text("zone").notNull(),
  incidentType: text("incident_type").notNull(), // 'PATIENT_FALL_RISK' | 'UNAUTHORIZED_ENTRY' | 'AFTER_HOURS_MOTION' | 'QUEUE_OVERFLOW' | 'EQUIPMENT_TAMPER' | 'MANUAL_SECURITY_FLAG'
  severity: text("severity").notNull().default("MEDIUM"), // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: text("description").notNull(),
  snapshotUrl: text("snapshot_url"),
  acknowledged: integer("acknowledged").notNull().default(0), // 0 or 1
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalCctvIncidentsRelations = relations(hospitalCctvIncidents, ({ one }) => ({
  camera: one(hospitalCctvCameras, {
    fields: [hospitalCctvIncidents.cameraId],
    references: [hospitalCctvCameras.id],
  }),
}));

export const hospitalCctvRecordings = sqliteTable("hospital_cctv_recordings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cameraId: integer("camera_id").references(() => hospitalCctvCameras.id).notNull(),
  cameraName: text("camera_name").notNull(),
  zone: text("zone").notNull(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }).notNull(),
  triggerType: text("trigger_type").notNull().default("CONTINUOUS"), // 'CONTINUOUS' | 'MOTION' | 'INCIDENT' | 'MANUAL'
  incidentId: integer("incident_id").references(() => hospitalCctvIncidents.id),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().$defaultFn(() => false),
  lockReason: text("lock_reason"),
  checksumSha256: text("checksum_sha256").notNull(), // Tamper-evident Section 65B forensic seal
  thumbnailData: text("thumbnail_data"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalCctvRecordingsRelations = relations(hospitalCctvRecordings, ({ one }) => ({
  camera: one(hospitalCctvCameras, {
    fields: [hospitalCctvRecordings.cameraId],
    references: [hospitalCctvCameras.id],
  }),
  incident: one(hospitalCctvIncidents, {
    fields: [hospitalCctvRecordings.incidentId],
    references: [hospitalCctvIncidents.id],
  }),
}));

// ========================================================
// Multi-Branch Clinic Mesh Replication & Vector Clock Log
// ========================================================

export const meshNodes = sqliteTable("mesh_nodes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nodeId: text("node_id").notNull().unique(), // e.g. 'branch_mumbai_central', 'branch_pune_rural'
  name: text("name").notNull(),
  branchType: text("branch_type").notNull().default("SATELLITE"), // 'HUB' | 'SATELLITE' | 'MOBILE_CAMP'
  endpointUrl: text("endpoint_url").notNull(),
  clusterSecret: text("cluster_secret").notNull(),
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' | 'OFFLINE' | 'SYNCING' | 'DEGRADED' | 'SUSPENDED'
  vectorClock: text("vector_clock").notNull().default("{}"), // JSON stringified VectorClock
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  lastSyncStatus: text("last_sync_status").default("IDLE"),
  latencyMs: integer("latency_ms").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const meshDeltaLog = sqliteTable("mesh_delta_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deltaId: text("delta_id").notNull().unique(), // Deterministic UUID/hash
  originNodeId: text("origin_node_id").notNull(),
  targetTable: text("target_table").notNull(), // 'patients' | 'prescriptions' | 'ipd_admissions' etc.
  recordKey: text("record_key").notNull(), // Natural business key e.g. phone/regNo/id
  operation: text("operation").notNull(), // 'INSERT' | 'UPDATE' | 'DELETE'
  payload: text("payload").notNull(), // JSON stringified mutation data
  vectorClock: text("vector_clock").notNull(), // JSON stringified vector clock at mutation time
  changeTimestamp: integer("change_timestamp").notNull(), // UTC millisecond epoch for LWW
  checksumSha256: text("checksum_sha256").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const meshOutboxQueue = sqliteTable("mesh_outbox_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetNodeId: text("target_node_id").notNull(),
  deltaId: text("delta_id").notNull().references(() => meshDeltaLog.deltaId),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: integer("next_retry_at", { mode: "timestamp" }),
  status: text("status").notNull().default("PENDING"), // 'PENDING' | 'IN_FLIGHT' | 'ACKNOWLEDGED' | 'FAILED'
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const meshOutboxQueueRelations = relations(meshOutboxQueue, ({ one }) => ({
  delta: one(meshDeltaLog, {
    fields: [meshOutboxQueue.deltaId],
    references: [meshDeltaLog.deltaId],
  }),
}));

// ==========================================
// Pediatric Growth & Immunization Records
// ==========================================

export const pediatricGrowthRecords = sqliteTable("pediatric_growth_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  recordedAt: integer("recorded_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  ageMonths: integer("age_months").notNull(),
  weightKg: real("weight_kg").notNull(),
  heightCm: real("height_cm").notNull(),
  headCircumferenceCm: real("head_circumference_cm"),
  bmi: real("bmi").notNull(),
  weightForAgeZScore: real("weight_for_age_z_score").notNull(),
  heightForAgeZScore: real("height_for_age_z_score").notNull(),
  bmiForAgeZScore: real("bmi_for_age_z_score").notNull(),
  percentileWeight: real("percentile_weight").notNull(),
  percentileHeight: real("percentile_height").notNull(),
  notes: text("notes"),
  recordedByDoctor: text("recorded_by_doctor"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const patientImmunizations = sqliteTable("patient_immunizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  vaccineName: text("vaccine_name").notNull(),
  vaccineCode: text("vaccine_code").notNull(),
  doseNumber: integer("dose_number").notNull(),
  dueAgeMonths: integer("due_age_months").notNull(),
  scheduledDate: integer("scheduled_date", { mode: "timestamp" }).notNull(),
  administeredDate: integer("administered_date", { mode: "timestamp" }),
  status: text("status").notNull().default("PENDING"), // 'PENDING' | 'GIVEN' | 'MISSED' | 'CONTRAINDICATED'
  batchNumber: text("batch_number"),
  manufacturer: text("manufacturer"),
  administeredBy: text("administered_by"),
  site: text("site"),
  route: text("route"),
  adverseReaction: text("adverse_reaction"),
  reminderSent: integer("reminder_sent", { mode: "boolean" }).$defaultFn(() => false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==========================================
// Pharmacy Schedule H1 & Narcotics Register
// ==========================================

export const scheduleH1Register = sqliteTable("schedule_h1_register", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dispenseDate: integer("dispense_date", { mode: "timestamp" }).$defaultFn(() => new Date()),
  patientId: integer("patient_id").references(() => patients.id),
  patientName: text("patient_name").notNull(),
  patientContact: text("patient_contact").notNull(),
  patientAddress: text("patient_address"),
  prescribingDoctorName: text("prescribing_doctor_name").notNull(),
  prescribingDoctorRegNo: text("prescribing_doctor_reg_no").notNull(),
  drugName: text("drug_name").notNull(),
  batchNumber: text("batch_number").notNull(),
  expiryDate: text("expiry_date").notNull(),
  quantityDispensed: real("quantity_dispensed").notNull(),
  unit: text("unit").notNull().default("TABLETS"),
  dispensedByPharmacist: text("dispensed_by_pharmacist").notNull(),
  prescriptionRef: text("prescription_ref"),
  verifiedSeal: text("verified_seal").notNull(), // Tamper-evident HMAC signature
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==========================================
// Visual Hospital Wards & Beds
// ==========================================

export const hospitalWards = sqliteTable("hospital_wards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  floor: text("floor").notNull(),
  type: text("type").notNull().default("GENERAL"), // 'GENERAL' | 'SEMI_PRIVATE' | 'PRIVATE' | 'ICU' | 'EMERGENCY' | 'NICU' | 'POST_OP'
  totalBeds: integer("total_beds").notNull().default(0),
  occupiedBeds: integer("occupied_beds").notNull().default(0),
  nurseInCharge: text("nurse_in_charge"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const hospitalBeds = sqliteTable("hospital_beds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wardId: integer("ward_id").notNull().references(() => hospitalWards.id),
  wardName: text("ward_name").notNull(),
  bedNumber: text("bed_number").notNull(),
  type: text("type").notNull().default("GENERAL"),
  status: text("status").notNull().default("VACANT"), // 'VACANT' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'RESERVED'
  hasOxygen: integer("has_oxygen", { mode: "boolean" }).$defaultFn(() => true),
  hasVentilator: integer("has_ventilator", { mode: "boolean" }).$defaultFn(() => false),
  hasMonitor: integer("has_monitor", { mode: "boolean" }).$defaultFn(() => false),
  dailyRate: real("daily_rate").notNull().default(1000.00),
  currentAdmissionId: integer("current_admission_id").references(() => ipdAdmissions.id),
  patientName: text("patient_name"),
  patientRegNo: text("patient_reg_no"),
  admittedAt: integer("admitted_at", { mode: "timestamp" }),
  attendingDoctor: text("attending_doctor"),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==========================================
// OT Suite WHO Surgical Safety & PAC
// ==========================================

export const whoSurgicalChecklists = sqliteTable("who_surgical_checklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id").notNull().references(() => ipdAdmissions.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  surgeryName: text("surgery_name").notNull(),
  otNumber: text("ot_number").notNull().default("OT-1"),
  operatingSurgeon: text("operating_surgeon").notNull(),
  anesthesiologist: text("anesthesiologist").notNull(),
  scrubNurse: text("scrub_nurse").notNull(),
  
  // Phase 1: Sign In
  signInPatientConfirmed: integer("sign_in_patient_confirmed", { mode: "boolean" }).notNull(),
  signInSiteMarked: integer("sign_in_site_marked", { mode: "boolean" }).notNull(),
  signInAnesthesiaSafetyCheck: integer("sign_in_anesthesia_safety_check", { mode: "boolean" }).notNull(),
  signInPulseOximeterActive: integer("sign_in_pulse_oximeter_active", { mode: "boolean" }).notNull(),
  signInAllergyConfirmed: integer("sign_in_allergy_confirmed", { mode: "boolean" }).notNull(),
  signInDifficultAirwayRisk: integer("sign_in_difficult_airway_risk", { mode: "boolean" }).notNull(),
  signInAspirationRisk: integer("sign_in_aspiration_risk", { mode: "boolean" }).notNull(),
  signInBloodLossRiskEstimatedMl: integer("sign_in_blood_loss_risk_estimated_ml").default(0),
  signInCompletedAt: integer("sign_in_completed_at", { mode: "timestamp" }),
  signInSignedBy: text("sign_in_signed_by"),

  // Phase 2: Time Out
  timeOutTeamIntroduced: integer("time_out_team_introduced", { mode: "boolean" }).notNull(),
  timeOutPatientIdentified: integer("time_out_patient_identified", { mode: "boolean" }).notNull(),
  timeOutProcedureConfirmed: integer("time_out_procedure_confirmed", { mode: "boolean" }).notNull(),
  timeOutIncisionSiteConfirmed: integer("time_out_incision_site_confirmed", { mode: "boolean" }).notNull(),
  timeOutAntibioticProphylaxisGiven: integer("time_out_antibiotic_prophylaxis_given", { mode: "boolean" }).notNull(),
  timeOutAntibioticName: text("time_out_antibiotic_name"),
  timeOutAnticipatedSurgeonNotes: text("time_out_anticipated_surgeon_notes"),
  timeOutAnticipatedAnesthesiaNotes: text("time_out_anticipated_anesthesia_notes"),
  timeOutSterilityConfirmed: integer("time_out_sterility_confirmed", { mode: "boolean" }).notNull(),
  timeOutImagingDisplayed: integer("time_out_imaging_displayed", { mode: "boolean" }).notNull(),
  timeOutCompletedAt: integer("time_out_completed_at", { mode: "timestamp" }),
  timeOutSignedBy: text("time_out_signed_by"),

  // Phase 3: Sign Out
  signOutNurseVerballyConfirmed: integer("sign_out_nurse_verbally_confirmed", { mode: "boolean" }).notNull(),
  signOutInstrumentCountCorrect: integer("sign_out_instrument_count_correct", { mode: "boolean" }).notNull(),
  signOutSpongeNeedleCountCorrect: integer("sign_out_sponge_needle_count_correct", { mode: "boolean" }).notNull(),
  signOutSpecimenLabeledAccurately: integer("sign_out_specimen_labeled_accurately", { mode: "boolean" }).notNull(),
  signOutEquipmentIssuesAddressed: text("sign_out_equipment_issues_addressed"),
  signOutRecoveryPlanSurgeonNotes: text("sign_out_recovery_plan_surgeon_notes"),
  signOutRecoveryPlanAnesthesiaNotes: text("sign_out_recovery_plan_anesthesia_notes"),
  signOutCompletedAt: integer("sign_out_completed_at", { mode: "timestamp" }),
  signOutSignedBy: text("sign_out_signed_by"),

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const pacRecords = sqliteTable("pac_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id").notNull().references(() => ipdAdmissions.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  evaluationDate: integer("evaluation_date", { mode: "timestamp" }).$defaultFn(() => new Date()),
  asaClass: text("asa_class").notNull().default("ASA_I"),
  mallampatiScore: integer("mallampati_score").notNull().default(1),
  airwayEvaluation: text("airway_evaluation").notNull(),
  cardiovascularNotes: text("cardiovascular_notes"),
  respiratoryNotes: text("respiratory_notes"),
  investigationsReviewed: text("investigations_reviewed").notNull(),
  plannedAnesthesiaType: text("planned_anesthesia_type").notNull().default("GENERAL"),
  npoStatusHours: integer("npo_status_hours").notNull().default(6),
  premedicationOrders: text("premedication_orders"),
  anesthesiologistName: text("anesthesiologist_name").notNull(),
  fitnessStatus: text("fitness_status").notNull().default("FIT"),
  signedSeal: text("signed_seal"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==========================================
// NABH Crash Cart Emergency Audit Log
// ==========================================

export const crashCartAudits = sqliteTable("crash_cart_audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auditDate: integer("audit_date", { mode: "timestamp" }).$defaultFn(() => new Date()),
  shift: text("shift").notNull().default("MORNING"), // 'MORNING' | 'EVENING' | 'NIGHT'
  cartLocation: text("cart_location").notNull(), // 'ICU' | 'EMERGENCY' | 'OT' | 'WARD_3'
  sealNumber: text("seal_number").notNull(),
  sealIntact: integer("seal_intact", { mode: "boolean" }).notNull().$defaultFn(() => true),
  defibrillatorTestPassed: integer("defibrillator_test_passed", { mode: "boolean" }).notNull().$defaultFn(() => true),
  laryngoscopeBladesTested: integer("laryngoscope_blades_tested", { mode: "boolean" }).notNull().$defaultFn(() => true),
  suctionMachineTested: integer("suction_machine_tested", { mode: "boolean" }).notNull().$defaultFn(() => true),
  oxygenCylinderPressurePsi: integer("oxygen_cylinder_pressure_psi").notNull().default(2000),
  ambubagTested: integer("ambubag_tested", { mode: "boolean" }).notNull().$defaultFn(() => true),
  expiredDrugsFound: integer("expired_drugs_found", { mode: "boolean" }).notNull().$defaultFn(() => false),
  expiredDrugsDetails: text("expired_drugs_details"),
  missingItemsReported: text("missing_items_reported"),
  auditedByNurse: text("audited_by_nurse").notNull(),
  verifiedByDoctor: text("verified_by_doctor"),
  status: text("status").notNull().default("VERIFIED_READY"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==========================================
// Medical Specialist Referral Letters
// ==========================================

export const specialistReferralLetters = sqliteTable("specialist_referral_letters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  patientName: text("patient_name").notNull(),
  patientAgeGender: text("patient_age_gender").notNull(),
  patientPhone: text("patient_phone"),
  referralDate: integer("referral_date", { mode: "timestamp" }).$defaultFn(() => new Date()),
  urgency: text("urgency").notNull().default("ROUTINE"), // 'ROUTINE' | 'URGENT' | 'EMERGENCY'
  referringDoctorName: text("referring_doctor_name").notNull(),
  referringDoctorRegNo: text("referring_doctor_reg_no").notNull(),
  targetSpecialty: text("target_specialty").notNull(),
  targetHospitalOrDoctor: text("target_hospital_or_doctor").notNull(),
  provisionalDiagnosis: text("provisional_diagnosis").notNull(),
  clinicalSummary: text("clinical_summary").notNull(),
  vitalSigns: text("vital_signs").notNull(),
  currentMedications: text("current_medications").notNull(),
  relevantInvestigations: text("relevant_investigations").notNull(),
  reasonForReferral: text("reason_for_referral").notNull(),
  digitalSeal: text("digital_seal").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});


