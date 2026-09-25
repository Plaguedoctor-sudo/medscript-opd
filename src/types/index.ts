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
}

