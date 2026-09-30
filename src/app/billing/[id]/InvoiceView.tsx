'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Printer,
  ChevronLeft,
  Share2,
  CheckCircle2,
  Clock,
  CreditCard,
  MessageCircle,
  Copy,
  Check,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  QrCode,
  Bed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Invoice, Patient, ClinicSettings, SafeClinicSettings, InvoiceItem } from '@/types';
import { formatDate } from '@/lib/utils';
import { updateInvoiceStatusAction } from '../actions';

interface InvoiceViewProps {
  invoice: Invoice;
  patient: Patient;
  settings: SafeClinicSettings | ClinicSettings | null;
  prescriptionDetails?: { diagnosis: string | null; createdAt: Date | null } | null;
  admissionDetails?: {
    id: number;
    admissionNo: string;
    ward: string;
    bedNo: string;
    roomType?: string | null;
    attendingDoctor?: string | null;
    admittingDiagnosis?: string | null;
    admissionDate: Date;
    dischargeDate?: Date | null;
  } | null;
}

export function InvoiceView({ invoice, patient, settings, prescriptionDetails, admissionDetails }: InvoiceViewProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.upiId && invoice.totalAmount > 0) {
      const upiUri = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.clinicName || 'Clinic')}&am=${invoice.totalAmount.toFixed(2)}&tn=${encodeURIComponent('Bill ' + invoice.invoiceNo)}&cu=INR`;
      QRCode.toDataURL(upiUri, { width: 180, margin: 1 })
        .then(setUpiQrUrl)
        .catch((err) => console.error('Failed to generate UPI QR:', err));
    }
  }, [settings?.upiId, settings?.clinicName, invoice.totalAmount, invoice.invoiceNo]);

  let items: InvoiceItem[] = [];
  try {
    items = JSON.parse(invoice.items || '[]');
  } catch {
    items = [];
  }

  const handlePrint = () => {
    window.print();
  };

  const handleMarkPaid = async () => {
    setIsUpdating(true);
    const res = await updateInvoiceStatusAction(invoice.id, 'PAID');
    setIsUpdating(false);
    if (res.success) {
      toast.success('Payment Marked Paid', 'Invoice has been marked as fully settled.');
      router.refresh();
    } else {
      toast.error('Error', res.error || 'Failed to update status');
    }
  };

  const shareText = `*OPD BILL RECEIPT - ${settings?.clinicName || 'Clinic'}*
Invoice No: ${invoice.invoiceNo}
Patient: ${patient.name} (${patient.regNo || ''})
Date: ${formatDate(invoice.createdAt)}
Amount: ₹${invoice.totalAmount.toFixed(2)} (${invoice.paymentStatus})
Payment Mode: ${invoice.paymentMethod}
Doctor: ${settings?.doctorName || 'Doctor'}
Thank you for visiting ${settings?.clinicName || 'our clinic'}.`;

  const handleCopySummary = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success('Copied', 'Invoice summary copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const phoneClean = (patient.phone || '').replace(/\D/g, '');
    const encoded = encodeURIComponent(shareText);
    const url = phoneClean.length >= 10
      ? `https://wa.me/${phoneClean.startsWith('91') ? phoneClean : '91' + phoneClean}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Action Bar (Hidden during Print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <Link href="/billing">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
            <ChevronLeft className="w-4 h-4" /> Back to Invoices
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.paymentStatus === 'PENDING' && (
            <Button
              size="sm"
              onClick={handleMarkPaid}
              disabled={isUpdating}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isUpdating ? 'Updating...' : 'Mark as Paid'}
            </Button>
          )}

          {invoice.admissionId && (
            <Link href={`/ipd/${invoice.admissionId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50">
                <Bed className="w-4 h-4 text-purple-600" /> View IPD Case Sheet
              </Button>
            </Link>
          )}

          <Button variant="outline" size="sm" onClick={handleCopySummary} className="gap-1.5 text-xs text-slate-700">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsAppShare}
            className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            WhatsApp Receipt
          </Button>

          <Button onClick={handlePrint} size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs">
            <Printer className="w-4 h-4" /> Print Bill
          </Button>
        </div>
      </div>

      {/* Printable Invoice Document */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 max-w-3xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none text-slate-900">
        {/* Clinic Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {settings?.clinicName || 'OUTPATIENT CLINIC'}
              </h1>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {settings?.doctorName || 'Consultant Physician'}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {settings?.qualifications && <span>{settings.qualifications}</span>}
                {settings?.regNumber && <span> • Reg. No: {settings.regNumber}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                {settings?.address && <span>{settings.address}</span>}
                {settings?.contact && <span> • Tel: {settings.contact}</span>}
                {settings?.gstNumber && <span className="font-mono font-semibold text-slate-700"> • GSTIN: {settings.gstNumber}</span>}
              </div>
            </div>

            <div className="text-right">
              <div
                className={`inline-block px-3 py-1 ${
                  admissionDetails || invoice.admissionId ? 'bg-purple-900' : 'bg-slate-900'
                } text-white text-[11px] font-bold uppercase tracking-wider rounded`}
              >
                {admissionDetails || invoice.admissionId ? 'Inpatient (IPD) Final Bill' : 'OPD Cash Receipt'}
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 mt-2">
                {invoice.invoiceNo}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatDate(invoice.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Patient Details & Bill Meta Grid */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Patient Name</span>
            <span className="font-bold text-slate-900 text-sm">{patient.name}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Reg / Patient ID</span>
            <span className="font-mono font-bold text-slate-900">{patient.regNo || `ID #${patient.id}`}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Age / Gender</span>
            <span className="font-semibold text-slate-800">{patient.age} Yrs / {patient.gender}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Contact Phone</span>
            <span className="font-mono text-slate-800">{patient.phone || 'N/A'}</span>
          </div>

          {admissionDetails && (
            <div className="col-span-2 sm:col-span-4 border-t border-purple-200/80 pt-2.5 mt-1 bg-purple-50/70 p-3 rounded-lg text-purple-950 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-purple-600 block text-[10px] uppercase font-bold tracking-wider">Admission No</span>
                <span className="font-mono font-bold text-purple-900">{admissionDetails.admissionNo}</span>
              </div>
              <div>
                <span className="text-purple-600 block text-[10px] uppercase font-bold tracking-wider">Ward & Bed</span>
                <span className="font-bold text-purple-900">{admissionDetails.ward} ({admissionDetails.bedNo})</span>
              </div>
              <div>
                <span className="text-purple-600 block text-[10px] uppercase font-bold tracking-wider">Admission Date</span>
                <span className="font-semibold text-slate-800">{formatDate(admissionDetails.admissionDate)}</span>
              </div>
              <div>
                <span className="text-purple-600 block text-[10px] uppercase font-bold tracking-wider">Discharge Date</span>
                <span className="font-semibold text-slate-800">
                  {admissionDetails.dischargeDate ? formatDate(admissionDetails.dischargeDate) : 'Currently Admitted'}
                </span>
              </div>
              {admissionDetails.admittingDiagnosis && (
                <div className="col-span-2 sm:col-span-4 mt-0.5">
                  <span className="text-purple-600 text-[10px] uppercase font-bold tracking-wider">Admitting Diagnosis: </span>
                  <span className="font-semibold text-slate-900">{admissionDetails.admittingDiagnosis}</span>
                </div>
              )}
            </div>
          )}

          {prescriptionDetails?.diagnosis && !admissionDetails && (
            <div className="col-span-2 sm:col-span-4 border-t border-slate-200/80 pt-2 mt-1 flex items-center gap-2">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Clinical Diagnosis:</span>
              <span className="font-semibold text-slate-800">{prescriptionDetails.diagnosis}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">Service / Particulars</th>
                <th className="py-2.5 px-3 w-28">Category</th>
                <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                <th className="py-2.5 px-3 w-24 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={it.id || idx}>
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{it.description}</td>
                  <td className="py-2.5 px-3 text-slate-500">
                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                      {it.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{it.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {Number(it.unitPrice).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {Number(it.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Totals & Payment Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8 items-start">
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-500 font-medium">Payment Mode:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  {invoice.paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Payment Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                    invoice.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {invoice.paymentStatus}
                </span>
              </div>
            </div>

            {upiQrUrl ? (
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 flex items-center gap-3">
                <div className="w-20 h-20 bg-white p-1 rounded-lg border border-indigo-200 shrink-0 flex items-center justify-center shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={upiQrUrl} alt="UPI Payment QR Code" className="w-full h-full object-contain" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1 font-bold text-indigo-950 text-xs">
                    <QrCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Instant UPI QR
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">
                    Scan with GPay, PhonePe, Paytm, or BHIM.
                  </p>
                  <p className="text-[10px] font-mono text-indigo-700 font-bold truncate">
                    {settings?.upiId}
                  </p>
                </div>
              </div>
            ) : null}

            {invoice.notes && (
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700">Remarks:</span> {invoice.notes}
              </div>
            )}
          </div>

          {/* Subtotals & Net Amount */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">₹{invoice.subtotal.toFixed(2)}</span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount / Concession:</span>
                <span className="font-mono">- ₹{invoice.discount.toFixed(2)}</span>
              </div>
            )}

            {invoice.cgst && invoice.cgst > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span>CGST (Central Tax):</span>
                <span className="font-mono">+ ₹{invoice.cgst.toFixed(2)}</span>
              </div>
            ) : null}

            {invoice.sgst && invoice.sgst > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span>SGST (State Tax):</span>
                <span className="font-mono">+ ₹{invoice.sgst.toFixed(2)}</span>
              </div>
            ) : null}

            {(!invoice.cgst && !invoice.sgst && invoice.tax > 0) && (
              <div className="flex justify-between text-slate-600">
                <span>Tax / GST:</span>
                <span className="font-mono">+ ₹{invoice.tax.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Grand Total:</span>
              <span className="text-lg font-mono text-emerald-800">
                ₹{invoice.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer & Signature Box */}
        <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              MedScript EMR Certified Electronic Receipt
            </div>
            <p className="text-[10px]">
              Computer-generated receipt • Valid without physical signature • {formatDate(invoice.createdAt)}
            </p>
          </div>

          <div className="text-right">
            <div className="w-44 border-b border-slate-400 mb-1.5"></div>
            <div className="font-bold text-slate-800">{settings?.doctorName || 'Authorized Signatory'}</div>
            <div className="text-[10px] text-slate-500">Consultant / Clinic Cashier</div>
          </div>
        </div>
      </div>
    </div>
  );
}
