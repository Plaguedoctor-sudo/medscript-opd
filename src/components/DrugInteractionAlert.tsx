'use client';

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, CheckCircle, Info } from 'lucide-react';
import { DrugInteraction, InteractionSeverity } from '@/lib/drug-interactions';

interface DrugInteractionAlertProps {
  interactions: DrugInteraction[];
}

export function DrugInteractionAlert({ interactions }: DrugInteractionAlertProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!interactions || interactions.length === 0) {
    return null;
  }

  const hasCritical = interactions.some((i) => i.severity === 'CRITICAL');
  const hasHigh = interactions.some((i) => i.severity === 'HIGH');

  const bannerColor = hasCritical
    ? 'bg-rose-50 border-rose-300 text-rose-950'
    : hasHigh
    ? 'bg-amber-50 border-amber-300 text-amber-950'
    : 'bg-blue-50 border-blue-200 text-blue-950';

  const badgeColor: Record<InteractionSeverity, string> = {
    CRITICAL: 'bg-rose-600 text-white font-bold',
    HIGH: 'bg-amber-600 text-white font-bold',
    MODERATE: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
    CAUTION: 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold',
  };

  return (
    <div
      className={`rounded-xl border shadow-sm my-4 overflow-hidden transition-all ${bannerColor}`}
    >
      {/* Header bar */}
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg ${
              hasCritical
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-amber-500 text-white'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">
                Clinical Drug Interaction Alert
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-white/80 shadow-2xs border border-current">
                {interactions.length} {interactions.length === 1 ? 'Interaction' : 'Interactions'} Found
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              Review prescribed medications for pharmacological contraindications and dose adjustments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAcknowledged(!acknowledged)}
            className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors flex items-center gap-1 ${
              acknowledged
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-white/80 text-slate-700 hover:bg-white border-slate-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {acknowledged ? 'Reviewed & Monitored' : 'Mark Reviewed'}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-600"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Interaction Cards */}
      {isExpanded && (
        <div className="p-3.5 pt-0 space-y-2.5">
          {interactions.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColor[item.severity]}`}>
                    {item.severity}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {item.drugA} <span className="text-slate-400 font-normal">↔</span> {item.drugB}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-700">
                  {item.title}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-700">Mechanism: </span>
                {item.mechanism}
              </p>

              <div className="p-2 bg-slate-50 rounded border border-slate-100 text-xs text-slate-800 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-900">Clinical Action: </span>
                  {item.recommendation}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
