'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Send, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';
import { issueSpecialistReferralAction } from '@/app/actions/referral-actions';

interface ReferralLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  patientAgeGender: string;
  patientPhone?: string;
  doctorName: string;
  doctorRegNo: string;
  initialDiagnosis?: string;
  initialVitals?: string;
  initialMeds?: string;
}

export function ReferralLetterModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientAgeGender,
  patientPhone,
  doctorName,
  doctorRegNo,
  initialDiagnosis = '',
  initialVitals = '',
  initialMeds = '',
}: ReferralLetterModalProps) {
  const [targetSpecialty, setTargetSpecialty] = useState('Cardiology / Interventional Cath Lab');
  const [targetHospital, setTargetHospital] = useState('Apex Super Specialty Hospital & Trauma Center');
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('URGENT');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState(initialDiagnosis || 'Acute Coronary Syndrome');
  const [clinicalSummary, setClinicalSummary] = useState('Patient presented with retrosternal chest pain radiating to left arm with diaphoresis.');
  const [vitals, setVitals] = useState(initialVitals || 'BP: 150/95 mmHg, HR: 104 bpm, SpO2: 95% on room air');
  const [meds, setMeds] = useState(initialMeds || 'Tab Aspirin 325mg stat, Tab Clopidogrel 300mg stat, Tab Atorvastatin 80mg');
  const [investigations, setInvestigations] = useState('ECG: ST elevation in leads V1-V4. Trop-I: Positive.');
  const [reason, setReason] = useState('Immediate coronary angiography, primary PCI, and CCU monitoring.');
  const [isPending, startTransition] = useTransition();
  const [issuedSeal, setIssuedSeal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSpecialty || !targetHospital || !provisionalDiagnosis) return;

    startTransition(async () => {
      const res = await issueSpecialistReferralAction({
        patientId,
        patientName,
        patientAgeGender,
        patientPhone,
        urgency,
        referringDoctorName: doctorName,
        referringDoctorRegNo: doctorRegNo,
        targetSpecialty,
        targetHospitalOrDoctor: targetHospital,
        provisionalDiagnosis,
        clinicalSummary,
        vitalSigns: vitals,
        currentMedications: meds,
        relevantInvestigations: investigations,
        reasonForReferral: reason,
      });

      if (res.success && res.digitalSeal) {
        setIssuedSeal(res.digitalSeal);
      } else {
        setError(res.error || 'Failed to issue referral letter');
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Specialist Tertiary Referral Letter — {patientName}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Formulate a formal clinical transfer letter with tamper-evident HMAC digital physician seal
          </DialogDescription>
        </DialogHeader>

        {issuedSeal ? (
          <div className="p-6 rounded-xl bg-slate-950/80 border border-emerald-900/60 text-slate-100 space-y-4 print:p-0">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white uppercase">Specialist Referral Note</h3>
                <span className="text-xs text-rose-400 font-semibold uppercase">Urgency: {urgency}</span>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Ref Doctor: {doctorName} ({doctorRegNo})</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div><span className="text-slate-400">Patient:</span> <span className="font-semibold text-white">{patientName}</span></div>
              <div><span className="text-slate-400">Age/Gender:</span> <span className="text-white">{patientAgeGender}</span></div>
              <div><span className="text-slate-400">Referred To:</span> <span className="text-indigo-300 font-semibold">{targetSpecialty}</span></div>
              <div><span className="text-slate-400">Facility:</span> <span className="text-white">{targetHospital}</span></div>
            </div>

            <div className="text-xs space-y-2">
              <div><span className="text-slate-400 font-semibold block">Provisional Diagnosis:</span> <span className="text-rose-300 font-medium">{provisionalDiagnosis}</span></div>
              <div><span className="text-slate-400 font-semibold block">Clinical Summary:</span> <p className="text-slate-200 mt-0.5">{clinicalSummary}</p></div>
              <div><span className="text-slate-400 font-semibold block">Vital Signs at Transfer:</span> <span className="text-slate-200">{vitals}</span></div>
              <div><span className="text-slate-400 font-semibold block">Emergency Medications Administered:</span> <span className="text-slate-200">{meds}</span></div>
              <div><span className="text-slate-400 font-semibold block">Relevant Diagnostics / Labs:</span> <span className="text-slate-200">{investigations}</span></div>
              <div><span className="text-slate-400 font-semibold block">Reason for Referral:</span> <span className="text-amber-300">{reason}</span></div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[11px]">
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Digital Seal: {issuedSeal.slice(0, 16)}...
              </span>
              <span className="text-slate-400">Attending Physician: {doctorName}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Referral Note
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIssue} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-300">Target Specialist Department*</Label>
                <Input
                  value={targetSpecialty}
                  onChange={(e) => setTargetSpecialty(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Transfer Urgency</Label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                >
                  <option value="ROUTINE">ROUTINE</option>
                  <option value="URGENT">URGENT</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-300">Target Hospital / Specialist Clinic*</Label>
              <Input
                value={targetHospital}
                onChange={(e) => setTargetHospital(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-800 text-xs text-white"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-slate-300">Provisional Diagnosis*</Label>
              <Input
                value={provisionalDiagnosis}
                onChange={(e) => setProvisionalDiagnosis(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-800 text-xs text-white font-medium"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-slate-300">Clinical Summary & History</Label>
              <textarea
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-300">Vital Signs</Label>
                <Input
                  value={vitals}
                  onChange={(e) => setVitals(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Active / Stat Medications</Label>
                <Input
                  value={meds}
                  onChange={(e) => setMeds(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-300">Reason for Tertiary Transfer*</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-800 text-xs text-white"
                required
              />
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                Sign & Issue Sealed Referral
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
