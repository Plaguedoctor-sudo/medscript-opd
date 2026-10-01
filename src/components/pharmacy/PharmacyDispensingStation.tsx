'use client';

import React, { useState, useTransition } from 'react';
import {
  Pill,
  CheckCircle2,
  Clock,
  Search,
  Printer,
  AlertCircle,
  PackageCheck,
  Stethoscope,
  Bed,
  FileText,
  History,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PendingPrescriptionItem,
  PendingIpdRoundItem,
  dispensePrescriptionMedications,
} from '@/app/pharmacy/actions';
import { DispensedItem, PrescriptionDispensation } from '@/types';
import Link from 'next/link';

interface PharmacyDispensingStationProps {
  initialPrescriptions: PendingPrescriptionItem[];
  initialIpdRounds: PendingIpdRoundItem[];
  initialHistory: PrescriptionDispensation[];
  stats: {
    totalPending: number;
    dispensedToday: number;
    totalPrescriptions: number;
  };
  currentUserRole: string;
  currentUserName?: string;
}

export function PharmacyDispensingStation({
  initialPrescriptions,
  initialIpdRounds,
  initialHistory,
  stats: initialStats,
  currentUserRole,
  currentUserName,
}: PharmacyDispensingStationProps) {
  const [activeTab, setActiveTab] = useState<'opd' | 'ipd' | 'history'>('opd');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DISPENSED'>('PENDING');

  // Dispense modal state
  const [selectedRx, setSelectedRx] = useState<PendingPrescriptionItem | null>(null);
  const [selectedRound, setSelectedRound] = useState<PendingIpdRoundItem | null>(null);
  const [dispenseItems, setDispenseItems] = useState<DispensedItem[]>([]);
  const [dispenseRemarks, setDispenseRemarks] = useState('');
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print slip state
  const [printSlip, setPrintSlip] = useState<{
    id: number | string;
    patientName: string;
    doctorName?: string | null;
    items: DispensedItem[];
    dispensedAt: string;
    dispensedBy: string;
  } | null>(null);

  // Filtered lists
  const filteredPrescriptions = initialPrescriptions.filter((rx) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      rx.patientName.toLowerCase().includes(q) ||
      (rx.patientPhone && rx.patientPhone.includes(q)) ||
      String(rx.prescriptionId).includes(q) ||
      (rx.doctorName && rx.doctorName.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (statusFilter === 'PENDING') return rx.dispensationStatus === 'PENDING';
    if (statusFilter === 'DISPENSED') return rx.dispensationStatus === 'DISPENSED';
    return true;
  });

  const filteredRounds = initialIpdRounds.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.patientName.toLowerCase().includes(q) ||
      r.bedName.toLowerCase().includes(q) ||
      r.treatmentOrders.toLowerCase().includes(q)
    );
  });

  const handleOpenDispenseRx = (rx: PendingPrescriptionItem) => {
    setSelectedRx(rx);
    setSelectedRound(null);
    setDispenseRemarks('');
    // Prepopulate items from prescribed medications
    const items: DispensedItem[] = (rx.medications || []).map((med) => {
      // Parse quantity recommendation or default based on duration
      let defaultQty = 10;
      if (med.duration) {
        const days = parseInt(med.duration, 10);
        if (!isNaN(days)) defaultQty = Math.max(1, days * 2);
      }
      return {
        medicationName: `${med.prefix || ''} ${med.name}`.trim(),
        strength: med.strength || '',
        dosage: med.dosage || '',
        duration: med.duration || '',
        quantityDispensed: defaultQty,
        batchNo: '',
        instructions: med.instruction || `${med.timing || ''} • ${med.duration || ''}`,
      };
    });
    setDispenseItems(items);
    setIsDispenseModalOpen(true);
  };

  const handleOpenDispenseRound = (round: PendingIpdRoundItem) => {
    setSelectedRound(round);
    setSelectedRx(null);
    setDispenseRemarks('');
    // Split lines from doctor treatment orders
    const lines = round.treatmentOrders.split('\n').filter((l) => l.trim().length > 0);
    const items: DispensedItem[] = lines.map((line) => ({
      medicationName: line.trim(),
      quantityDispensed: 1,
      batchNo: '',
      instructions: 'Administer per doctor IPD round order',
    }));
    setDispenseItems(items);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = () => {
    if (dispenseItems.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'No items selected to dispense.' });
      return;
    }

    startTransition(async () => {
      const res = await dispensePrescriptionMedications({
        prescriptionId: selectedRx ? selectedRx.prescriptionId : undefined,
        admissionId: selectedRound ? selectedRound.admissionId : undefined,
        patientId: selectedRx ? selectedRx.patientId : selectedRound!.patientId,
        dispensationType: selectedRx ? 'OPD_PRESCRIPTION' : 'IPD_ROUND_MEDICATION',
        items: dispenseItems,
        remarks: dispenseRemarks,
      });

      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Medications successfully dispatched! Dispensation Record #${res.dispensationId}`,
        });
        // Prepare printable slip
        setPrintSlip({
          id: res.dispensationId || Date.now(),
          patientName: selectedRx ? selectedRx.patientName : selectedRound!.patientName,
          doctorName: selectedRx ? selectedRx.doctorName : selectedRound?.doctorOrStaff,
          items: dispenseItems,
          dispensedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dispensedBy: currentUserName || 'Hospital Pharmacist',
        });
        setIsDispenseModalOpen(false);
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to dispatch medications.' });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Hospital Pharmacy & Drug Dispensing
              </span>
              <span className="text-xs text-slate-400">Offline Sovereign Terminal</span>
              {currentUserName && (
                <span className="text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  Dispenser: {currentUserName} ({currentUserRole})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2.5">
              <Pill className="w-6 h-6 text-emerald-400" />
              Pharmacist Drug Dispensing Station
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Verify doctor prescriptions and inpatient round treatment orders, validate drug batches, and dispatch medications directly to patients and ward nurses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/inventory">
              <Button variant="outline" size="sm" className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs gap-1.5">
                <PackageCheck className="w-4 h-4 text-emerald-400" /> Pharmacy Inventory & Stock
              </Button>
            </Link>
          </div>
        </div>

        {/* Real-time KPI Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Pending Orders</div>
              <div className="text-2xl font-mono font-black text-amber-400 mt-0.5">{initialStats.totalPending}</div>
            </div>
            <Clock className="w-7 h-7 text-amber-400/50" />
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Dispensed Today</div>
              <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">{initialStats.dispensedToday}</div>
            </div>
            <CheckCircle2 className="w-7 h-7 text-emerald-400/50" />
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Prescriptions</div>
              <div className="text-2xl font-mono font-black text-blue-400 mt-0.5">{initialStats.totalPrescriptions}</div>
            </div>
            <FileText className="w-7 h-7 text-blue-400/50" />
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Printable Dispensing Slip Preview Banner */}
      {printSlip && (
        <Card className="border-2 border-emerald-500 bg-emerald-50/50 shadow-md">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Medication Dispatch Slip #{printSlip.id} Ready</div>
                <div className="text-xs text-slate-600">
                  Patient: <span className="font-semibold text-slate-800">{printSlip.patientName}</span> • Dispensed by: {printSlip.dispensedBy} at {printSlip.dispensedAt}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs w-full sm:w-auto"
              >
                <Printer className="w-3.5 h-3.5" /> Print Patient Drug Label / Slip
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPrintSlip(null)}
                className="text-xs text-slate-500"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('opd')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'opd'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" /> OPD Prescriptions Queue
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {initialPrescriptions.filter((p) => p.dispensationStatus === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ipd')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'ipd'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Bed className="w-3.5 h-3.5" /> IPD Inpatient Rounds
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-mono">
              {initialIpdRounds.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Dispensation Audit Trail
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, phone, Rx#..."
              className="pl-8 h-8 text-xs bg-white"
            />
          </div>

          {activeTab === 'opd' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-700 font-semibold"
            >
              <option value="PENDING">Pending Only</option>
              <option value="DISPENSED">Dispensed Only</option>
              <option value="ALL">All Statuses</option>
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: OPD Prescriptions Queue */}
      {activeTab === 'opd' && (
        <div className="space-y-4">
          {filteredPrescriptions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-slate-800">No Prescriptions Matching Filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                All prescribed medications are either already dispensed or match query returned zero items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredPrescriptions.map((rx) => {
                const isDispensed = rx.dispensationStatus === 'DISPENSED';
                return (
                  <Card key={rx.id} className={`border transition-all ${isDispensed ? 'border-slate-200 bg-slate-50/50' : 'border-emerald-200/90 hover:border-emerald-300 shadow-xs'}`}>
                    <CardHeader className="p-4 pb-2.5 flex flex-row items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            Rx #{rx.prescriptionId}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isDispensed
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isDispensed ? 'DISPENSED' : 'PENDING DISPENSE'}
                          </span>
                        </div>
                        <h3 className="font-black text-slate-900 text-base mt-1 flex items-center gap-1.5">
                          {rx.patientName}
                          <span className="text-xs font-normal text-slate-500">
                            ({rx.patientAge}y • {rx.patientGender})
                          </span>
                        </h3>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Doctor: <span className="font-semibold text-slate-700">{rx.doctorName || 'Dr. Sonare'}</span>
                          {rx.patientPhone && ` • Tel: ${rx.patientPhone}`}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <Link href={`/prescription/${rx.prescriptionId}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 gap-1 px-2">
                            <FileText className="w-3.5 h-3.5" /> View Rx
                          </Button>
                        </Link>
                        {!isDispensed ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenDispenseRx(rx)}
                            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                          >
                            <Pill className="w-3.5 h-3.5" /> Dispense Drugs
                          </Button>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Dispensed by {rx.dispensedBy}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1">
                      {rx.patientAllergies && (
                        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-2 text-xs font-semibold mb-2.5 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>ALLERGY ALERT: {rx.patientAllergies}</span>
                        </div>
                      )}

                      {rx.diagnosis && (
                        <div className="text-xs text-slate-600 mb-2 font-medium">
                          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Diagnosis:</span> {rx.diagnosis}
                        </div>
                      )}

                      {/* Prescribed Medications Table */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider grid grid-cols-12">
                          <div className="col-span-5">Medication & Strength</div>
                          <div className="col-span-4">Dosage & Timing</div>
                          <div className="col-span-3 text-right">Duration</div>
                        </div>
                        <div className="divide-y divide-slate-100 text-xs">
                          {rx.medications.map((m, idx) => (
                            <div key={idx} className="px-3 py-2 grid grid-cols-12 items-center hover:bg-slate-50/50">
                              <div className="col-span-5 font-semibold text-slate-900">
                                {m.prefix && <span className="text-slate-400 mr-1">{m.prefix}</span>}
                                {m.name}
                                {m.strength && <span className="text-xs font-normal text-slate-500 ml-1.5">({m.strength})</span>}
                              </div>
                              <div className="col-span-4 text-slate-600">
                                {m.dosage} • {m.timing}
                              </div>
                              <div className="col-span-3 text-right font-mono text-slate-700 font-medium">
                                {m.duration}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IPD Inpatient Rounds */}
      {activeTab === 'ipd' && (
        <div className="space-y-4">
          {filteredRounds.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Bed className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-slate-800">No Active Inpatient Medication Orders</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No pending treatment orders from doctor clinical rounds in IPD at this moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredRounds.map((round) => (
                <Card key={round.roundId} className="border border-purple-200 shadow-xs hover:border-purple-300">
                  <CardHeader className="p-4 pb-2.5 flex flex-row items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {round.bedName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Round Date: {new Date(round.roundDate).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-black text-slate-900 text-base mt-1">
                        {round.patientName}
                      </h3>
                      <div className="text-[11px] text-slate-500">
                        Attending: <span className="font-semibold text-slate-700">{round.doctorOrStaff}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleOpenDispenseRound(round)}
                      className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                    >
                      <Pill className="w-3.5 h-3.5" /> Dispense to Ward
                    </Button>
                  </CardHeader>

                  <CardContent className="p-4 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Doctor Treatment & Medication Orders:
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {round.treatmentOrders}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Dispensation Audit Trail */}
      {activeTab === 'history' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" /> Recent Medication Dispensation Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {initialHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No dispensation logs recorded yet.</div>
              ) : (
                initialHistory.map((h) => (
                  <div key={h.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          DISP #{h.id}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {h.dispensationType === 'OPD_PRESCRIPTION' ? 'OPD Prescription' : 'IPD Ward Round'}
                        </span>
                        {h.prescriptionId && (
                          <Link href={`/prescription/${h.prescriptionId}`} className="text-indigo-600 font-semibold text-[11px] hover:underline">
                            (View Rx #{h.prescriptionId})
                          </Link>
                        )}
                      </div>
                      <div className="mt-1 text-slate-800 font-semibold">
                        {h.items.length} Medications Dispatched:
                        <span className="font-normal text-slate-600 ml-1.5">
                          {h.items.map((it) => `${it.medicationName} (${it.quantityDispensed})`).join(', ')}
                        </span>
                      </div>
                      {h.remarks && <div className="text-[11px] text-slate-500 italic mt-0.5">Remarks: {h.remarks}</div>}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1 sm:justify-end">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {h.dispensedBy}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {new Date(h.dispensedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: Dispense Medication Dialog */}
      <Dialog open={isDispenseModalOpen} onOpenChange={setIsDispenseModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-emerald-600" /> Dispense & Dispatch Medications
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confirm batch numbers and quantities to dispense. This updates pharmacy inventory and logs the pharmacist dispatch record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="font-bold text-slate-800">
                Patient: {selectedRx ? selectedRx.patientName : selectedRound?.patientName}
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                {selectedRx ? `Prescription #${selectedRx.prescriptionId} by ${selectedRx.doctorName || 'Doctor'}` : `IPD Bed: ${selectedRound?.bedName} • ${selectedRound?.doctorOrStaff}`}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">Drugs to Dispense:</div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-600 grid grid-cols-12 text-[10px] uppercase">
                  <div className="col-span-5">Drug Name</div>
                  <div className="col-span-3">Batch No (Opt)</div>
                  <div className="col-span-2">Qty Dispensed</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {dispenseItems.map((item, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <div className="font-bold text-slate-900">{item.medicationName}</div>
                      {item.instructions && <div className="text-[10px] text-slate-500">{item.instructions}</div>}
                    </div>

                    <div className="col-span-3">
                      <Input
                        value={item.batchNo || ''}
                        onChange={(e) => {
                          const updated = [...dispenseItems];
                          updated[idx].batchNo = e.target.value.toUpperCase();
                          setDispenseItems(updated);
                        }}
                        placeholder="Batch #"
                        className="h-7 text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantityDispensed}
                        onChange={(e) => {
                          const updated = [...dispenseItems];
                          updated[idx].quantityDispensed = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setDispenseItems(updated);
                        }}
                        className="h-7 text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="col-span-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDispenseItems(dispenseItems.filter((_, i) => i !== idx));
                        }}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Pharmacist Notes / Dispensing Instructions:</label>
              <Input
                value={dispenseRemarks}
                onChange={(e) => setDispenseRemarks(e.target.value)}
                placeholder="e.g. Advised to take with milk; take before food; counseling done"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsDispenseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending || dispenseItems.length === 0}
              onClick={handleConfirmDispense}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isPending ? 'Dispatching...' : 'Confirm & Dispatch Medication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
