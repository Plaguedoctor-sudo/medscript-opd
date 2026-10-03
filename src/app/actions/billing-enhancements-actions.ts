'use server';

import { requirePermission } from '@/lib/auth';
import { sqlite } from '@/db';
import { generateDynamicUpiQr } from '@/lib/billing/upi-qr-generator';
import { computeHealthcareGst, HealthcareInvoiceItem } from '@/lib/billing/gst-calculator';
import { formatThermalReceiptText, ThermalReceiptOptions } from '@/lib/printing/thermal-printer';
import { UpiPaymentDetails, GstTaxBreakdown } from '@/types';

/**
 * Generates a dynamic Bharat UPI QR code for clinic counter payments.
 */
export async function generateCounterUpiQrAction(data: {
  amount: number;
  transactionRef: string;
  note?: string;
}): Promise<{ success: boolean; upiDetails?: UpiPaymentDetails; error?: string }> {
  await requirePermission('billing:view');

  try {
    const settings = sqlite
      .prepare('SELECT clinic_name FROM clinic_settings WHERE id = 1')
      .get() as { clinic_name?: string } | undefined;

    const clinicName = settings?.clinic_name || 'MedScript Hospital';
    const vpa = process.env.CLINIC_UPI_VPA || 'medscript.hospital@upi';

    const upiDetails = await generateDynamicUpiQr({
      vpa,
      merchantName: clinicName,
      amount: data.amount,
      transactionRef: data.transactionRef,
      note: data.note,
    });

    return { success: true, upiDetails };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate UPI QR';
    return { success: false, error: msg };
  }
}

/**
 * Calculates SAC 999311 healthcare GST breakdowns.
 */
export async function calculateHealthcareGstAction(items: HealthcareInvoiceItem[]): Promise<{
  success: boolean;
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  breakdowns: GstTaxBreakdown[];
  error?: string;
}> {
  await requirePermission('billing:view');

  try {
    const result = computeHealthcareGst(items);
    return { success: true, ...result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate GST';
    return { success: false, subtotal: 0, totalGst: 0, grandTotal: 0, breakdowns: [], error: msg };
  }
}

/**
 * Generates formatted ESC/POS 58mm/80mm thermal receipt text for counter printing.
 */
export async function getThermalReceiptTextAction(
  options: Omit<ThermalReceiptOptions, 'clinicName' | 'clinicAddress' | 'clinicPhone'>
): Promise<{ success: boolean; receiptText?: string; error?: string }> {
  await requirePermission('billing:view');

  try {
    const settings = sqlite
      .prepare('SELECT clinic_name, address, contact FROM clinic_settings WHERE id = 1')
      .get() as { clinic_name?: string; address?: string; contact?: string } | undefined;

    const receiptText = formatThermalReceiptText({
      ...options,
      clinicName: settings?.clinic_name || 'MedScript Hospital & OPD',
      clinicAddress: settings?.address || 'Healthcare Way',
      clinicPhone: settings?.contact || '+91 9876543210',
    });

    return { success: true, receiptText };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to format thermal receipt';
    return { success: false, error: msg };
  }
}
