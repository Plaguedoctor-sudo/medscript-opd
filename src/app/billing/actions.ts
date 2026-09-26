'use server';

import { db } from '@/db';
import { invoices, patients, clinicSettings, prescriptions } from '@/db/schema';
import { desc, eq, like, or, and, gte, lte, sql } from 'drizzle-orm';
import { InvoiceItem, Invoice, InvoiceWithPatient, Patient } from '@/types';
import { requireAuth, getCurrentUserRole } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export interface BillingSummary {
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  totalRefunded: number;
  totalInvoicesCount: number;
  todayBilled: number;
  invoices: InvoiceWithPatient[];
}

/**
 * Generate sequential invoice number: INV-YYYYMMDD-0001
 */
async function generateInvoiceNo(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `INV-${yyyy}${mm}${dd}`;

  // Find latest invoice created today
  const existingToday = await db
    .select({ invoiceNo: invoices.invoiceNo })
    .from(invoices)
    .where(like(invoices.invoiceNo, `${datePrefix}-%`))
    .orderBy(desc(invoices.id))
    .limit(1);

  let seq = 1;
  if (existingToday.length > 0 && existingToday[0].invoiceNo) {
    const parts = existingToday[0].invoiceNo.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${datePrefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Retrieve billing dashboard summary and invoice list with search & filter.
 */
export async function getBillingSummary(params?: {
  query?: string;
  status?: string;
  limit?: number;
}): Promise<BillingSummary> {
  await requireAuth('/billing');

  const cleanQuery = (params?.query || '').trim();
  const statusFilter = params?.status && params.status !== 'ALL' ? params.status : undefined;
  const limitCount = params?.limit || 50;

  // Retrieve invoices joined with patient data
  const rows = await db
    .select({
      invoice: invoices,
      patient: patients,
    })
    .from(invoices)
    .innerJoin(patients, eq(invoices.patientId, patients.id))
    .where(
      and(
        statusFilter ? eq(invoices.paymentStatus, statusFilter) : undefined,
        cleanQuery
          ? or(
              like(invoices.invoiceNo, `%${cleanQuery}%`),
              like(patients.name, `%${cleanQuery}%`),
              like(patients.phone, `%${cleanQuery}%`),
              like(patients.regNo, `%${cleanQuery}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(invoices.createdAt))
    .limit(limitCount);

  // Compute metrics across all invoices
  const allInvoices = await db.select().from(invoices);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let totalBilled = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let totalRefunded = 0;
  let todayBilled = 0;

  for (const inv of allInvoices) {
    totalBilled += inv.totalAmount || 0;
    if (inv.paymentStatus === 'PAID') {
      totalCollected += inv.totalAmount || 0;
    } else if (inv.paymentStatus === 'PENDING') {
      totalPending += inv.totalAmount || 0;
    } else if (inv.paymentStatus === 'REFUNDED') {
      totalRefunded += inv.totalAmount || 0;
    }

    if (inv.createdAt && new Date(inv.createdAt).getTime() >= todayStart) {
      todayBilled += inv.totalAmount || 0;
    }
  }

  const invoiceItems: InvoiceWithPatient[] = rows.map((r) => ({
    id: r.invoice.id,
    invoiceNo: r.invoice.invoiceNo,
    patientId: r.invoice.patientId,
    prescriptionId: r.invoice.prescriptionId,
    items: r.invoice.items,
    subtotal: r.invoice.subtotal,
    discount: r.invoice.discount || 0,
    tax: r.invoice.tax || 0,
    totalAmount: r.invoice.totalAmount,
    paymentMethod: r.invoice.paymentMethod,
    paymentStatus: r.invoice.paymentStatus,
    notes: r.invoice.notes,
    createdAt: r.invoice.createdAt,
    patient: {
      id: r.patient.id,
      regNo: r.patient.regNo,
      name: r.patient.name,
      age: r.patient.age,
      gender: r.patient.gender,
      phone: r.patient.phone,
      abhaId: r.patient.abhaId,
      createdAt: r.patient.createdAt,
    },
  }));

  return {
    totalBilled,
    totalCollected,
    totalPending,
    totalRefunded,
    totalInvoicesCount: allInvoices.length,
    todayBilled,
    invoices: invoiceItems,
  };
}

/**
 * Create a new OPD Invoice / Cash Receipt
 */
export async function createInvoiceAction(data: {
  patientId: number;
  prescriptionId?: number | null;
  items: InvoiceItem[];
  discount?: number;
  tax?: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Due';
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED';
  notes?: string;
}): Promise<{ success: boolean; invoiceId?: number; error?: string }> {
  try {
    await requireAuth('/billing');
    const role = await getCurrentUserRole();

    if (!data.patientId) {
      return { success: false, error: 'Patient is required' };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'At least one billing line item is required' };
    }

    // Verify patient exists
    const patientExists = await db.query.patients.findFirst({
      where: eq(patients.id, data.patientId),
    });
    if (!patientExists) {
      return { success: false, error: 'Selected patient does not exist' };
    }

    // Calculate subtotal
    const subtotal = data.items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const discount = Math.max(0, Number(data.discount) || 0);
    const tax = Math.max(0, Number(data.tax) || 0);
    const totalAmount = Math.max(0, subtotal - discount + tax);

    const invoiceNo = await generateInvoiceNo();

    const [inserted] = await db
      .insert(invoices)
      .values({
        invoiceNo,
        patientId: data.patientId,
        prescriptionId: data.prescriptionId || null,
        items: JSON.stringify(data.items),
        subtotal,
        discount,
        tax,
        totalAmount,
        paymentMethod: data.paymentMethod || 'Cash',
        paymentStatus: data.paymentStatus || 'PAID',
        notes: data.notes || null,
        createdAt: new Date(),
      })
      .returning({ id: invoices.id });

    await logAuditEvent({
      action: 'INVOICE_CREATED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Generated OPD Invoice ${invoiceNo} for ${patientExists.name} (Amount: ₹${totalAmount.toFixed(2)}, Status: ${data.paymentStatus})`,
      status: 'SUCCESS',
    });

    revalidatePath('/billing');
    revalidatePath('/');
    return { success: true, invoiceId: inserted.id };
  } catch (err: unknown) {
    console.error('Failed to create invoice:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create invoice' };
  }
}

/**
 * Get Invoice details for view / print
 */
export async function getInvoiceDetails(id: number): Promise<{
  invoice: Invoice;
  patient: Patient;
  settings: typeof clinicSettings.$inferSelect | null;
  prescriptionDetails?: { diagnosis: string | null; createdAt: Date | null } | null;
} | null> {
  await requireAuth('/billing');

  const row = await db
    .select({
      invoice: invoices,
      patient: patients,
    })
    .from(invoices)
    .innerJoin(patients, eq(invoices.patientId, patients.id))
    .where(eq(invoices.id, id))
    .limit(1);

  if (row.length === 0) return null;

  const inv = row[0].invoice;
  const pat = row[0].patient;
  const settings = (await db.query.clinicSettings.findFirst()) || null;

  let prescriptionDetails = null;
  if (inv.prescriptionId) {
    const rx = await db.query.prescriptions.findFirst({
      where: eq(prescriptions.id, inv.prescriptionId),
    });
    if (rx) {
      prescriptionDetails = { diagnosis: rx.diagnosis, createdAt: rx.createdAt };
    }
  }

  return {
    invoice: {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      patientId: inv.patientId,
      prescriptionId: inv.prescriptionId,
      items: inv.items,
      subtotal: inv.subtotal,
      discount: inv.discount || 0,
      tax: inv.tax || 0,
      totalAmount: inv.totalAmount,
      paymentMethod: inv.paymentMethod,
      paymentStatus: inv.paymentStatus,
      notes: inv.notes,
      createdAt: inv.createdAt,
    },
    patient: {
      id: pat.id,
      regNo: pat.regNo,
      name: pat.name,
      age: pat.age,
      gender: pat.gender,
      phone: pat.phone,
      abhaId: pat.abhaId,
      createdAt: pat.createdAt,
    },
    settings,
    prescriptionDetails,
  };
}

/**
 * Update payment status or method
 */
export async function updateInvoiceStatusAction(
  id: number,
  status: 'PAID' | 'PENDING' | 'REFUNDED',
  paymentMethod?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth('/billing');
    const role = await getCurrentUserRole();

    const inv = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });
    if (!inv) return { success: false, error: 'Invoice not found' };

    await db
      .update(invoices)
      .set({
        paymentStatus: status,
        paymentMethod: paymentMethod || inv.paymentMethod,
      })
      .where(eq(invoices.id, id));

    await logAuditEvent({
      action: 'INVOICE_UPDATED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: `Updated Invoice ${inv.invoiceNo} status to ${status} (${paymentMethod || inv.paymentMethod})`,
      status: 'SUCCESS',
    });

    revalidatePath('/billing');
    revalidatePath(`/billing/${id}`);
    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to update invoice status:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update status' };
  }
}

/**
 * Delete invoice (Doctor only)
 */
export async function deleteInvoiceAction(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth('/billing');
    const role = await getCurrentUserRole();

    if (role !== 'doctor') {
      return { success: false, error: 'Doctor authorization required to delete invoices' };
    }

    const inv = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });
    if (!inv) return { success: false, error: 'Invoice not found' };

    await db.delete(invoices).where(eq(invoices.id, id));

    await logAuditEvent({
      action: 'INVOICE_DELETED',
      actorRole: 'DOCTOR',
      details: `Deleted OPD Invoice ${inv.invoiceNo} (Amount: ₹${inv.totalAmount})`,
      status: 'SUCCESS',
    });

    revalidatePath('/billing');
    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to delete invoice:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete invoice' };
  }
}

/**
 * Search patients for quick invoice billing selection
 */
export async function searchPatientsForBilling(query: string): Promise<Patient[]> {
  await requireAuth('/billing');
  const clean = query.trim();
  if (!clean) {
    const recent = await db.select().from(patients).orderBy(desc(patients.id)).limit(10);
    return recent;
  }

  let hyphenated = clean;
  if (/^\d{9,}$/.test(clean)) {
    hyphenated = `${clean.slice(0, 8)}-${clean.slice(8)}`;
  }

  const results = await db
    .select()
    .from(patients)
    .where(
      or(
        like(patients.name, `%${clean}%`),
        like(patients.phone, `%${clean}%`),
        like(patients.regNo, `%${clean}%`),
        like(patients.regNo, `%${hyphenated}%`)
      )
    )
    .limit(10);

  return results;
}
