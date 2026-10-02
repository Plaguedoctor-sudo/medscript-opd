export interface Patient {
  id: number;
  regNo?: string | null;
  name: string;
  age: number;
  gender: string;
  phone: string | null;
  abhaId: string | null;
  abhaAddress?: string | null;
  allergies?: string | null; // e.g. "Penicillins, Sulfa, Paracetamol"
  bloodGroup?: string | null; // e.g. "O+", "B+", "A+", "AB-"
  createdAt: Date | null;
}

export interface Medication {
  prefix?: string; // e.g. "Tab.", "Cap.", "Syr.", "Inj.", "Oint.", "Drops", "Inh."
  name: string; // Brand Name (or drug name)
  genericName?: string; // Generic composition / Molecule
  strength: string;
  dosage: string;
  timing: string;
  duration: string;
  instruction?: string;
}

export interface Prescription {
  id: number;
  patientId: number;
  weight: string | null;
  height?: string | null; // in cm
  bmi?: string | null;
  bp: string | null;
  pulse: string | null;
  temp: string | null;
  spo2: string | null;
  rbs?: string | null; // Blood sugar mg/dL
  respiratoryRate?: string | null; // breaths/min
  doctorId?: number | null;
  doctorName?: string | null;
  chiefComplaints: string | null;
  clinicalHistory: string | null;
  diagnosis: string | null;
  medications: string; // JSON string of Medication[]
  advice: string | null;
  labTests: string | null;
  followUpDate: string | null;
  signatureHash?: string | null;
  createdAt: Date | null;
}

export interface PrescriptionWithPatient extends Prescription {
  patient: Patient;
}

export interface ClinicSettings {
  id: number;
  doctorName: string;
  qualifications: string;
  regNumber: string;
  clinicName: string;
  address: string;
  contact: string;
  logoUrl?: string | null;
  pinHash?: string | null;
  staffPinHash?: string | null;
  rbacEnabled?: boolean | null;
  securityEnabled?: boolean | null;
  autoLockMinutes?: number | null;
  mfaEnabled?: boolean | null;
  mfaSecret?: string | null;
  mfaBackupCodes?: string | null;
  pinUpdatedAt?: Date | null;
  rotationDays?: number | null;
  minPinLength?: number | null;
  enforceComplexity?: boolean | null;
  sessionSecret?: string | null;
  lockdownActive?: boolean | null;
  lockdownReason?: string | null;
  lockdownTriggeredAt?: Date | null;
  deceptionModeActive?: boolean | null;
  upiId?: string | null;
  gstNumber?: string | null;
  whatsappCloudToken?: string | null;
  whatsappPhoneNumberId?: string | null;
  cloudSyncProvider?: string | null;
  cloudSyncEndpoint?: string | null;
  cloudSyncApiKey?: string | null;
  defconLevel?: number | null;
  militaryModeEnabled?: boolean | null;
  ipQuarantineEnabled?: boolean | null;
  lastIntegritySweepAt?: Date | null;
  lastIntegrityStatus?: string | null;
}

export type SafeClinicSettings = Omit<
  ClinicSettings,
  'pinHash' | 'staffPinHash' | 'mfaSecret' | 'mfaBackupCodes' | 'sessionSecret' | 'whatsappCloudToken' | 'cloudSyncApiKey'
> & {
  hasWhatsappToken?: boolean;
  hasCloudSyncKey?: boolean;
};

export type InvoiceItemCategory = 'Consultation' | 'Medication' | 'Procedure' | 'Lab Test' | 'Other';

export interface InvoiceItem {
  id: string;
  description: string;
  category: InvoiceItemCategory;
  quantity: number;
  unitPrice: number;
  total: number;
  gstRate?: number; // 0, 5, 12, 18
  cgst?: number;
  sgst?: number;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  patientId: number;
  prescriptionId?: number | null;
  admissionId?: number | null;
  items: string; // JSON string of InvoiceItem[]
  subtotal: number;
  discount: number;
  tax: number;
  cgst?: number | null;
  sgst?: number | null;
  totalAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Due' | string;
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED' | string;
  notes?: string | null;
  createdAt: Date | null;
}

export interface InvoiceWithPatient extends Invoice {
  patient: Patient;
}

export interface IpdBillingBreakdown {
  admissionId: number;
  patientId: number;
  admissionNo: string;
  ward: string;
  roomType: string;
  bedNo: string;
  admissionDate: Date;
  dischargeDate: Date | null;
  lengthOfStayDays: number;
  bedTariffPerDay: number;
  bedChargesTotal: number;
  nursingCarePerDay: number;
  nursingChargesTotal: number;
  doctorRoundRate: number;
  doctorRoundsCount: number;
  doctorRoundsTotal: number;
  clinicalServicesTotal: number;
  labTestsTotal: number;
  grossTotal: number;
  totalDepositsPaid: number;
  netPayable: number;
  refundDue: number;
  suggestedItems: InvoiceItem[];
  deposits: IpdDeposit[];
  existingInvoice?: Invoice | null;
}

export type IpdAdmissionStatus = 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED';
export type IpdDischargeCondition = 'Stable' | 'Recovered' | 'Referred' | 'LAMA' | 'Deceased' | string;

export interface IpdVitals {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
  rbs?: string;
}

export interface IpdAdmission {
  id: number;
  admissionNo: string;
  patientId: number;
  admissionDate: Date;
  dischargeDate?: Date | null;
  status: IpdAdmissionStatus;
  ward: string;
  bedNo: string;
  roomType?: string | null;
  attendingDoctor?: string | null;
  admittingDiagnosis?: string | null;
  chiefComplaints?: string | null;
  admissionVitals?: string | null; // JSON string of IpdVitals
  dischargeCondition?: IpdDischargeCondition | null;
  dischargeSummary?: string | null;
  dischargeAdvice?: string | null;
  createdAt: Date | null;
}

export interface IpdAdmissionWithPatient extends IpdAdmission {
  patient: Patient;
  rounds?: IpdRound[];
  labReports?: LabReport[];
}

export interface IpdRound {
  id: number;
  admissionId: number;
  roundDate: Date;
  doctorOrStaff: string;
  role: 'DOCTOR' | 'NURSE' | 'STAFF' | string;
  notes: string;
  treatmentOrders?: string | null;
  vitals?: string | null; // JSON string of IpdVitals
  createdAt: Date | null;
}

export type LabReportStatus = 'PENDING' | 'SAMPLE_COLLECTED' | 'COMPLETED' | 'CANCELLED';
export type LabResultFlag = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL' | 'ABNORMAL';

export interface LabResultParameter {
  id?: string;
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag?: LabResultFlag;
  notes?: string;
}

export interface LabReport {
  id: number;
  reportNo: string;
  patientId: number;
  prescriptionId?: number | null;
  ipdAdmissionId?: number | null;
  testName: string;
  category: string;
  sampleType?: string | null;
  sampleCollectedAt?: Date | null;
  reportedAt?: Date | null;
  status: LabReportStatus;
  referredBy?: string | null;
  technicianName?: string | null;
  results: string; // JSON string of LabResultParameter[]
  interpretation?: string | null;
  notes?: string | null;
  createdAt: Date | null;
}

export interface LabReportWithPatient extends LabReport {
  patient: Patient;
  prescription?: Prescription | null;
  admission?: IpdAdmission | null;
}

export type UserRole =
  | 'admin_doctor'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'lab_technician'
  | 'pharmacist'
  | 'manager';

export interface StaffUser {
  id: number;
  loginId: string;
  name: string;
  role: UserRole;
  subRole?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  qualifications?: string | null;
  regNumber?: string | null;
  isActive: boolean;
  passwordUpdatedAt?: number | null;
  lastLoginAt?: Date | null;
  createdAt?: Date | null;
}

export type SafeStaffUser = Omit<StaffUser, 'passwordHash'>;

// Pharmacy & Inventory
export type MedicineCategory = 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'IV Fluid' | 'Ointment' | 'Drops' | 'Inhaler' | 'Surgical Consumable' | 'Other';

export interface PharmacyInventoryItem {
  id: number;
  medicineName: string;
  brandName?: string | null;
  category: MedicineCategory | string;
  batchNo: string;
  expiryDate: string; // YYYY-MM-DD
  quantityInStock: number;
  minThreshold: number;
  purchaseCost: number;
  mrp: number;
  sellingPrice: number;
  rackLocation?: string | null;
  supplierName?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

export interface PharmacyTransaction {
  id: number;
  inventoryId: number;
  type: 'INWARD' | 'DISPENSED' | 'ADJUSTMENT' | 'EXPIRED';
  quantity: number;
  patientId?: number | null;
  prescriptionId?: number | null;
  admissionId?: number | null;
  remarks?: string | null;
  createdAt: Date | null;
}

// Pharmacist Dispensation Records
export interface DispensedItem {
  medicationName: string;
  strength?: string;
  dosage?: string;
  duration?: string;
  quantityDispensed: number;
  batchNo?: string;
  instructions?: string;
}

export interface PrescriptionDispensation {
  id: number;
  prescriptionId?: number | null;
  admissionId?: number | null;
  patientId?: number | null;
  dispensationType: 'OPD_PRESCRIPTION' | 'IPD_ROUND_MEDICATION';
  dispensedBy: string;
  dispensedByUserId?: number | null;
  items: DispensedItem[];
  status: 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'READY_FOR_PICKUP';
  remarks?: string | null;
  dispensedAt: Date;
  createdAt?: Date | null;
}

// Hospital Manager: Assets, Consumables, Servicing, Procurement & Department Dispatch
export type HospitalAssetCategory =
  | 'SURGICAL_INSTRUMENT'
  | 'CLEANING_AGENT'
  | 'TOILETRIES'
  | 'LINEN_BEDSHEET'
  | 'GENERAL_CONSUMABLE';

export type AssetMaintenanceStatus =
  | 'OPERATIONAL'
  | 'UNDER_MAINTENANCE'
  | 'CALIBRATION_DUE'
  | 'OUT_OF_SERVICE'
  | 'NOT_APPLICABLE';

export interface HospitalAssetItem {
  id: number;
  name: string;
  category: HospitalAssetCategory;
  specification?: string | null;
  quantityInStock: number;
  unit: string; // e.g. "sets", "pieces", "liters", "bottles", "packs", "boxes"
  minThreshold: number;
  location?: string | null;
  purchaseCost: number;
  supplierName?: string | null;
  maintenanceStatus: AssetMaintenanceStatus;
  lastServiceDate?: string | null; // YYYY-MM-DD
  nextServiceDue?: string | null; // YYYY-MM-DD
  serviceVendor?: string | null;
  serviceVendorPhone?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

export type AssetServiceType = 'PREVENTIVE' | 'BREAKDOWN' | 'CALIBRATION' | 'AMC_VISIT' | 'SHARPENING';

export interface HospitalServiceLog {
  id: number;
  assetId: number;
  assetName?: string;
  serviceDate: string; // YYYY-MM-DD
  serviceType: AssetServiceType;
  technicianName?: string | null;
  vendorName?: string | null;
  cost: number;
  workDescription: string;
  partsReplaced?: string | null;
  nextDueDate?: string | null;
  status: 'COMPLETED' | 'PENDING_PARTS' | 'SCHEDULED';
  loggedBy?: string | null;
  createdAt: Date | null;
}

export interface ProcurementOrderItem {
  name: string;
  category: HospitalAssetCategory | string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface HospitalProcurementOrder {
  id: number;
  orderNo: string;
  vendorName: string;
  category: HospitalAssetCategory | string;
  items: ProcurementOrderItem[];
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  receivedDate?: string | null;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  orderedBy?: string | null;
  notes?: string | null;
  createdAt: Date | null;
}

export type HospitalTargetDepartment =
  | 'OPERATION_THEATRE'
  | 'ICU'
  | 'IPD_WARD'
  | 'OPD'
  | 'EMERGENCY'
  | 'LAB'
  | 'DIALYSIS'
  | 'GENERAL';

export interface HospitalDepartmentDispatch {
  id: number;
  dispatchNo: string;
  assetId?: number | null;
  assetName: string;
  category: HospitalAssetCategory | string;
  quantity: number;
  unit: string;
  targetDepartment: HospitalTargetDepartment | string;
  recipientStaff: string;
  dispatchedBy: string;
  dispatchDate: string;
  remarks?: string | null;
  createdAt: Date | null;
}

// OPD Appointments & Token Queue
export type AppointmentStatus = 'SCHEDULED' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentType = 'OPD_CONSULTATION' | 'FOLLOW_UP' | 'EMERGENCY' | 'VACCINATION';

export interface Appointment {
  id: number;
  tokenNo: number;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot?: string | null;
  patientId: number;
  doctorId?: number | null;
  doctorName?: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  chiefComplaint?: string | null;
  notes?: string | null;
  createdAt: Date | null;
}

export interface AppointmentWithPatient extends Appointment {
  patient: Patient;
}

// Inpatient Nurse eMAR
export type EmarStatus = 'PENDING' | 'GIVEN' | 'WITHHELD' | 'REFUSED';

export interface EmarRecord {
  id: number;
  admissionId: number;
  medicationName: string;
  dosage: string;
  route?: string | null; // Oral, IV, IM, SC, Topical, Nebulization
  scheduledTime: Date;
  administeredAt?: Date | null;
  status: EmarStatus;
  nurseName?: string | null;
  prescribedBy?: string | null;
  notes?: string | null;
  createdAt: Date | null;
}

// Clinical Consents & Digital Signature
export type ConsentType = 'GENERAL_ADMISSION' | 'SURGICAL_PROCEDURE' | 'HIGH_RISK' | 'DISCHARGE_LAMA' | 'DATA_SHARING_ABDM';

export interface ClinicalConsent {
  id: number;
  patientId: number;
  admissionId?: number | null;
  consentType: ConsentType;
  title: string;
  content: string;
  patientSignature?: string | null; // Base64 data URL png
  signedByName: string;
  relationship: string; // 'Self', 'Spouse', 'Parent', 'Child', 'Guardian'
  witnessName?: string | null;
  doctorSignature?: string | null;
  signedAt?: Date | null;
  ipAddress?: string | null;
  createdAt: Date | null;
}

// IPD Deposits & Advance Payments
export interface IpdDeposit {
  id: number;
  admissionId: number;
  patientId: number;
  receiptNo: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | string;
  transactionRef?: string | null;
  type: 'ADVANCE' | 'TOP_UP' | 'REFUND';
  notes?: string | null;
  collectedBy?: string | null;
  createdAt: Date | null;
}

// Google Drive Cloud Backup Config
export interface GoogleDriveBackupConfig {
  enabled: boolean;
  folderId?: string;
  clientEmail?: string;
  hasPrivateKey?: boolean;
  lastBackupAt?: Date | null;
  lastBackupStatus?: 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS' | string | null;
  lastBackupFileId?: string | null;
  lastBackupFileName?: string | null;
  autoBackupInterval?: 'DAILY' | 'TWICE_DAILY' | 'MANUAL';
}

// Inpatient Nurse Fluid Balance & Input/Output Chart
export type FluidEntryType = 'INTAKE' | 'OUTPUT';
export type FluidRoute =
  | 'IV_INFUSION'
  | 'ORAL'
  | 'RT_FEED'
  | 'BLOOD'
  | 'MEDICATION_DILUTION'
  | 'URINE'
  | 'VOMIT'
  | 'DRAIN'
  | 'STOOL'
  | 'OTHER';
export type FluidShift = 'MORNING' | 'EVENING' | 'NIGHT';

export interface FluidBalanceRecord {
  id: number;
  admissionId: number;
  entryType: FluidEntryType;
  route: FluidRoute | string;
  fluidName: string;
  volumeMl: number;
  shift: FluidShift | string;
  recordedAt: Date;
  nurseName: string;
  role?: string | null;
  appearance?: string | null;
  notes?: string | null;
  createdAt?: Date | null;
}

export interface PrescriptionTemplate {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  chiefComplaints?: string | null;
  diagnosis?: string | null;
  medications: string; // JSON string of Medication[]
  advice?: string | null;
  labTests?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
}

export type PatientDocumentType =
  | 'LAB_REPORT'
  | 'IMAGING_XRAY'
  | 'ECG'
  | 'CLINICAL_PHOTO'
  | 'REFERRAL'
  | 'OTHER';

export interface PatientDocument {
  id: number;
  patientId: number;
  prescriptionId?: number | null;
  title: string;
  documentType: PatientDocumentType;
  fileData: string; // Base64 data URL or storage URI
  fileName?: string | null;
  fileSizeKb?: number | null;
  mimeType?: string | null;
  notes?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: Date | null;
}

export type MedicalCertificateType = 'FITNESS' | 'LEAVE' | 'REFERRAL';

export interface MedicalCertificate {
  id: number;
  certificateNo: string;
  patientId: number;
  doctorId?: number | null;
  doctorName: string;
  doctorRegNo?: string | null;
  type: MedicalCertificateType;
  diagnosis?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  restDays?: number | null;
  referralHospital?: string | null;
  referralSpecialist?: string | null;
  remarks?: string | null;
  digitalSealHash?: string | null;
  issuedAt?: Date | null;
}

export interface IpdDischarge {
  id: number;
  admissionId: number;
  patientId: number;
  dischargeDate: string;
  dischargeTime?: string | null;
  dischargeCondition: 'Recovered' | 'Improved' | 'Stable' | 'LAMA' | 'Referred' | 'Deceased' | string;
  admissionDiagnosis?: string | null;
  finalDiagnosis: string;
  clinicalSummary: string;
  investigationSummary?: string | null;
  proceduresPerformed?: string | null;
  dischargeVitals?: string | null; // JSON string { bp, pulse, temp, spo2, rr }
  dischargeMedications: string; // JSON Medication[]
  dietAdvice?: string | null;
  activityRestrictions?: string | null;
  followUpDate?: string | null;
  followUpInstructions?: string | null;
  urgentWarningSigns?: string | null;
  consultantDoctorName: string;
  doctorRegNo?: string | null;
  digitalSealHash?: string | null;
  createdAt?: Date | null;
}

export interface IpdNursingNote {
  id: number;
  admissionId: number;
  patientId: number;
  shift: 'Morning' | 'Evening' | 'Night' | string;
  shiftDate: string;
  nurseName: string;
  observations: string;
  vitalsSummary?: string | null;
  handoverNotes?: string | null;
  createdAt?: Date | null;
}

export type IpdHandoverType = 'NURSING_SHIFT' | 'DOCTOR_ROUND';

export interface IpdHandover {
  id: number;
  admissionId: number;
  patientId: number;
  handoverType: IpdHandoverType | string;
  shift: string;
  handoverDate: Date;
  outgoingStaffName: string;
  outgoingStaffRole: 'DOCTOR' | 'NURSE' | string;
  incomingStaffName: string;
  patientCondition: string;
  vitalsSummary?: string | null;
  summaryNotes: string;
  activeTreatmentOrders?: string | null;
  pendingTasks?: string | null;
  specialPrecautions?: string | null;
  createdAt?: Date | null;
}

export type ClinicalServiceType =
  | 'OXYGEN_THERAPY'
  | 'SUCTIONING'
  | 'DRAINAGE_CARE'
  | 'NEBULIZATION'
  | 'CATHETER_CARE'
  | 'WOUND_DRESSING'
  | 'OTHER';

export interface IpdClinicalService {
  id: number;
  admissionId: number;
  patientId: number;
  serviceType: ClinicalServiceType | string;
  serviceName: string;
  performedAt: Date;
  nurseName: string;
  attendingDoctorName: string;
  flowRateOrDetails?: string | null;
  observations?: string | null;
  status: 'COMPLETED' | 'ONGOING' | 'DISCONTINUED' | string;
  createdAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Military Level Security & Defensive Cyber Operations Types
// ---------------------------------------------------------------------------

export type DefconLevel = 1 | 2 | 3 | 4 | 5;

export interface QuarantinedIpRecord {
  id: number;
  ipAddress: string;
  reason: string;
  violationCount: number;
  quarantinedAt: Date;
  expiresAt?: Date | null;
  pardonedAt?: Date | null;
  pardonedBy?: string | null;
}

export interface DefconThreatStatus {
  level: DefconLevel;
  title: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  threatScore: number;
  indicators: string[];
  recommendation: string;
  quarantineCount: number;
  lockdownActive: boolean;
  deceptionActive: boolean;
}

export interface FleetIntegrityItem {
  artifactType: 'PRESCRIPTION' | 'LAB_REPORT' | 'EMAR_RECORD' | 'IPD_HANDOVER' | 'AUDIT_LOG_CHAIN' | 'MEDICAL_CERTIFICATE';
  totalChecked: number;
  validCount: number;
  tamperedCount: number;
  tamperedRecords: Array<{ id: number | string; identifier: string; reason: string }>;
}

export interface FleetIntegrityReport {
  sweepCompletedAt: string;
  overallIntact: boolean;
  totalArtifactsChecked: number;
  totalTamperedCount: number;
  chainRootHash: string;
  sections: FleetIntegrityItem[];
}

export interface ThreatHuntingFinding {
  id: string;
  category: 'AUDIT_GAP' | 'SESSION_ANOMALY' | 'UNSEALED_RECORD' | 'OFF_HOURS_ACTIVITY' | 'RATE_LIMIT_SPIKE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  evidence: string;
  mitigation: string;
}

export interface ThreatHuntingReport {
  scannedAt: string;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  cleanStatus: boolean;
  findings: ThreatHuntingFinding[];
}

// ── Hospital CCTV & Facility Surveillance ──────────────────────────────────
export type CctvZone =
  | 'ICU'
  | 'EMERGENCY'
  | 'OT'
  | 'IPD_WARD'
  | 'PHARMACY'
  | 'OPD_RECEPTION'
  | 'STORES_ASSETS'
  | 'PERIMETER';

export type CctvCameraStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

export interface CctvCamera {
  id: number;
  name: string;
  zone: CctvZone;
  location: string;
  streamUrl: string;
  status: CctvCameraStatus;
  resolution: string;
  fps: number;
  hasPtz: boolean;
  privacyMasking: boolean;
  motionDetectionEnabled: boolean;
  ipAddress?: string | null;
  lastPingAt?: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type CctvIncidentType =
  | 'PATIENT_FALL_RISK'
  | 'UNAUTHORIZED_ENTRY'
  | 'AFTER_HOURS_MOTION'
  | 'QUEUE_OVERFLOW'
  | 'EQUIPMENT_TAMPER'
  | 'MANUAL_SECURITY_FLAG';

export type CctvIncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CctvIncident {
  id: number;
  cameraId?: number | null;
  cameraName: string;
  zone: CctvZone | string;
  incidentType: CctvIncidentType;
  severity: CctvIncidentSeverity;
  description: string;
  snapshotUrl?: string | null;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  notes?: string | null;
  createdAt: Date | null;
}

export type CctvTriggerType = 'CONTINUOUS' | 'MOTION' | 'INCIDENT' | 'MANUAL';

export interface CctvRecording {
  id: number;
  cameraId: number;
  cameraName: string;
  zone: CctvZone;
  filename: string;
  filePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  startTime: Date;
  endTime: Date;
  triggerType: CctvTriggerType;
  incidentId?: number | null;
  isLocked: boolean;
  lockReason?: string | null;
  checksumSha256: string;
  thumbnailData?: string | null;
  createdAt: Date | null;
}

export interface CctvStorageStats {
  totalRecordings: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  maxStorageGb: number;
  usedPercentage: number;
  retentionDays: number;
  oldestRecordingAt?: Date | null;
  newestRecordingAt?: Date | null;
  lockedRecordingsCount: number;
  lockedRecordingsSizeFormatted: string;
  autoPurgeEnabled: boolean;
  zoneBreakdown: Record<string, { count: number; sizeBytes: number; sizeFormatted: string }>;
  triggerBreakdown: Record<CctvTriggerType, number>;
}



