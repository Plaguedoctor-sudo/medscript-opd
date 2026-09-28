'use client';

import React, { useState } from 'react';
import {
  Calculator,
  Baby,
  Activity,
  HeartPulse,
  X,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { calculateBmi, calculatePediatricDosage, calculateCrCl } from '@/lib/vitals-calculator';
import { toast } from '@/components/ui/toast';

interface ClinicalCalculatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeight?: string;
  initialHeight?: string;
  patientAge?: number;
  patientGender?: string;
  onApplyCalculations?: (text: string) => void;
}

export function ClinicalCalculatorsModal({
  isOpen,
  onClose,
  initialWeight,
  initialHeight,
  patientAge,
  patientGender = 'Male',
  onApplyCalculations,
}: ClinicalCalculatorsModalProps) {
  const [activeTab, setActiveTab] = useState<'pediatric' | 'bmi' | 'renal'>('pediatric');

  // Pediatric state
  const [pedWeight, setPedWeight] = useState(initialWeight || '12');
  const [pedDoseMgKg, setPedDoseMgKg] = useState('15'); // Standard Paracetamol 15mg/kg
  const [pedFreq, setPedFreq] = useState('3'); // TDS
  const [syrupConcMg, setSyrupConcMg] = useState('120'); // 120mg / 5ml or 250mg / 5ml
  const [syrupVolMl, setSyrupVolMl] = useState('5');

  // BMI state
  const [bmiWeight, setBmiWeight] = useState(initialWeight || '65');
  const [bmiHeight, setBmiHeight] = useState(initialHeight || '165');

  // Renal state
  const [renalAge, setRenalAge] = useState(patientAge ? String(patientAge) : '60');
  const [renalWeight, setRenalWeight] = useState(initialWeight || '65');
  const [renalCreatinine, setRenalCreatinine] = useState('1.1');
  const [renalGender, setRenalGender] = useState(patientGender);

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Compute pediatric
  const pedResult = calculatePediatricDosage({
    weightKg: parseFloat(pedWeight) || 0,
    doseMgPerKgPerDay: parseFloat(pedDoseMgKg) || 0,
    frequencyPerDay: parseInt(pedFreq, 10) || 1,
    syrupConcentrationMg: parseFloat(syrupConcMg) || undefined,
    syrupVolumeMl: parseFloat(syrupVolMl) || 5,
  });

  // Compute BMI
  const bmiResult = calculateBmi(bmiWeight, bmiHeight);

  // Compute CrCl
  const crClResult = calculateCrCl({
    ageYears: parseInt(renalAge, 10) || 0,
    weightKg: parseFloat(renalWeight) || 0,
    serumCreatinineMgDl: parseFloat(renalCreatinine) || 0,
    gender: renalGender,
  });

  const handleCopyOrApply = (text: string) => {
    if (onApplyCalculations) {
      onApplyCalculations(text);
      toast.show({
        title: 'Inserted into Advice',
        description: text,
        type: 'success',
      });
      onClose();
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.show({
        title: 'Copied to Clipboard',
        description: text,
        type: 'success',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calculator className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Clinical Dose & Renal Calculators</h2>
              <p className="text-xs text-emerald-100">Weight-based dosing, BMI staging, and CrCl renal function</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('pediatric')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'pediatric'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Baby className="w-4 h-4" /> Pediatric Dosing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bmi')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'bmi'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" /> BMI & Weight Staging
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('renal')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'renal'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HeartPulse className="w-4 h-4" /> Renal CrCl (Cockcroft)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Pediatric Tab */}
          {activeTab === 'pediatric' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Child Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={pedWeight}
                    onChange={(e) => setPedWeight(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Dose (mg/kg/day)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={pedDoseMgKg}
                    onChange={(e) => setPedDoseMgKg(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Frequency</Label>
                  <select
                    value={pedFreq}
                    onChange={(e) => setPedFreq(e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-slate-300 bg-white"
                  >
                    <option value="1">Once Daily (OD)</option>
                    <option value="2">Twice Daily (BD)</option>
                    <option value="3">Three Times (TDS)</option>
                    <option value="4">Four Times (QID)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Syrup Strength (mg)</Label>
                  <Input
                    type="number"
                    value={syrupConcMg}
                    onChange={(e) => setSyrupConcMg(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Per Volume (mL)</Label>
                  <Input
                    type="number"
                    value={syrupVolMl}
                    onChange={(e) => setSyrupVolMl(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Result Card */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Recommended Pediatric Dose
                </div>
                <div className="text-2xl font-black text-emerald-950">
                  {pedResult.mlPerDose ? `${pedResult.mlPerDose} mL per dose` : `${pedResult.mgPerDose} mg per dose`}
                </div>
                <div className="text-xs text-emerald-700">
                  Total Daily: <strong>{pedResult.totalMgPerDay} mg/day</strong> &nbsp;|&nbsp; Frequency:{' '}
                  <strong>{pedFreq} doses/day</strong>
                </div>
                <p className="text-xs text-slate-600 bg-white/70 p-2 rounded border border-emerald-100 font-mono">
                  {pedResult.description}
                </p>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => handleCopyOrApply(`Pediatric Dose: ${pedResult.description}`)}
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs mt-2"
                >
                  <Copy className="w-3.5 h-3.5" /> Insert into Clinical Advice
                </Button>
              </div>
            </div>
          )}

          {/* 2. BMI Tab */}
          {activeTab === 'bmi' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bmiWeight}
                    onChange={(e) => setBmiWeight(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Height (cm)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={bmiHeight}
                    onChange={(e) => setBmiHeight(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              {bmiResult ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 font-semibold uppercase">Computed BMI</div>
                      <div className="text-3xl font-black text-slate-900">{bmiResult.bmi} kg/m²</div>
                    </div>
                    <span
                      className={`text-xs px-3 py-1.5 rounded-full font-bold border ${bmiResult.badgeColor}`}
                    >
                      {bmiResult.categoryLabel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 border-t pt-2 space-y-1">
                    <div>
                      <strong>Asian-Indian Cutoffs:</strong> Normal: 18.5–22.9 | Overweight: 23–24.9 | Obese: &ge; 25
                    </div>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() =>
                      handleCopyOrApply(
                        `BMI: ${bmiResult.bmi} kg/m² (${bmiResult.categoryLabel}). Height: ${bmiHeight}cm, Weight: ${bmiWeight}kg.`
                      )
                    }
                    className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" /> Insert into Clinical Advice
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6 text-slate-400 text-xs">
                  Please enter valid weight and height values.
                </div>
              )}
            </div>
          )}

          {/* 3. Renal Tab */}
          {activeTab === 'renal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Patient Age (years)</Label>
                  <Input
                    type="number"
                    value={renalAge}
                    onChange={(e) => setRenalAge(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Gender</Label>
                  <select
                    value={renalGender}
                    onChange={(e) => setRenalGender(e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-slate-300 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Weight (kg)</Label>
                  <Input
                    type="number"
                    value={renalWeight}
                    onChange={(e) => setRenalWeight(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Serum Creatinine (mg/dL)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={renalCreatinine}
                    onChange={(e) => setRenalCreatinine(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              {crClResult && (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    crClResult.isImpaired
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Estimated CrCl (Cockcroft-Gault)
                    </span>
                    {crClResult.isImpaired && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                        <AlertTriangle className="w-3 h-3" /> Renal Dose Adjustment Needed
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-black">{crClResult.crCl} mL/min</div>
                  <p className="text-xs font-medium">{crClResult.staging}</p>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() =>
                      handleCopyOrApply(
                        `Estimated Creatinine Clearance (Cockcroft-Gault): ${crClResult.crCl} mL/min. ${crClResult.staging}.`
                      )
                    }
                    className="w-full gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs mt-2"
                  >
                    <Copy className="w-3.5 h-3.5" /> Insert into Clinical Advice
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
