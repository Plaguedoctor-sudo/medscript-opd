'use client';

/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */

import React, { useState, useTransition } from 'react';
import {
  Droplets,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Calendar,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Activity,
  FileSpreadsheet,
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
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { FluidBalanceRecord, FluidEntryType, FluidRoute, FluidShift } from '@/types';
import { addFluidBalanceAction, deleteFluidBalanceAction } from '@/app/ipd/actions';
import { formatDateTime, formatTime, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface InputOutputChartSectionProps {
  admissionId: number;
  initialRecords: FluidBalanceRecord[];
  userRole?: string;
  defaultNurseName?: string;
}

const INTAKE_PRESETS = [
  { name: 'Normal Saline 0.9%', route: 'IV_INFUSION', vol: 500 },
  { name: 'Ringer Lactate (RL)', route: 'IV_INFUSION', vol: 500 },
  { name: 'Dextrose Normal Saline (DNS)', route: 'IV_INFUSION', vol: 500 },
  { name: 'Dextrose 5% (D5W)', route: 'IV_INFUSION', vol: 500 },
  { name: 'Oral Water / Tea', route: 'ORAL', vol: 200 },
  { name: 'Oral ORS Solution', route: 'ORAL', vol: 250 },
  { name: 'Ryles Tube Enteral Feed', route: 'RT_FEED', vol: 200 },
  { name: 'Packed Red Blood Cells (PRBC)', route: 'BLOOD', vol: 350 },
  { name: 'IV Antibiotic / Medication Infusion', route: 'MEDICATION_DILUTION', vol: 100 },
];

const OUTPUT_PRESETS = [
  { name: 'Urine (Foley Catheter)', route: 'URINE', vol: 300, appearance: 'Clear Amber' },
  { name: 'Urine (Spontaneous Void)', route: 'URINE', vol: 250, appearance: 'Straw Yellow' },
  { name: 'Vomitus / Gastric Aspirate', route: 'VOMIT', vol: 150, appearance: 'Bilious / Green' },
  { name: 'Ryles Tube Aspirate', route: 'VOMIT', vol: 100, appearance: 'Clear Gastric' },
  { name: 'Surgical Wound Drain', route: 'DRAIN', vol: 80, appearance: 'Serosanguinous' },
  { name: 'Chest Tube Drainage', route: 'DRAIN', vol: 120, appearance: 'Hemorrhagic / Dark' },
  { name: 'Stool / Diarrhea', route: 'STOOL', vol: 200, appearance: 'Watery' },
];

export function InputOutputChartSection({
  admissionId,
  initialRecords,
  userRole,
  defaultNurseName = 'Staff Nurse',
}: InputOutputChartSectionProps) {
  const router = useRouter();
  const [records, setRecords] = useState<FluidBalanceRecord[]>(initialRecords);
  const [isPending, startTransition] = useTransition();

  // Filter state: 'ALL' | 'TODAY' | 'MORNING' | 'EVENING' | 'NIGHT'
  const [filterShift, setFilterShift] = useState<string>('ALL');

  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [entryType, setEntryType] = useState<FluidEntryType>('INTAKE');
  const [route, setRoute] = useState<string>('IV_INFUSION');
  const [fluidName, setFluidName] = useState('');
  const [volumeMl, setVolumeMl] = useState<string>('500');
  const [shift, setShift] = useState<FluidShift>('MORNING');
  const [recordedAt, setRecordedAt] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [appearance, setAppearance] = useState('');
  const [notes, setNotes] = useState('');

  // Calculations
  const filteredRecords = records.filter((r) => {
    if (filterShift === 'ALL') return true;
    if (filterShift === 'TODAY') {
      const todayStr = new Date().toDateString();
      return new Date(r.recordedAt).toDateString() === todayStr;
    }
    return r.shift === filterShift;
  });

  const totalIntake = filteredRecords
    .filter((r) => r.entryType === 'INTAKE')
    .reduce((sum, r) => sum + (Number(r.volumeMl) || 0), 0);

  const totalOutput = filteredRecords
    .filter((r) => r.entryType === 'OUTPUT')
    .reduce((sum, r) => sum + (Number(r.volumeMl) || 0), 0);

  const netBalance = totalIntake - totalOutput;

  // Intake breakdown
  const ivIntake = filteredRecords
    .filter((r) => r.entryType === 'INTAKE' && (r.route === 'IV_INFUSION' || r.route === 'MEDICATION_DILUTION' || r.route === 'BLOOD'))
    .reduce((sum, r) => sum + (Number(r.volumeMl) || 0), 0);
  const oralIntake = totalIntake - ivIntake;

  // Output breakdown
  const urineOutput = filteredRecords
    .filter((r) => r.entryType === 'OUTPUT' && r.route === 'URINE')
    .reduce((sum, r) => sum + (Number(r.volumeMl) || 0), 0);
  const otherOutput = totalOutput - urineOutput;

  const handleOpenAdd = (type: FluidEntryType) => {
    setEntryType(type);
    if (type === 'INTAKE') {
      setRoute('IV_INFUSION');
      setFluidName('Normal Saline 0.9%');
      setVolumeMl('500');
      setAppearance('');
    } else {
      setRoute('URINE');
      setFluidName('Urine (Foley Catheter)');
      setVolumeMl('250');
      setAppearance('Clear Amber');
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setRecordedAt(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);

    // Auto-select shift based on hour
    const hour = now.getHours();
    if (hour >= 8 && hour < 14) setShift('MORNING');
    else if (hour >= 14 && hour < 20) setShift('EVENING');
    else setShift('NIGHT');

    setNotes('');
    setIsOpen(true);
  };

  const handlePresetSelect = (preset: { name: string; route: string; vol: number; appearance?: string }) => {
    setFluidName(preset.name);
    setRoute(preset.route);
    setVolumeMl(String(preset.vol));
    if (preset.appearance) setAppearance(preset.appearance);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vol = parseFloat(volumeMl);
    if (!fluidName.trim() || isNaN(vol) || vol <= 0) {
      toast.show({
        title: 'Invalid Input',
        description: 'Please specify fluid name and positive volume in mL.',
        type: 'error',
      });
      return;
    }

    startTransition(async () => {
      const res = await addFluidBalanceAction({
        admissionId,
        entryType,
        route,
        fluidName,
        volumeMl: vol,
        shift,
        recordedAt,
        appearance: appearance || undefined,
        notes: notes || undefined,
      });

      if (res.success && res.id) {
        const newRecord: FluidBalanceRecord = {
          id: res.id,
          admissionId,
          entryType,
          route,
          fluidName,
          volumeMl: vol,
          shift,
          recordedAt: new Date(recordedAt),
          nurseName: defaultNurseName,
          role: userRole || 'NURSE',
          appearance: appearance || null,
          notes: notes || null,
          createdAt: new Date(),
        };
        setRecords((prev) => [newRecord, ...prev]);
        setIsOpen(false);
        toast.show({
          title: `${entryType === 'INTAKE' ? 'Fluid Intake' : 'Fluid Output'} Logged`,
          description: `${vol} mL of ${fluidName} recorded with exact timestamp.`,
          type: 'success',
        });
        router.refresh();
      } else {
        toast.show({
          title: 'Failed to Save Entry',
          description: res.error || 'Server error occurred.',
          type: 'error',
        });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this fluid balance entry?')) return;
    startTransition(async () => {
      const res = await deleteFluidBalanceAction(id, admissionId);
      if (res.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        toast.show({
          title: 'Entry Deleted',
          description: 'Fluid balance entry removed from clinical record.',
          type: 'success',
        });
        router.refresh();
      } else {
        toast.show({
          title: 'Deletion Failed',
          description: res.error || 'Server error',
          type: 'error',
        });
      }
    });
  };

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-cyan-200 pb-3 mb-4 gap-3">
        <div>
          <h2 className="text-sm font-bold text-cyan-950 uppercase tracking-wider flex items-center gap-2">
            <Droplets className="w-4 h-4 text-cyan-600" /> Inpatient Fluid Balance & Input / Output (I/O) Chart
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            24-Hour fluid intake surveillance, urine output tracking, drainage, and cumulative hydration balance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 print:hidden">
          <Button
            size="sm"
            onClick={() => handleOpenAdd('INTAKE')}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-xs"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" /> + Record Intake (In)
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenAdd('OUTPUT')}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs shadow-xs"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" /> + Record Output (Out)
          </Button>
        </div>
      </div>

      {/* Fluid Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Card 1: Total Intake */}
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4 text-blue-600" /> Total Intake (In)
            </span>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              {filteredRecords.filter((r) => r.entryType === 'INTAKE').length} entries
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-900 font-mono">
              {totalIntake.toLocaleString('en-IN')} <span className="text-sm font-semibold text-blue-600">mL</span>
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-blue-200/60 text-[11px] text-blue-800 flex justify-between">
            <span>IV / Parenteral: <strong>{ivIntake} mL</strong></span>
            <span>Oral / RT: <strong>{oralIntake} mL</strong></span>
          </div>
        </div>

        {/* Card 2: Total Output */}
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpCircle className="w-4 h-4 text-amber-600" /> Total Output (Out)
            </span>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              {filteredRecords.filter((r) => r.entryType === 'OUTPUT').length} entries
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-900 font-mono">
              {totalOutput.toLocaleString('en-IN')} <span className="text-sm font-semibold text-amber-600">mL</span>
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-amber-200/60 text-[11px] text-amber-800 flex justify-between">
            <span>Urine: <strong>{urineOutput} mL</strong></span>
            <span>Drain / Vomit / Stool: <strong>{otherOutput} mL</strong></span>
          </div>
        </div>

        {/* Card 3: Net Fluid Balance */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            netBalance >= 0
              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
              : 'border-rose-200 bg-rose-50/50 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4" /> Net Fluid Balance
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                netBalance >= 0
                  ? 'bg-emerald-200/70 text-emerald-900'
                  : 'bg-rose-200/70 text-rose-900'
              }`}
            >
              {netBalance >= 0 ? '+ POSITIVE BALANCE' : '- NEGATIVE BALANCE'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono">
              {netBalance >= 0 ? `+${netBalance.toLocaleString('en-IN')}` : netBalance.toLocaleString('en-IN')}{' '}
              <span className="text-sm font-semibold">mL</span>
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-slate-200/60 text-[11px] font-medium opacity-90">
            {netBalance >= 0
              ? 'Intake exceeds output. Monitor for fluid retention or pulmonary overload.'
              : 'Output exceeds intake. Monitor for dehydration, hypotension, or oliguria.'}
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between mb-3 text-xs flex-wrap gap-2 print:hidden">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
          {[
            { id: 'ALL', label: 'All Records' },
            { id: 'TODAY', label: "Today's 24-Hour" },
            { id: 'MORNING', label: 'Morning (8AM-2PM)' },
            { id: 'EVENING', label: 'Evening (2PM-8PM)' },
            { id: 'NIGHT', label: 'Night (8PM-8AM)' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterShift(f.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                filterShift === f.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          Showing {filteredRecords.length} timestamped records
        </span>
      </div>

      {/* Records Table */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          No fluid intake or output logged for this selection. Use &quot;+ Record Intake&quot; or &quot;+ Record Output&quot; above to log fluid balance.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date & Exact Time</th>
                  <th className="py-2.5 px-2">Shift</th>
                  <th className="py-2.5 px-2">Type</th>
                  <th className="py-2.5 px-3">Route & Fluid / Source</th>
                  <th className="py-2.5 px-3 text-right">Volume</th>
                  <th className="py-2.5 px-3">Appearance / Remarks</th>
                  <th className="py-2.5 px-3">Recorded By</th>
                  <th className="py-2.5 px-2 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const isIntake = r.entryType === 'INTAKE';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date & Time */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDateTime(r.recordedAt)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: #{r.id}
                        </div>
                      </td>

                      {/* Shift Badge */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {r.shift}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        {isIntake ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <ArrowDownCircle className="w-3 h-3 text-blue-600" /> INTAKE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <ArrowUpCircle className="w-3 h-3 text-amber-600" /> OUTPUT
                          </span>
                        )}
                      </td>

                      {/* Route & Fluid Name */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{r.fluidName}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Route: <strong className="text-slate-700">{r.route.replace(/_/g, ' ')}</strong>
                        </div>
                      </td>

                      {/* Volume */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-xs">
                        <span className={isIntake ? 'text-blue-700 font-black' : 'text-amber-700 font-black'}>
                          {isIntake ? '+' : '-'}{r.volumeMl.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] font-normal text-slate-500">mL</span>
                        </span>
                      </td>

                      {/* Appearance / Notes */}
                      <td className="py-2.5 px-3">
                        {r.appearance && (
                          <div className="font-medium text-slate-800 text-[11px]">
                            {r.appearance}
                          </div>
                        )}
                        {r.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">
                            {r.notes}
                          </div>
                        )}
                        {!r.appearance && !r.notes && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Recorded By */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{r.nurseName}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span className="px-1 py-0.2 bg-slate-100 rounded text-[9px] font-bold text-slate-600">
                            {r.role || 'NURSE'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap print:hidden">
                        {(userRole === 'admin_doctor' || userRole === 'doctor' || userRole === 'nurse') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(r.id)}
                            className="h-6 w-6 text-slate-400 hover:text-red-600"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Fluid Balance Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {entryType === 'INTAKE' ? (
                  <>
                    <ArrowDownCircle className="w-4 h-4 text-blue-600" /> Log Fluid Intake (Input)
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-4 h-4 text-amber-600" /> Log Fluid Output (Loss / Drainage)
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Record exact fluid volume, route, clinical characteristics, and shift timestamp.
              </DialogDescription>
            </DialogHeader>

            {/* Quick Presets */}
            <div className="py-2 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Clinical Presets:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {(entryType === 'INTAKE' ? INTAKE_PRESETS : OUTPUT_PRESETS).map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium transition-colors text-left"
                  >
                    {p.name} ({p.vol} mL)
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 py-3 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAdd('INTAKE')}
                  className={`p-2 rounded-lg border text-center font-bold text-xs transition-all ${
                    entryType === 'INTAKE'
                      ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  💧 INTAKE (Input)
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAdd('OUTPUT')}
                  className={`p-2 rounded-lg border text-center font-bold text-xs transition-all ${
                    entryType === 'OUTPUT'
                      ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🚽 OUTPUT (Loss)
                </button>
              </div>

              {/* Route & Shift */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Route *</Label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-medium focus:ring-2 focus:ring-cyan-500"
                  >
                    {entryType === 'INTAKE' ? (
                      <>
                        <option value="IV_INFUSION">IV Infusion (Crystalloid / Colloid)</option>
                        <option value="ORAL">Oral (Fluids / Water / Beverages)</option>
                        <option value="RT_FEED">Ryles Tube (Enteral Feeding)</option>
                        <option value="BLOOD">Blood / Plasma / Transfusion</option>
                        <option value="MEDICATION_DILUTION">IV Medication Dilution</option>
                        <option value="OTHER">Other Route</option>
                      </>
                    ) : (
                      <>
                        <option value="URINE">Urine (Foley Catheter / Void)</option>
                        <option value="VOMIT">Vomitus / Gastric Aspirate</option>
                        <option value="DRAIN">Surgical Drain / Chest Tube</option>
                        <option value="STOOL">Stool / Loose Motion</option>
                        <option value="OTHER">Other Loss</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nursing Shift *</Label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as FluidShift)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-medium focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="MORNING">Morning Shift (08:00 - 14:00)</option>
                    <option value="EVENING">Evening Shift (14:00 - 20:00)</option>
                    <option value="NIGHT">Night Shift (20:00 - 08:00)</option>
                  </select>
                </div>
              </div>

              {/* Fluid Name & Volume */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Fluid Name / Source *</Label>
                  <Input
                    value={fluidName}
                    onChange={(e) => setFluidName(e.target.value)}
                    placeholder={entryType === 'INTAKE' ? 'e.g. Normal Saline 0.9%' : 'e.g. Urine (Foley Catheter)'}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Volume (mL) *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={volumeMl}
                    onChange={(e) => setVolumeMl(e.target.value)}
                    placeholder="500"
                    required
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quick Volume Adder Chips */}
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span className="font-semibold">Quick Add:</span>
                {[50, 100, 200, 250, 500, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVolumeMl(String(v))}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold"
                  >
                    {v}mL
                  </button>
                ))}
              </div>

              {/* Exact Date & Time Picker */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-600" /> Exact Recording Date & Time *
                </Label>
                <Input
                  type="datetime-local"
                  value={recordedAt}
                  onChange={(e) => setRecordedAt(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Accurate clinical timestamp is recorded for fluid balance shift reconciliation.
                </span>
              </div>

              {/* Appearance & Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Fluid Appearance / Color</Label>
                  <Input
                    value={appearance}
                    onChange={(e) => setAppearance(e.target.value)}
                    placeholder="e.g. Clear straw, Serosanguinous, Bilious"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Recording Staff</Label>
                  <Input
                    value={defaultNurseName}
                    disabled
                    className="h-8 text-xs bg-slate-50 text-slate-600 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Clinical Remarks (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Infused over 4 hrs; patient tolerated well without nausea"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className={`text-xs gap-1.5 text-white ${
                  entryType === 'INTAKE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {entryType === 'INTAKE' ? 'Save Intake Record' : 'Save Output Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
