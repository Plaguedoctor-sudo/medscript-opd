'use server';

import { db, sqlite } from '@/db';
import { patientDocuments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requirePermission, getCurrentUser } from '@/lib/auth';
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
        params.fileName || null,
        params.fileSizeKb || 0,
        params.mimeType || null,
        params.notes?.trim() || null,
        uploadedBy,
        Date.now()
      );

    await logAuditEvent({
      action: 'PATIENT_DOCUMENT_UPLOADED',
      actorRole: user?.role?.toUpperCase() || 'DOCTOR',
      details: `Uploaded ${params.documentType}: "${params.title}" (${params.fileName || 'file'}) for Patient ID #${params.patientId}`,
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
  try {
    await db.delete(patientDocuments).where(eq(patientDocuments.id, documentId));
    await logAuditEvent({
      action: 'PATIENT_DOCUMENT_DELETED',
      actorRole: 'DOCTOR',
      details: `Deleted Document #${documentId} for Patient ID #${patientId}`,
      status: 'WARNING',
    });
    revalidatePath(`/patient/${patientId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete document' };
  }
}
