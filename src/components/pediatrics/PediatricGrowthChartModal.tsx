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
import { TrendingUp, Plus, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { PediatricGrowthRecord } from '@/types';
import { saveGrowthRecordAction, getPatientGrowthRecordsAction } from '@/app/actions/pediatric-actions';

interface PediatricGrowthChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  gender: 'Male' | 'Female' | 'Other';
  initialRecords: PediatricGrowthRecord[];
  curves: { weight: any[]; height: any[] };
  doctorName: string;
}

export function PediatricGrowthChartModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  gender,
  initialRecords,
  curves,
  doctorName,
}: PediatricGrowthChartModalProps) {
  const [records, setRecords] = useState<PediatricGrowthRecord[]>(initialRecords);
  const [activeTab, setActiveTab] = useState<'weight' | 'height'>('weight');
  const [isPending, startTransition] = useTransition();

  // Form State
  const [ageMonths, setAgeMonths] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCircumference, setHeadCircumference] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSaveMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ageMonths || !weightKg || !heightCm) return;

    startTransition(async () => {
      const res = await saveGrowthRecordAction({
        patientId,
        gender,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        heightCm: Number(heightCm),
        headCircumferenceCm: headCircumference ? Number(headCircumference) : undefined,
        notes,
        doctorName,
      });

      if (res.success) {
        setFeedback('Milestone logged successfully with WHO Z-scores.');
        // Refresh records
        const updated = await getPatientGrowthRecordsAction(patientId);
        if (updated.success && updated.records) {
          setRecords(updated.records);
        }
        setAgeMonths('');
        setWeightKg('');
        setHeightCm('');
        setHeadCircumference('');
        setNotes('');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback(`Error: ${res.error}`);
      }
    });
  };

  const curveData = activeTab === 'weight' ? curves.weight : curves.height;
  const maxAge = 60;
  const maxY = activeTab === 'weight' ? 26 : 125;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            WHO Pediatric Growth Chart & Z-Scores — {patientName}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Standard WHO Child Growth Percentiles (0 to 5 Years) for {gender} Child
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mt-2">
          <Button
            type="button"
            variant={activeTab === 'weight' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('weight')}
            className={`text-xs ${activeTab === 'weight' ? 'bg-indigo-600 text-white' : 'border-slate-700 text-slate-300'}`}
          >
            Weight-for-Age (kg)
          </Button>
          <Button
            type="button"
            variant={activeTab === 'height' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('height')}
            className={`text-xs ${activeTab === 'height' ? 'bg-indigo-600 text-white' : 'border-slate-700 text-slate-300'}`}
          >
            Height-for-Age (cm)
          </Button>
        </div>

        {/* SVG Growth Chart */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 relative">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-2">
            <span>Y: {activeTab === 'weight' ? 'Weight (kg)' : 'Height (cm)'}</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-rose-400" /> +2 SD (97.7th %)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-emerald-400" /> Median (50th %)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-rose-400" /> -2 SD (2.3rd %)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Patient Points</span>
            </div>
            <span>X: Age (Months)</span>
          </div>

          <svg viewBox="0 0 600 300" className="w-full h-56 overflow-visible">
            {/* Grid Lines */}
            {[0, 12, 24, 36, 48, 60].map((age) => (
              <line
                key={`grid-x-${age}`}
                x1={(age / maxAge) * 560 + 30}
                y1={10}
                x2={(age / maxAge) * 560 + 30}
                y2={270}
                stroke="#1e293b"
                strokeWidth="1"
              />
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => (
              <line
                key={`grid-y-${idx}`}
                x1={30}
                y1={270 - frac * 260}
                x2={590}
                y2={270 - frac * 260}
                stroke="#1e293b"
                strokeWidth="1"
              />
            ))}

            {/* WHO Curve lines (+2SD, Median, -2SD) */}
            {curveData.length > 1 && (
              <>
                {/* Plus 2SD */}
                <path
                  d={curveData.reduce((acc, p, idx) => {
                    const x = (p.ageMonths / maxAge) * 560 + 30;
                    const y = 270 - (p.plus2SD / maxY) * 260;
                    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#fb7185"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                {/* Median */}
                <path
                  d={curveData.reduce((acc, p, idx) => {
                    const x = (p.ageMonths / maxAge) * 560 + 30;
                    const y = 270 - (p.median / maxY) * 260;
                    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                />
                {/* Minus 2SD */}
                <path
                  d={curveData.reduce((acc, p, idx) => {
                    const x = (p.ageMonths / maxAge) * 560 + 30;
                    const y = 270 - (p.minus2SD / maxY) * 260;
                    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#fb7185"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              </>
            )}

            {/* Patient Plotted Circles */}
            {records.map((r, i) => {
              const val = activeTab === 'weight' ? r.weightKg : r.heightCm;
              const x = (r.ageMonths / maxAge) * 560 + 30;
              const y = 270 - (val / maxY) * 260;
              return (
                <g key={`pt-${i}`}>
                  <circle cx={x} cy={y} r="5" fill="#818cf8" stroke="#ffffff" strokeWidth="1.5" />
                  <text x={x} y={y - 8} fill="#c7d2fe" fontSize="9" textAnchor="middle">
                    {val} ({r.ageMonths}m)
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Form to log new milestone */}
        <form onSubmit={handleSaveMilestone} className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-indigo-400" /> Log Clinical Milestone
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-[11px] text-slate-400">Age (Months)*</Label>
              <Input
                type="number"
                placeholder="e.g. 12"
                value={ageMonths}
                onChange={(e) => setAgeMonths(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                required
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Weight (kg)*</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 9.8"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                required
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Height (cm)*</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 76.5"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                required
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Head Circ (cm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 46"
                value={headCircumference}
                onChange={(e) => setHeadCircumference(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-slate-400">Clinical Developmental Notes</Label>
            <Input
              placeholder="e.g. Walking independently, pincer grasp established."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            {feedback && (
              <span className="text-xs text-emerald-400 font-medium">{feedback}</span>
            )}
            <Button
              type="submit"
              disabled={isPending}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs ml-auto"
            >
              Save Milestone & Compute Z-Score
            </Button>
          </div>
        </form>

        {/* Milestone Log Table */}
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Milestone History & Z-Score Assessment ({records.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Age</th>
                  <th className="p-2.5">Weight (kg)</th>
                  <th className="p-2.5">Height (cm)</th>
                  <th className="p-2.5">BMI</th>
                  <th className="p-2.5">Weight Z-Score</th>
                  <th className="p-2.5">Height Z-Score</th>
                  <th className="p-2.5">Percentiles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                      No pediatric growth records yet.
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-400">{r.recordedAt.toLocaleDateString()}</td>
                      <td className="p-2.5 font-bold text-white">{r.ageMonths} mo</td>
                      <td className="p-2.5 text-slate-200">{r.weightKg} kg</td>
                      <td className="p-2.5 text-slate-200">{r.heightCm} cm</td>
                      <td className="p-2.5 text-slate-200">{r.bmi}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                          r.weightForAgeZScore < -2 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {r.weightForAgeZScore}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                          r.heightForAgeZScore < -2 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {r.heightForAgeZScore}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                        W: {r.percentileWeight}% | H: {r.percentileHeight}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
