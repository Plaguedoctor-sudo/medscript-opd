'use server';

import { db } from '@/db';
import {
  ipdAdmissions,
  patients,
  ipdRounds,
  ipdClinicalServices,
  labReports,
  ipdDeposits,
  invoices,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requirePermission, getCurrentUserRole } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { calculateIpdBillBreakdown, IpdTariffConfig } from '@/lib/ipd-billing';
import { generateInvoiceNo } from '@/app/billing/actions';
import {
  InvoiceItem,
  IpdBillingBreakdown,
  Invoice,
  IpdRound,
  IpdClinicalService,
  LabReport,
  IpdDeposit,
} from '@/types';

/**
 * Fetch complete IPD billing breakdown for an admission.
 * Reconciles bed stay, doctor rounds, procedures, lab investigations, and advance deposits.
 */
export async function getIpdBillingSummaryAction(
  admissionId: number,
  config?: IpdTariffConfig
): Promise<{ success: boolean; breakdown?: IpdBillingBreakdown; error?: string }> {
  try {
    await requirePermission('billing:view', `/ipd/${admissionId}`);

    const admission = await db.query.ipdAdmissions.findFirst({
      where: eq(ipdAdmissions.id, admissionId),
    });

    if (!admission) {
      return { success: false, error: 'Inpatient admission record not found.' };
    }

    const [rounds, clinicalServices, linkedLabs, deposits, existingInvoices] = await Promise.all([
      db.select().from(ipdRounds).where(eq(ipdRounds.admissionId, admissionId)).orderBy(desc(ipdRounds.roundDate)),
      db
        .select()
        .from(ipdClinicalServices)
        .where(eq(ipdClinicalServices.admissionId, admissionId))
        .orderBy(desc(ipdClinicalServices.performedAt)),
      db.select().from(labReports).where(eq(labReports.ipdAdmissionId, admissionId)).orderBy(desc(labReports.createdAt)),
      db.select().from(ipdDeposits).where(eq(ipdDeposits.admissionId, admissionId)).orderBy(desc(ipdDeposits.id)),
      db.select().from(invoices).where(eq(invoices.admissionId, admissionId)).orderBy(desc(invoices.id)).limit(1),
    ]);

    const existingInvoice = (existingInvoices.length > 0 ? existingInvoices[0] : null) as Invoice | null;

    const breakdown = calculateIpdBillBreakdown({
      admission,
      rounds: rounds as unknown as IpdRound[],
      clinicalServices: clinicalServices as unknown as IpdClinicalService[],
      labReports: linkedLabs as unknown as LabReport[],
      deposits: deposits as unknown as IpdDeposit[],
      config,
      existingInvoice,
    });

    return { success: true, breakdown };
  } catch (err: unknown) {
    console.error('Failed to get IPD billing summary:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve IPD billing summary.',
    };
  }
}

/**
 * Generates an official Inpatient Final Bill / Settle IPD Stay.
 * Links invoice to IPD admission, reconciles deposits, and logs audit trail.
 */
export async function generateIpdFinalInvoiceAction(data: {
  admissionId: number;
  items: InvoiceItem[];
  discount?: number;
  tax?: number;
  cgst?: number;
  sgst?: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Due';
  paymentStatus: 'PAID' | 'PENDING';
  notes?: string;
}): Promise<{ success: boolean; invoiceId?: number; invoiceNo?: string; error?: string }> {
  try {
    await requirePermission('billing:view', `/ipd/${data.admissionId}`);
    const role = await getCurrentUserRole();

    const admission = await db.query.ipdAdmissions.findFirst({
      where: eq(ipdAdmissions.id, data.admissionId),
    });

    if (!admission) {
      return { success: false, error: 'IPD Admission not found' };
    }

    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, admission.patientId),
    });

    if (!patient) {
      return { success: false, error: 'Patient profile not found' };
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return { success: false, error: 'At least one billing line item is required' };
    }

    const sanitizedItems: InvoiceItem[] = data.items.map((it, idx) => ({
      id: it.id || `ipd_item_${idx + 1}`,
      description: (it.description || '').trim().slice(0, 200),
      category: (it.category && ['Consultation', 'Medication', 'Procedure', 'Lab Test', 'Other'].includes(it.category)
        ? it.category
        : 'Other') as InvoiceItem['category'],
      quantity: Number.isFinite(it.quantity) ? Math.max(1, Math.min(Math.round(it.quantity), 10000)) : 1,
      unitPrice: Number.isFinite(it.unitPrice) ? Math.max(0, Math.min(it.unitPrice, 10000000)) : 0,
      total: Number.isFinite(it.total) ? Math.max(0, Math.min(it.total, 100000000)) : 0,
    }));

    const subtotal = sanitizedItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const discount = Math.max(0, Math.min(Number(data.discount) || 0, subtotal));
    const tax = Math.max(0, Math.min(Number(data.tax) || 0, 1000000));
    const cgst = Number.isFinite(data.cgst) ? Number(data.cgst) : tax > 0 ? Number((tax / 2).toFixed(2)) : 0;
    const sgst = Number.isFinite(data.sgst) ? Number(data.sgst) : tax > 0 ? Number((tax - cgst).toFixed(2)) : 0;
    const totalAmount = Math.max(0, subtotal - discount + tax);

    const ALLOWED_METHODS = ['Cash', 'UPI', 'Card', 'Due'] as const;
    const paymentMethod = ALLOWED_METHODS.includes(data.paymentMethod) ? data.paymentMethod : 'Cash';

    const ALLOWED_STATUSES = ['PAID', 'PENDING'] as const;
    const paymentStatus = ALLOWED_STATUSES.includes(data.paymentStatus) ? data.paymentStatus : 'PAID';

    const invoiceNo = await generateInvoiceNo();

    const notePrefix = `IPD Final Inpatient Bill — Admission #${admission.admissionNo} (${admission.ward}, Bed ${admission.bedNo})`;
    const customNote = (data.notes || '').trim();
    const finalNotes = customNote ? `${notePrefix}\n${customNote}`.slice(0, 500) : notePrefix;

    const [inserted] = await db
      .insert(invoices)
      .values({
        invoiceNo,
        patientId: admission.patientId,
        prescriptionId: null,
        admissionId: admission.id,
        items: JSON.stringify(sanitizedItems),
        subtotal,
        discount,
        tax,
        cgst,
        sgst,
        totalAmount,
        paymentMethod,
        paymentStatus,
        notes: finalNotes,
        createdAt: new Date(),
      })
      .returning({ id: invoices.id });

    await logAuditEvent({
      action: 'IPD_INVOICE_GENERATED',
      actorRole: role.toUpperCase(),
      details: `Generated IPD Final Invoice ${invoiceNo} for ${patient.name} (Admission: ${admission.admissionNo}, Amount: ₹${totalAmount.toFixed(2)}, Status: ${paymentStatus})`,
      status: 'SUCCESS',
    });

    revalidatePath(`/ipd/${admission.id}`);
    revalidatePath('/billing');
    revalidatePath('/');

    return {
      success: true,
      invoiceId: inserted.id,
      invoiceNo,
    };
  } catch (err: unknown) {
    console.error('Failed to generate IPD invoice:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate IPD final invoice.',
    };
  }
}
