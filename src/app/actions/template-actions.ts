'use server';

import { db, sqlite } from '@/db';
import { prescriptionTemplates } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, isDoctor, getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { PrescriptionTemplate, Medication } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getPrescriptionTemplatesAction(): Promise<PrescriptionTemplate[]> {
  await requireAuth();
  const rows = await db
    .select()
    .from(prescriptionTemplates)
    .orderBy(desc(prescriptionTemplates.createdAt));

  return rows as PrescriptionTemplate[];
}

export async function createPrescriptionTemplateAction(params: {
  name: string;
  category?: string;
  description?: string;
  chiefComplaints?: string;
  diagnosis?: string;
  medications: Medication[];
  advice?: string;
  labTests?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requireAuth();
  const user = await getCurrentUser();
  const doctorAuthorized = !user || isDoctor(user.role);
  if (!doctorAuthorized) {
    return { success: false, error: 'Only doctors can save clinical prescription templates.' };
  }

  const createdBy = user ? user.name : 'Attending Doctor';

  if (!params.name || !params.name.trim()) {
    return { success: false, error: 'Template name is required.' };
  }

  if (!params.medications || params.medications.length === 0) {
    return { success: false, error: 'At least one medication is required in a template.' };
  }

  try {
    const res = sqlite
      .prepare(`
        INSERT INTO prescription_templates (
          name, category, description, chief_complaints, diagnosis, medications, advice, lab_tests, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        params.name.trim(),
        params.category?.trim() || 'General',
        params.description?.trim() || null,
        params.chiefComplaints?.trim() || null,
        params.diagnosis?.trim() || null,
        JSON.stringify(params.medications),
        params.advice?.trim() || null,
        params.labTests?.trim() || null,
        createdBy,
        Date.now()
      );

    await logAuditEvent({
      action: 'PRESCRIPTION_TEMPLATE_CREATED',
      actorRole: 'DOCTOR',
      details: `Created prescription template: ${params.name}`,
      status: 'SUCCESS',
    });

    revalidatePath('/prescription/new');
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save template';
    return { success: false, error: msg };
  }
}

export async function deletePrescriptionTemplateAction(id: number): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const user = await getCurrentUser();
  const doctorAuthorized = !user || isDoctor(user.role);
  if (!doctorAuthorized) {
    return { success: false, error: 'Only doctors can delete prescription templates.' };
  }

  try {
    await db.delete(prescriptionTemplates).where(eq(prescriptionTemplates.id, id));
    revalidatePath('/prescription/new');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete template' };
  }
}
