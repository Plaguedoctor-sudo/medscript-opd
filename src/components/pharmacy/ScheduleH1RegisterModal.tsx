'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill, ShieldCheck, AlertCircle, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { ScheduleH1Record } from '@/types';
import { recordScheduleH1Action, getScheduleH1RegisterAction } from '@/app/actions/schedule-h1-actions';
import { SCHEDULE_H1_DRUG_NAMES } from '@/lib/pharmacy/schedule-h1';

interface ScheduleH1RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecords: ScheduleH1Record[];
  pharmacistName: string;
}

export function ScheduleH1RegisterModal({
  isOpen,
  onClose,
  initialRecords,
  pharmacistName,
}: ScheduleH1RegisterModalProps) {
  const [records, setRecords] = useState<ScheduleH1Record[]>(initialRecords);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [patientName, setPatientName] = useState('');
  const [patientContact, setPatientContact] = useState('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('Dr. Nitin Sonare');
  const [prescribingDoctorRegNo, setPrescribingDoctorRegNo] = useState('MCI-994821');
  const [drugName, setDrugName] = useState(SCHEDULE_H1_DRUG_NAMES[0]);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('2028-12');
  const [quantity, setQuantity] = useState('10');
  const [unit, setUnit] = useState('TABLETS');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !patientContact || !batchNumber) return;

    startTransition(async () => {
      const res = await recordScheduleH1Action({
        dispenseDate: new Date(),
        patientName,
        patientContact,
        prescribingDoctorName: prescribingDoctor,
        prescribingDoctorRegNo,
        drugName,
        batchNumber,
        expiryDate,
        quantityDispensed: Number(quantity),
        unit,
        dispensedByPharmacist: pharmacistName,
      });

      if (res.success) {
        setFeedback('Schedule H1 statutory dispensation recorded with HMAC digital seal.');
        const updated = await getScheduleH1RegisterAction();
        if (updated.success) {
          setRecords(updated.records);
        }
        setIsAddOpen(false);
        setPatientName('');
        setPatientContact('');
        setBatchNumber('');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback(`Error: ${res.error}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <DialogTitle className="text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-rose-400" />
                Schedule H1 & Controlled Narcotics Statutory Register
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Statutory audit register mandated by Indian Drugs & Cosmetics Rules (Rule 65) with Section 65B digital integrity seals
              </DialogDescription>
            </div>

            <Button
              size="sm"
              onClick={() => setIsAddOpen(!isAddOpen)}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Log Dispensation
            </Button>
          </div>
        </DialogHeader>

        {feedback && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Add Dispensation Form */}
        {isAddOpen && (
          <form onSubmit={handleRecord} className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Record Schedule H1 Prescription Dispensation
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-slate-400">Patient Full Name*</Label>
                <Input
                  placeholder="e.g. Ramesh Patel"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Patient Phone Contact*</Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={patientContact}
                  onChange={(e) => setPatientContact(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Schedule H1 Drug*</Label>
                <select
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white"
                >
                  {SCHEDULE_H1_DRUG_NAMES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] text-slate-400">Batch Number*</Label>
                <Input
                  placeholder="e.g. B-77481"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Expiry (YYYY-MM)</Label>
                <Input
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Doctor Reg No*</Label>
                <Input
                  value={prescribingDoctorRegNo}
                  onChange={(e) => setPrescribingDoctorRegNo(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs"
              >
                Sign & Record in Register
              </Button>
            </div>
          </form>
        )}

        {/* Register Table */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Patient Name & Phone</th>
                <th className="p-2.5">Drug Dispensed</th>
                <th className="p-2.5">Batch / Expiry</th>
                <th className="p-2.5">Qty</th>
                <th className="p-2.5">Doctor & Reg No</th>
                <th className="p-2.5">Pharmacist</th>
                <th className="p-2.5 text-right">Digital Seal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                    No Schedule H1 controlled drugs logged yet.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">
                      {r.dispenseDate.toLocaleDateString()}
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-white">{r.patientName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{r.patientContact}</div>
                    </td>
                    <td className="p-2.5 font-bold text-rose-300">{r.drugName}</td>
                    <td className="p-2.5 text-slate-300 font-mono text-[11px]">
                      {r.batchNumber} (Exp: {r.expiryDate})
                    </td>
                    <td className="p-2.5 text-white font-mono">{r.quantityDispensed} {r.unit}</td>
                    <td className="p-2.5 text-slate-300">
                      <div>{r.prescribingDoctorName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{r.prescribingDoctorRegNo}</div>
                    </td>
                    <td className="p-2.5 text-slate-400 text-[11px]">{r.dispensedByPharmacist}</td>
                    <td className="p-2.5 text-right">
                      <span className="font-mono text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60" title={r.verifiedSeal}>
                        SEALED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
