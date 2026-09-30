'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  ExternalLink,
  PlusCircle,
  Trash2,
  Plus,
  Printer,
  Sparkles,
  AlertCircle,
  FileText,
  BadgeAlert,
  Loader2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import {
  IpdAdmissionWithPatient,
  IpdRound,
  IpdClinicalService,
  LabReportWithPatient,
  IpdDeposit,
  InvoiceItem,
  ClinicSettings,
  Invoice,
} from '@/types';
import { calculateIpdBillBreakdown, calculateNetDeposits } from '@/lib/ipd-billing';
import { generateIpdFinalInvoiceAction } from '@/app/ipd/billing-actions';
import { formatDate } from '@/lib/utils';

interface IpdBillingSectionProps {
  admission: IpdAdmissionWithPatient;
  rounds: IpdRound[];
  clinicalServices?: IpdClinicalService[];
  labReportsList?: LabReportWithPatient[];
  deposits?: IpdDeposit[];
  userRole?: string;
  settings?: ClinicSettings | null;
  existingInvoice?: Invoice | null;
}

export function IpdBillingSection({
  admission,
  rounds,
  clinicalServices = [],
  labReportsList = [],
  deposits = [],
  userRole,
  settings,
  existingInvoice,
}: IpdBillingSectionProps) {
  const router = useRouter();

  // Role gating
  const isDoctor = userRole === 'admin_doctor' || userRole === 'doctor';
  const isReceptionist = userRole === 'receptionist';
  const canGenerateInvoice = isDoctor || isReceptionist;

  // Real-time calculation
  const breakdown = useMemo(() => {
    return calculateIpdBillBreakdown({
      admission,
      rounds,
      clinicalServices,
      labReports: labReportsList,
      deposits,
      existingInvoice,
    });
  }, [admission, rounds, clinicalServices, labReportsList, deposits, existingInvoice]);

  // Modal State for Generating Invoice
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Due'>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [autoDeductDeposits, setAutoDeductDeposits] = useState(true);
  const [notes, setNotes] = useState('');

  // Sync initial items when modal opens
  const handleOpenModal = () => {
    setItems([...breakdown.suggestedItems]);
    setDiscount(0);
    setTax(0);
    setPaymentMethod('Cash');
    setPaymentStatus(breakdown.netPayable === 0 ? 'PAID' : 'PAID');
    setAutoDeductDeposits(breakdown.totalDepositsPaid > 0);
    setNotes(`Final settlement for IPD Admission #${admission.admissionNo}. Stay: ${breakdown.lengthOfStayDays} day(s).`);
    setModalOpen(true);
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `custom_${Date.now()}`,
      description: 'Pharmacy / Medications & Consumables',
      category: 'Medication',
      quantity: 1,
      unitPrice: 500,
      total: 500,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, ...updates };
        updated.total = (updated.quantity || 1) * (updated.unitPrice || 0);
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Live modal computations
  const grossSubtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  }, [items]);

  const effectiveDiscount = useMemo(() => {
    let disc = Number(discount) || 0;
    if (autoDeductDeposits && breakdown.totalDepositsPaid > 0) {
      disc += Math.min(breakdown.totalDepositsPaid, grossSubtotal);
    }
    return Math.min(disc, grossSubtotal);
  }, [discount, autoDeductDeposits, breakdown.totalDepositsPaid, grossSubtotal]);

  const finalTotal = useMemo(() => {
    return Math.max(0, grossSubtotal - effectiveDiscount + (Number(tax) || 0));
  }, [grossSubtotal, effectiveDiscount, tax]);

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.show({
        title: 'Items Required',
        description: 'Please add at least one line item to generate invoice.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await generateIpdFinalInvoiceAction({
        admissionId: admission.id,
        items,
        discount: effectiveDiscount,
        tax: Number(tax) || 0,
        paymentMethod,
        paymentStatus,
        notes: autoDeductDeposits && breakdown.totalDepositsPaid > 0
          ? `${notes}\n[Advance Adjusted: ₹${breakdown.totalDepositsPaid.toFixed(2)}]`
          : notes,
      });

      if (res.success && res.invoiceId) {
        toast.show({
          title: 'Invoice Generated',
          description: `Inpatient Invoice #${res.invoiceNo} successfully generated.`,
          type: 'success',
        });
        setModalOpen(false);
        router.refresh();
      } else {
        toast.show({
          title: 'Error',
          description: res.error || 'Failed to generate IPD invoice.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate invoice.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-2xl bg-white p-6 mb-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" /> Inpatient Billing & Financial Settlement
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-calculated bed charges, nursing care, doctor visits, procedures, and deposit reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {existingInvoice ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Settled ({existingInvoice.invoiceNo})
              </span>
              <Link href={`/billing/${existingInvoice.id}`}>
                <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5 font-semibold">
                  <ExternalLink className="w-3.5 h-3.5" /> View Final Bill
                </Button>
              </Link>
            </div>
          ) : (
            canGenerateInvoice && (
              <Button
                onClick={handleOpenModal}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold shadow-xs"
              >
                <CreditCard className="w-4 h-4" /> Generate Final Inpatient Bill
              </Button>
            )
          )}
        </div>
      </div>

      {/* Bill Matrix Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          <span className="text-slate-400 font-semibold uppercase block text-[10px]">Bed & Ward Tariff</span>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            ₹{breakdown.bedChargesTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {breakdown.lengthOfStayDays} Day{breakdown.lengthOfStayDays > 1 ? 's' : ''} @ ₹{breakdown.bedTariffPerDay}/day
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          <span className="text-slate-400 font-semibold uppercase block text-[10px]">Nursing & Care</span>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            ₹{breakdown.nursingChargesTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            ₹{breakdown.nursingCarePerDay}/day bedside care
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          <span className="text-slate-400 font-semibold uppercase block text-[10px]">Doctor Rounds & Care</span>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            ₹{(breakdown.doctorRoundsTotal + breakdown.clinicalServicesTotal).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {breakdown.doctorRoundsCount} Round(s) + {clinicalServices.length} Proc.
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          <span className="text-slate-400 font-semibold uppercase block text-[10px]">Lab Investigations</span>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            ₹{breakdown.labTestsTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {labReportsList.length} Inpatient Report(s)
          </div>
        </div>
      </div>

      {/* Financial Ledger Reconciler */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-4.5 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-slate-400 font-medium uppercase text-[11px] tracking-wider">
              Inpatient Bill Reconciliation
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-slate-300">Gross Total: <strong className="text-white text-base">₹{breakdown.grossTotal.toLocaleString()}</strong></span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-300">Advance Paid: <strong className="text-emerald-400 text-base">₹{breakdown.totalDepositsPaid.toLocaleString()}</strong></span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            {breakdown.netPayable > 0 ? (
              <div>
                <span className="text-amber-300 uppercase font-semibold text-[10px] tracking-wider block">
                  Net Balance Payable
                </span>
                <span className="text-xl font-black text-amber-400">
                  ₹{breakdown.netPayable.toLocaleString()}
                </span>
              </div>
            ) : breakdown.refundDue > 0 ? (
              <div>
                <span className="text-blue-300 uppercase font-semibold text-[10px] tracking-wider block">
                  Refund Due to Patient
                </span>
                <span className="text-xl font-black text-blue-300">
                  ₹{breakdown.refundDue.toLocaleString()}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-emerald-300 uppercase font-semibold text-[10px] tracking-wider block">
                  Balance Status
                </span>
                <span className="text-lg font-bold text-emerald-400">Fully Covered by Advance</span>
              </div>
            )}
          </div>
        </div>

        {/* Advance Deposit Badges */}
        {deposits.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-700/60 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-400 font-semibold">Advance Receipts:</span>
            {deposits.map((dep) => (
              <span
                key={dep.id}
                className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded font-mono text-[10px]"
              >
                {dep.receiptNo}: ₹{dep.amount.toLocaleString()} ({dep.paymentMethod})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Line Items List */}
      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
        <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-700 flex items-center justify-between">
          <span>Itemized Inpatient Charges ({breakdown.suggestedItems.length} items)</span>
          <span className="font-mono text-slate-500">Total: ₹{breakdown.grossTotal.toLocaleString()}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {breakdown.suggestedItems.map((item) => (
            <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50/60">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{item.description}</div>
                <div className="text-[11px] text-slate-400">
                  Category: <span className="text-slate-600 font-medium">{item.category}</span> • Qty: {item.quantity} × ₹{item.unitPrice.toLocaleString()}
                </div>
              </div>
              <div className="font-mono font-bold text-slate-900 shrink-0">
                ₹{item.total.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Inpatient Final Bill Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmitInvoice}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Generate Final Inpatient Bill & Settle Stay
              </DialogTitle>
              <DialogDescription>
                Review itemized charges, apply advance deposit credit, and issue an official OPD/IPD invoice.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Line Items Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">Billing Line Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs gap-1 border-dashed text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  >
                    <Plus className="w-3 h-3" /> Add Charge / Medication
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 bg-white p-2 rounded-md border border-slate-200">
                      <Input
                        value={it.description}
                        onChange={(e) => handleUpdateItem(it.id, { description: e.target.value })}
                        placeholder="Item description"
                        className="h-8 text-xs flex-1"
                        required
                      />
                      <Input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItem(it.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                        className="h-8 w-16 text-xs text-center"
                        title="Quantity"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => handleUpdateItem(it.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-24 text-xs text-right font-mono"
                        title="Unit Price"
                      />
                      <span className="w-20 text-right font-mono font-bold text-slate-900 shrink-0">
                        ₹{(it.total || 0).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advance Deposit Deduction Checkbox */}
              {breakdown.totalDepositsPaid > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block text-xs">
                      Advance Deposits Paid: ₹{breakdown.totalDepositsPaid.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Reconciled across {deposits.length} advance receipts.
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-emerald-950">
                    <input
                      type="checkbox"
                      checked={autoDeductDeposits}
                      onChange={(e) => setAutoDeductDeposits(e.target.checked)}
                      className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    Deduct from Bill Total
                  </label>
                </div>
              )}

              {/* Financial Calculation Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100 p-3 rounded-xl font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans uppercase">Gross Subtotal</span>
                  <strong className="text-slate-900 font-bold text-sm">₹{grossSubtotal.toLocaleString()}</strong>
                </div>

                <div>
                  <Label className="text-[10px] font-sans uppercase text-slate-400 block mb-0.5">Discount (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-[10px] font-sans uppercase text-slate-400 block mb-0.5">Tax / GST (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs font-mono"
                  />
                </div>

                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] font-sans uppercase">Net Payable</span>
                  <strong className="text-emerald-700 font-black text-base">₹{finalTotal.toLocaleString()}</strong>
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card / POS</option>
                    <option value="Due">Credit / Due</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Payment Status</Label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-semibold"
                  >
                    <option value="PAID">PAID (Settled at Discharge)</option>
                    <option value="PENDING">PENDING (Balance Due)</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <Label className="text-xs">Notes / Billing Remarks</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm & Generate Inpatient Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
