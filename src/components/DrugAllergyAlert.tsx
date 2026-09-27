'use client';

import { useState } from 'react';
import { ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AllergyConflict } from '@/lib/allergy-checker';

interface DrugAllergyAlertProps {
  conflicts: AllergyConflict[];
  onRemoveMedication?: (medicationName: string) => void;
}

export function DrugAllergyAlert({
  conflicts,
  onRemoveMedication,
}: DrugAllergyAlertProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-rose-500 bg-rose-50/90 shadow-md my-4 overflow-hidden transition-all text-rose-950">
      {/* Header bar */}
      <div className="p-3.5 flex items-center justify-between gap-3 bg-rose-100/80 border-b border-rose-300">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-600 text-white animate-pulse">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-rose-900">
                🚨 CRITICAL DRUG-ALLERGY CONTRAINDICATION
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-rose-600 text-white shadow-xs">
                {conflicts.length} {conflicts.length === 1 ? 'Conflict' : 'Conflicts'} Detected
              </span>
            </div>
            <p className="text-xs text-rose-800 font-medium mt-0.5">
              Prescribed medications cross-react with patient&apos;s documented allergy profile!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-rose-900 hover:bg-rose-200/60 h-8 px-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" /> Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" /> View Conflicts
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Conflict List */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {conflicts.map((conflict, index) => (
            <div
              key={index}
              className="bg-white/95 border border-rose-300 rounded-xl p-3.5 shadow-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black tracking-wide">
                    {conflict.severity} ALLERGY RISK
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    Patient Allergen: <strong className="text-rose-700 underline">{conflict.allergen}</strong>
                  </span>
                  <span className="text-xs text-slate-400">⚡</span>
                  <span className="text-xs font-bold text-slate-900">
                    Prescribed Drug: <strong className="text-rose-800 font-black">{conflict.matchedMedication}</strong>
                  </span>
                </div>

                {onRemoveMedication && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveMedication(conflict.matchedMedication)}
                    className="h-7 text-xs bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:text-rose-900 gap-1 px-2.5 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove {conflict.matchedMedication}
                  </Button>
                )}
              </div>

              <div className="text-xs text-slate-700 space-y-1 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                <div className="text-[11px] font-semibold text-rose-900">
                  <strong>Hypersensitivity Mechanism: </strong>
                  {conflict.mechanism}
                </div>
                <div className="text-[11px] font-semibold text-emerald-800">
                  <strong>Clinical Recommendation: </strong>
                  {conflict.recommendation}
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2 border-t border-rose-200/80 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-rose-800 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Prescribing contraindicated allergens poses immediate anaphylaxis liability.
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAcknowledged(!acknowledged)}
              className={`h-7 text-xs font-semibold ${
                acknowledged
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {acknowledged ? 'Overridden with Justification' : 'Acknowledge Risk & Override'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
