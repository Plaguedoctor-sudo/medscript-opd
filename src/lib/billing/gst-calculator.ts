/**
 * Indian Healthcare GST & SAC Compliance Calculator
 * Compliant with GST Notification No. 12/2017-Central Tax (Rate) & Notification No. 04/2022.
 * 
 * Rules:
 * 1. OPD Consultations & Diagnostic Tests: EXEMPT from GST (SAC 999311).
 * 2. IPD Room Rent <= ₹5,000/day: EXEMPT from GST.
 * 3. IPD Room Rent > ₹5,000/day (Non-ICU): 5% GST (2.5% CGST + 2.5% SGST) without ITC.
 * 4. ICU / Critical Care Beds: EXEMPT from GST regardless of daily room charge.
 * 5. Medicines / Pharmaceuticals: Split GST (typically 5% or 12%).
 */

import { GstTaxBreakdown } from '@/types';

export interface HealthcareInvoiceItem {
  description: string;
  category: 'OPD_CONSULTATION' | 'ROOM_RENT' | 'ICU_BED' | 'INVESTIGATION' | 'PROCEDURE' | 'MEDICINE';
  amount: number;
  ratePerDay?: number;
}

export function computeHealthcareGst(items: HealthcareInvoiceItem[]): {
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  breakdowns: GstTaxBreakdown[];
} {
  let subtotal = 0;
  let totalGst = 0;
  const breakdowns: GstTaxBreakdown[] = [];

  for (const item of items) {
    subtotal += item.amount;
    let cgstRate = 0;
    let sgstRate = 0;
    let sacCode = '999311'; // Healthcare Services by Clinical Establishments

    if (item.category === 'ROOM_RENT') {
      // Room rent > 5,000 per day attracts 5% GST (2.5% CGST + 2.5% SGST)
      const dailyRate = item.ratePerDay ?? item.amount;
      if (dailyRate > 5000) {
        cgstRate = 2.5;
        sgstRate = 2.5;
      }
    } else if (item.category === 'MEDICINE') {
      sacCode = 'HSN-3004';
      cgstRate = 2.5;
      sgstRate = 2.5; // Standard 5% pharma
    }

    const cgstAmount = Math.round((item.amount * (cgstRate / 100)) * 100) / 100;
    const sgstAmount = Math.round((item.amount * (sgstRate / 100)) * 100) / 100;
    const tax = cgstAmount + sgstAmount;
    totalGst += tax;

    breakdowns.push({
      sacCode,
      description: item.description,
      taxableAmount: item.amount,
      cgstRatePercent: cgstRate,
      cgstAmount,
      sgstRatePercent: sgstRate,
      sgstAmount,
      totalTax: tax,
      totalWithTax: Math.round((item.amount + tax) * 100) / 100,
    });
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    grandTotal: Math.round((subtotal + totalGst) * 100) / 100,
    breakdowns,
  };
}
