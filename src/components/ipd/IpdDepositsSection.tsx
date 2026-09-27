'use client';

import { useState, useTransition } from 'react';
import {
  Receipt,
  Plus,
  IndianRupee,
  CreditCard,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IpdDeposit } from '@/types';
import { addIpdDepositAction } from '@/app/ipd/actions';
import { useRouter } from 'next/navigation';

interface IpdDepositsSectionProps {
  admissionId: number;
  patientId: number;
  initialDeposits: IpdDeposit[];
  userRole?: string;
}

export function IpdDepositsSection({
  admissionId,
  patientId,
  initialDeposits,
  userRole,
}: IpdDepositsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [deposits, setDeposits] = useState<IpdDeposit[]>(initialDeposits);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [type, setType] = useState<'ADVANCE' | 'TOP_UP' | 'REFUND'>('ADVANCE');
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const totalAdvance = deposits.reduce((acc, d) => {
    if (d.type === 'REFUND') return acc - d.amount;
    return acc + d.amount;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await addIpdDepositAction({
      admissionId,
      patientId,
      amount: Number(amount),
      paymentMethod,
      transactionRef,
      type,
      notes,
    });

    if (res.success) {
      setSuccessMsg(`Deposit recorded! Receipt #${res.receiptNo}`);
      setTimeout(() => {
        setShowAddModal(false);
        setSuccessMsg(null);
        startTransition(() => router.refresh());
      }, 900);
    } else {
      setErrorMsg(res.error || 'Failed to record deposit.');
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between border-b-2 border-amber-200 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-600 text-white flex items-center justify-center">
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
            Inpatient Advance Deposits &amp; Financial Ledger ({deposits.length})
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
            Total Advance: ₹{totalAdvance.toLocaleString('en-IN')}
          </span>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setShowAddModal(true);
          }}
          className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-7 px-2.5 print:hidden"
        >
          <Plus className="w-3.5 h-3.5" /> Collect Advance / Deposit
        </Button>
      </div>

      {deposits.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          No advance deposits collected for this admission yet. Click &quot;Collect Advance / Deposit&quot; to issue a payment receipt.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Receipt No</th>
                <th className="px-3 py-3">Date &amp; Time</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Mode</th>
                <th className="px-3 py-3 text-right">Amount (₹)</th>
                <th className="px-3 py-3">Collected By</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deposits.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{d.receiptNo}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {d.createdAt ? new Date(d.createdAt).toLocaleString('en-IN') : 'N/A'}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.type === 'REFUND'
                          ? 'bg-rose-100 text-rose-800'
                          : d.type === 'TOP_UP'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {d.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700 font-medium">{d.paymentMethod}</td>
                  <td className="px-3 py-3 text-right font-black text-slate-900">
                    {d.type === 'REFUND' ? '-' : ''}₹{d.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{d.collectedBy || 'Cashier'}</td>
                  <td className="px-4 py-3 text-slate-500 italic text-[11px]">
                    {d.notes || d.transactionRef || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Collect Deposit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" /> Collect Inpatient Advance Deposit
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Deposit Type</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'ADVANCE' | 'TOP_UP' | 'REFUND')}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs"
                  >
                    <option value="ADVANCE">Initial Admission Advance</option>
                    <option value="TOP_UP">Intermediate Top-Up Deposit</option>
                    <option value="REFUND">Refund / Settlement Credit</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Amount (₹) *</Label>
                  <Input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Payment Mode</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs"
                  >
                    <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Card">Debit / Credit Card POS</option>
                    <option value="Bank Transfer">NEFT / RTGS / IMPS</option>
                    <option value="TPA Insurance">TPA Cashless Pre-Auth</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Reference / UTR Number</Label>
                  <Input
                    placeholder="e.g. UPI-9988220011"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Cashier Notes / Remarks</Label>
                <Input
                  placeholder="e.g. Collected during admission at Semi-Private Ward"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                  Issue Deposit Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
