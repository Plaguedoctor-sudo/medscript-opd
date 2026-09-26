export interface Patient {
  id: number;
  regNo?: string | null;
  name: string;
  age: number;
  gender: string;
  phone: string | null;
  abhaId: string | null;
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
  bp: string | null;
  pulse: string | null;
  temp: string | null;
  spo2: string | null;
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
}

export type InvoiceItemCategory = 'Consultation' | 'Medication' | 'Procedure' | 'Lab Test' | 'Other';

export interface InvoiceItem {
  id: string;
  description: string;
  category: InvoiceItemCategory;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  patientId: number;
  prescriptionId?: number | null;
  items: string; // JSON string of InvoiceItem[]
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Due' | string;
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED' | string;
  notes?: string | null;
  createdAt: Date | null;
}

export interface InvoiceWithPatient extends Invoice {
  patient: Patient;
}

