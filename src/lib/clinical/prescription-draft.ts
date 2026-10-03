/**
 * Prescription Crash-Resilience Auto-Draft Engine
 * Protects doctor consultation workflow against accidental browser tab closure, network loss, or power outages.
 */

export interface PrescriptionDraftData {
  patientId: number;
  patientName: string;
  savedAt: number;
  chiefComplaints?: string;
  clinicalHistory?: string;
  diagnosis?: string;
  vitals?: Record<string, string>;
  medications?: any[];
  advice?: string;
  labTests?: any[];
  followUpDate?: string;
}

const DRAFT_KEY_PREFIX = 'medscript_rx_draft_patient_';
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function savePrescriptionDraft(draft: PrescriptionDraftData): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DRAFT_KEY_PREFIX}${draft.patientId}`;
    draft.savedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {}
}

export function loadPrescriptionDraft(patientId: number): PrescriptionDraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${DRAFT_KEY_PREFIX}${patientId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const draft = JSON.parse(raw) as PrescriptionDraftData;
    if (Date.now() - draft.savedAt > MAX_DRAFT_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

export function clearPrescriptionDraft(patientId: number): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DRAFT_KEY_PREFIX}${patientId}`;
    localStorage.removeItem(key);
  } catch {}
}
