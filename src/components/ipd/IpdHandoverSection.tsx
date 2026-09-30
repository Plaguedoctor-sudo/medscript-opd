'use client';

/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Inpatient Shift & Round Handover System
 * Supports structured Clinical Round Handovers (Doctors) and Shift-to-Shift Handovers (Nurses).
 * Enables seamless inpatient visibility across shifts with explicit doctor and nurse attribution.
 */

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  Stethoscope,
  HeartPulse,
  Clock,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  ListTodo,
  ShieldAlert,
  Loader2,
  Sun,
  Sunset,
  Moon,
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
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { IpdHandover, IpdHandoverType } from '@/types';
import { addIpdHandoverAction, deleteIpdHandoverAction } from '@/app/ipd/actions';
import { formatDateTime } from '@/lib/utils';

interface IpdHandoverSectionProps {
  admissionId: number;
  patientId: number;
  patientName: string;
  initialHandovers: IpdHandover[];
  userRole?: string;
  currentStaffName?: string;
  attendingDoctorName?: string;
}

export function IpdHandoverSection({
  admissionId,
  patientId,
  patientName,
  initialHandovers,
  userRole,
  currentStaffName,
  attendingDoctorName,
}: IpdHandoverSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [handovers, setHandovers] = useState<IpdHandover[]>(initialHandovers);

  // Filter: 'ALL' | 'DOCTOR_ROUND' | 'NURSING_SHIFT'
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal form state
  const [isOpen, setIsOpen] = useState(false);
  const [handoverType, setHandoverType] = useState<IpdHandoverType>('NURSING_SHIFT');
  const [shift, setShift] = useState<string>('Morning');
  const [outgoingStaffName, setOutgoingStaffName] = useState('');
  const [incomingStaffName, setIncomingStaffName] = useState('');
  const [patientCondition, setPatientCondition] = useState('Stable');
  const [vitalsSummary, setVitalsSummary] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [activeTreatmentOrders, setActiveTreatmentOrders] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  const [specialPrecautions, setSpecialPrecautions] = useState('');
  const [handoverDate, setHandoverDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  const isDoctor = userRole === 'admin_doctor' || userRole === 'doctor';

  const filteredHandovers = handovers.filter((h) => {
    if (filterType === 'ALL') return true;
    return h.handoverType === filterType;
  });

  const handleOpenAdd = (type: IpdHandoverType) => {
    setHandoverType(type);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setHandoverDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);

    if (type === 'DOCTOR_ROUND') {
      setShift('Day Round');
      setOutgoingStaffName(attendingDoctorName || currentStaffName || 'Dr. Attending Physician');
      setIncomingStaffName('Dr. On-Call / Next Round Physician');
      setSummaryNotes('Patient evaluated during daily clinical round. Course stable, responding to ongoing medical management.');
      setActiveTreatmentOrders('Continue current IV antibiotic & fluid schedule. Titrate medications based on evening vitals.');
      setPendingTasks('Review pending blood culture & electrolyte reports.');
      setSpecialPrecautions('Strict intake/output tracking; keep head of bed elevated 30 degrees.');
    } else {
      const hour = now.getHours();
      const currentShift = hour >= 7 && hour < 14 ? 'Morning' : hour >= 14 && hour < 21 ? 'Evening' : 'Night';
      setShift(currentShift);
      setOutgoingStaffName(currentStaffName || (userRole === 'nurse' ? 'Sister Priya Nair' : 'Staff Nurse'));
      setIncomingStaffName('Relieving Staff Nurse');
      setSummaryNotes('Patient condition stable. Medication administered as per eMAR. Surgical sites dry and dressings intact.');
      setActiveTreatmentOrders('Next scheduled dose: Inj Ceftriaxone 1g IV at 06:00 PM.');
      setPendingTasks('Check evening blood sugar & drain volume output before shift change.');
      setSpecialPrecautions('Call bell within reach, fall risk precaution active.');
    }

    setVitalsSummary('BP: 120/80 mmHg, Pulse: 76 bpm, Temp: 37.0 °C, SpO2: 98%');
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryNotes.trim()) {
      toast.show({ title: 'Validation Error', description: 'Clinical summary and handover assessment are required.', type: 'error' });
      return;
    }
    if (!outgoingStaffName.trim() || !incomingStaffName.trim()) {
      toast.show({ title: 'Validation Error', description: 'Both outgoing and incoming clinician names are required.', type: 'error' });
      return;
    }

    const outgoingRole = handoverType === 'DOCTOR_ROUND' ? 'DOCTOR' : 'NURSE';

    startTransition(async () => {
      const res = await addIpdHandoverAction({
        admissionId,
        patientId,
        handoverType,
        shift,
        handoverDate,
        outgoingStaffName,
        outgoingStaffRole: outgoingRole,
        incomingStaffName,
        patientCondition,
        vitalsSummary,
        summaryNotes,
        activeTreatmentOrders,
        pendingTasks,
        specialPrecautions,
      });

      if (res.success && res.id) {
        const newRecord: IpdHandover = {
          id: res.id,
          admissionId,
          patientId,
          handoverType,
          shift,
          handoverDate: new Date(handoverDate),
          outgoingStaffName,
          outgoingStaffRole: outgoingRole,
          incomingStaffName,
          patientCondition,
          vitalsSummary,
          summaryNotes,
          activeTreatmentOrders,
          pendingTasks,
          specialPrecautions,
          createdAt: new Date(),
        };
        setHandovers((prev) => [newRecord, ...prev]);
        setIsOpen(false);
        toast.show({
          title: 'Handover Logged',
          description: `${handoverType === 'DOCTOR_ROUND' ? 'Doctor Round' : 'Nursing Shift'} handover saved successfully.`,
          type: 'success',
        });
        router.refresh();
      } else {
        toast.show({ title: 'Failed to Save', description: res.error || 'Server error occurred.', type: 'error' });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this clinical handover record?')) return;
    startTransition(async () => {
      const res = await deleteIpdHandoverAction(id, admissionId);
      if (res.success) {
        setHandovers((prev) => prev.filter((h) => h.id !== id));
        toast.show({ title: 'Handover Removed', description: 'Record deleted from inpatient file.', type: 'info' });
        router.refresh();
      } else {
        toast.show({ title: 'Error', description: res.error || 'Could not delete handover.', type: 'error' });
      }
    });
  };

  const getShiftBadge = (shiftName: string) => {
    switch (shiftName) {
      case 'Morning':
      case 'Day Round':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Sun className="w-3 h-3 text-amber-600" /> {shiftName}
          </span>
        );
      case 'Evening':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Sunset className="w-3 h-3 text-sky-600" /> Evening
          </span>
        );
      case 'Night':
      case 'Night On-Call':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Moon className="w-3 h-3 text-indigo-600" /> {shiftName}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <Clock className="w-3 h-3" /> {shiftName}
          </span>
        );
    }
  };

  const getConditionBadge = (c: string) => {
    switch (c) {
      case 'Critical':
        return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">CRITICAL ⚠</span>;
      case 'Guarded':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">GUARDED</span>;
      case 'Improving':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">IMPROVING</span>;
      case 'Post-Op':
        return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">POST-OP</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">STABLE</span>;
    }
  };

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-indigo-200 pb-3 mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-700 text-white flex items-center justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
              Inpatient Clinical &amp; Nursing Shift Handover ({handovers.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Shift-to-shift handover notes for attending doctors &amp; bedside nurses. Open visibility across healthcare teams.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {isDoctor && (
            <Button
              size="sm"
              onClick={() => handleOpenAdd('DOCTOR_ROUND')}
              className="h-7 text-xs bg-indigo-700 hover:bg-indigo-800 text-white gap-1 font-semibold shadow-2xs"
            >
              <Stethoscope className="w-3.5 h-3.5" /> + Doctor Round Handover
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleOpenAdd('NURSING_SHIFT')}
            className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1 font-semibold shadow-2xs"
          >
            <HeartPulse className="w-3.5 h-3.5" /> + Nursing Shift Handover
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 print:hidden">
        <button
          type="button"
          onClick={() => setFilterType('ALL')}
          className={`text-[11px] px-3 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Handovers ({handovers.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('DOCTOR_ROUND')}
          className={`text-[11px] px-3 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'DOCTOR_ROUND' ? 'bg-indigo-800 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
          }`}
        >
          Doctor Rounds ({handovers.filter((h) => h.handoverType === 'DOCTOR_ROUND').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('NURSING_SHIFT')}
          className={`text-[11px] px-3 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'NURSING_SHIFT' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
          }`}
        >
          Nursing Shifts ({handovers.filter((h) => h.handoverType === 'NURSING_SHIFT').length})
        </button>
      </div>

      {/* Handovers List */}
      {filteredHandovers.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          No shift or round handovers recorded yet. Use the buttons above to transfer patient responsibility with complete clinical notes.
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHandovers.map((h) => {
            const isDoc = h.handoverType === 'DOCTOR_ROUND';

            return (
              <div
                key={h.id}
                className={`p-4 rounded-xl border transition-all ${
                  isDoc
                    ? 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50'
                    : 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/50'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        isDoc ? 'bg-indigo-700 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isDoc ? <Stethoscope className="w-3.5 h-3.5" /> : <HeartPulse className="w-3.5 h-3.5" />}
                      {isDoc ? 'Attending Doctor Round Handover' : 'Nursing Shift Handover'}
                    </span>

                    {getShiftBadge(h.shift)}
                    {getConditionBadge(h.patientCondition)}

                    <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {h.handoverDate ? formatDateTime(h.handoverDate) : 'N/A'}
                    </span>
                  </div>

                  {(userRole === 'admin_doctor' || userRole === 'doctor' || userRole === 'nurse') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(h.id)}
                      className="h-6 w-6 text-slate-400 hover:text-red-600 print:hidden"
                      title="Delete handover note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {/* Handover Clinician Attribution Banner */}
                <div className="bg-white/80 border border-slate-200 rounded-lg p-2.5 mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      Handing Over:
                    </span>
                    <span className="font-bold text-slate-900">
                      {isDoc
                        ? h.outgoingStaffName.startsWith('Dr.')
                          ? h.outgoingStaffName
                          : `Dr. ${h.outgoingStaffName}`
                        : `Nurse ${h.outgoingStaffName}`}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                      Outgoing
                    </span>
                  </div>

                  <ArrowRightLeft className="w-4 h-4 text-slate-400 hidden sm:block" />

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      Taking Over:
                    </span>
                    <span className="font-bold text-indigo-900">
                      {isDoc
                        ? h.incomingStaffName.startsWith('Dr.')
                          ? h.incomingStaffName
                          : `Dr. ${h.incomingStaffName}`
                        : `Nurse ${h.incomingStaffName}`}
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-semibold">
                      Incoming
                    </span>
                  </div>
                </div>

                {/* Vitals summary if present */}
                {h.vitalsSummary && (
                  <div className="mb-2 text-xs bg-white/60 p-2 rounded-md border border-slate-200 font-mono text-slate-800">
                    <span className="font-sans font-bold text-slate-700 text-[11px] mr-2">Vitals Summary:</span>
                    {h.vitalsSummary}
                  </div>
                )}

                {/* Clinical Summary Notes */}
                <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed mb-2.5">
                  <span className="font-bold text-slate-900 block mb-0.5">Clinical Assessment &amp; Shift Notes:</span>
                  {h.summaryNotes}
                </div>

                {/* Treatment Orders */}
                {h.activeTreatmentOrders && (
                  <div className="mt-2 pt-2 border-t border-slate-200/80 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">Active Treatment Orders &amp; Medication Plan: </span>
                    <span>{h.activeTreatmentOrders}</span>
                  </div>
                )}

                {/* Pending Tasks & Precautions Grid */}
                {(h.pendingTasks || h.specialPrecautions) && (
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {h.pendingTasks && (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-md p-2 text-amber-900">
                        <span className="font-bold flex items-center gap-1 text-[11px] mb-0.5">
                          <ListTodo className="w-3.5 h-3.5 text-amber-600" /> Pending Action Tasks:
                        </span>
                        <p className="text-[11px] whitespace-pre-wrap">{h.pendingTasks}</p>
                      </div>
                    )}

                    {h.specialPrecautions && (
                      <div className="bg-rose-50/70 border border-rose-200 rounded-md p-2 text-rose-900">
                        <span className="font-bold flex items-center gap-1 text-[11px] mb-0.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Special Precautions &amp; Alerts:
                        </span>
                        <p className="text-[11px] whitespace-pre-wrap">{h.specialPrecautions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Handover Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold ${
                    handoverType === 'DOCTOR_ROUND' ? 'bg-indigo-700' : 'bg-rose-600'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Record {handoverType === 'DOCTOR_ROUND' ? 'Doctor Round' : 'Nursing Shift'} Handover
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Transfer clinical responsibility for {patientName} with structured assessment and pending tasks.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Type and Shift selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Handover Scope</Label>
                  <select
                    value={handoverType}
                    onChange={(e) => setHandoverType(e.target.value as IpdHandoverType)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                  >
                    {isDoctor && <option value="DOCTOR_ROUND">Doctor Round Handover</option>}
                    <option value="NURSING_SHIFT">Nursing Shift Handover</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Shift</Label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-900"
                  >
                    <option value="Morning">Morning Shift (08:00 - 14:00)</option>
                    <option value="Evening">Evening Shift (14:00 - 20:00)</option>
                    <option value="Night">Night Shift (20:00 - 08:00)</option>
                    <option value="Day Round">Day Consultant Round</option>
                    <option value="Night On-Call">Night Emergency On-Call</option>
                  </select>
                </div>
              </div>

              {/* Clinicians attribution */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-800">
                    Outgoing Clinician Name *
                  </Label>
                  <Input
                    value={outgoingStaffName}
                    onChange={(e) => setOutgoingStaffName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh or Nurse Priya"
                    required
                    className="h-8 text-xs font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Clinician handing over shift</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-indigo-900">
                    Incoming Clinician Name *
                  </Label>
                  <Input
                    value={incomingStaffName}
                    onChange={(e) => setIncomingStaffName(e.target.value)}
                    placeholder="e.g. Dr. On-Call or Nurse Sunita"
                    required
                    className="h-8 text-xs font-bold bg-white text-indigo-950"
                  />
                  <span className="text-[10px] text-slate-400">Clinician accepting responsibility</span>
                </div>
              </div>

              {/* Patient Condition and Vitals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Patient Clinical Condition</Label>
                  <select
                    value={patientCondition}
                    onChange={(e) => setPatientCondition(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="Stable">Stable</option>
                    <option value="Improving">Improving</option>
                    <option value="Guarded">Guarded</option>
                    <option value="Critical">Critical / ICU Watch</option>
                    <option value="Post-Op">Post-Operative Recovery</option>
                    <option value="Discharge Ready">Discharge Ready</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Exact Date &amp; Time *</Label>
                  <Input
                    type="datetime-local"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    required
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Current Vitals Summary</Label>
                <Input
                  value={vitalsSummary}
                  onChange={(e) => setVitalsSummary(e.target.value)}
                  placeholder="BP: 120/80 mmHg, Pulse: 76 bpm, Temp: 37.0 °C, SpO2: 98%"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Clinical Assessment */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Clinical Summary &amp; Shift Assessment *
                </Label>
                <textarea
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                  placeholder="Comprehensive clinical status, response to treatment, active complaints, IV site condition..."
                  rows={3}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Treatment Orders */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Active Treatment Orders &amp; Medication Plan</Label>
                <textarea
                  value={activeTreatmentOrders}
                  onChange={(e) => setActiveTreatmentOrders(e.target.value)}
                  placeholder="Ongoing IV fluids, infusion rate, scheduled antibiotic timings, sliding scale..."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Pending Tasks & Precautions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Pending Tasks for Incoming Shift</Label>
                  <textarea
                    value={pendingTasks}
                    onChange={(e) => setPendingTasks(e.target.value)}
                    placeholder="Check pending labs, change catheter bag at 6pm, review evening CBC..."
                    rows={2}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Special Precautions &amp; Critical Watchouts</Label>
                  <textarea
                    value={specialPrecautions}
                    onChange={(e) => setSpecialPrecautions(e.target.value)}
                    placeholder="Fall risk, strict NPO, allergic to penicillin, titrate O2 for SpO2 > 94%..."
                    rows={2}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold gap-1.5"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Handover
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
