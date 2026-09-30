'use server';

import { db, sqlite } from '@/db';
import { patientDocuments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requirePermission, getCurrentUser, getCurrentUserRole, isDoctor } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { PatientDocument, PatientDocumentType } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getPatientDocumentsAction(patientId: number): Promise<PatientDocument[]> {
  await requirePermission('document:upload');
  const rows = await db
    .select()
    .from(patientDocuments)
    .where(eq(patientDocuments.patientId, patientId))
    .orderBy(desc(patientDocuments.uploadedAt));

  return rows as PatientDocument[];
}

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_EXTENSIONS,
  sanitizeDocumentFileName,
  verifyDocumentMagicBytes,
} from '@/lib/document-security';

export async function uploadPatientDocumentAction(params: {
  patientId: number;
  prescriptionId?: number | null;
  title: string;
  documentType: PatientDocumentType;
  fileData: string; // Base64 data URL
  fileName?: string;
  fileSizeKb?: number;
  mimeType?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('document:upload');
  const user = await getCurrentUser();
  const uploadedBy = user ? `${user.name} (${user.role})` : 'Staff';

  if (!params.patientId || !params.title || !params.fileData) {
    return { success: false, error: 'Patient ID, title, and document file are required.' };
  }

  // Insider Threat Safeguard 1: Limit document payload to 5MB (Base64 length ~7MB) to prevent disk exhaustion and DoS
  const MAX_BASE64_LENGTH = 7 * 1024 * 1024;
  if (params.fileData.length > MAX_BASE64_LENGTH || (params.fileSizeKb && params.fileSizeKb > 5120)) {
    return {
      success: false,
      error: 'File size exceeds the 5MB maximum limit. Please compress or optimize the document before uploading.',
    };
  }

  // Insider Threat Safeguard 2: Limit maximum number of documents per patient record (50) to prevent SQLite storage bloat
  const docCount = sqlite
    .prepare('SELECT COUNT(*) as count FROM patient_documents WHERE patient_id = ?')
    .get(params.patientId) as { count: number } | undefined;
  if (docCount && docCount.count >= 50) {
    return {
      success: false,
      error: 'Maximum document limit (50 documents) reached for this patient record. Please archive or delete older documents before adding new ones.',
    };
  }

  // Insider Threat Safeguard 3: Strict Data URL & MIME validation (Defends against SVG XSS, HTML, Executables)
  const dataUrlMatch = params.fileData.match(/^data:([a-zA-Z0-9_\-\/]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!dataUrlMatch) {
    return {
      success: false,
      error: 'Invalid file payload: must be a well-formed base64 Data URL.',
    };
  }

  const detectedMime = dataUrlMatch[1].toLowerCase();
  const rawBase64 = dataUrlMatch[2];

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(detectedMime)) {
    await logAuditEvent({
      action: 'SECURITY_ALERT_TRIGGERED',
      actorRole: user?.role?.toUpperCase() || 'STAFF',
      details: `Blocked upload of prohibited MIME type '${detectedMime}' by ${uploadedBy} for Patient ID #${params.patientId}`,
      status: 'FAILURE',
    });
    return {
      success: false,
      error: `Prohibited file type '${detectedMime}'. Only clinical PDF documents and medical images (JPG, PNG, WebP) are allowed.`,
    };
  }

  // Insider Threat Safeguard 4: File extension matching
  const safeFileName = sanitizeDocumentFileName(params.fileName);
  if (params.fileName) {
    const extMatch = params.fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    if (!ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
      return {
        success: false,
        error: `Prohibited file extension '.${ext}'. Allowed extensions are .pdf, .jpg, .jpeg, .png, .webp.`,
      };
    }
  }

  // Insider Threat Safeguard 5: Magic binary bytes verification to block file masquerading / stealth payloads
  if (!verifyDocumentMagicBytes(rawBase64, detectedMime)) {
    await logAuditEvent({
      action: 'SECURITY_ALERT_TRIGGERED',
      actorRole: user?.role?.toUpperCase() || 'STAFF',
      details: `Blocked disguised file payload masquerading as '${detectedMime}' for Patient ID #${params.patientId}`,
      status: 'FAILURE',
    });
    return {
      success: false,
      error: 'Security rejection: Binary header signature does not match the declared file format.',
    };
  }

  try {
    const res = sqlite
      .prepare(`
        INSERT INTO patient_documents (
          patient_id, prescription_id, title, document_type, file_data, file_name, file_size_kb, mime_type, notes, uploaded_by, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        params.patientId,
        params.prescriptionId || null,
        params.title.trim(),
        params.documentType,
        params.fileData,
        safeFileName,
        params.fileSizeKb || 0,
        detectedMime,
        params.notes?.trim() || null,
        uploadedBy,
        Date.now()
      );

    await logAuditEvent({
      action: 'PATIENT_DOCUMENT_UPLOADED',
      actorRole: user?.role?.toUpperCase() || 'DOCTOR',
      details: `Uploaded ${params.documentType}: "${params.title}" (${safeFileName}) for Patient ID #${params.patientId}`,
      status: 'SUCCESS',
    });

    revalidatePath(`/patient/${params.patientId}`);
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save document';
    return { success: false, error: msg };
  }
}

export async function deletePatientDocumentAction(
  documentId: number,
  patientId: number
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('document:upload');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Doctor or CMO authorization required to delete patient medical records.' };
  }

  try {
    await db.delete(patientDocuments).where(eq(patientDocuments.id, documentId));
    await logAuditEvent({
      action: 'PATIENT_DOCUMENT_DELETED',
      actorRole: role.toUpperCase(),
      details: `Deleted Document #${documentId} for Patient ID #${patientId} by ${user?.name || role}`,
      status: 'WARNING',
    });
    revalidatePath(`/patient/${patientId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete document' };
  }
}
