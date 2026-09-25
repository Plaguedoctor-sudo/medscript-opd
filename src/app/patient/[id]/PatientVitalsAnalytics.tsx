'use client'

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Prescription } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  Activity,
  Heart,
  Scale,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Minus,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface VitalsAnalyticsProps {
  prescriptions: Prescription[];
  patientName: string;
}

interface VisitVitalPoint {
  id: number;
  visitIndex: number;
  date: string;
  rawDate: Date;
  bp: string | null;
  systolic: number | null;
  diastolic: number | null;
  weight: number | null;
  pulse: number | null;
  temp: number | null;
  spo2: number | null;
  diagnosis: string;
}

export function PatientVitalsAnalytics({ prescriptions, patientName }: VitalsAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'bp' | 'weight' | 'pulse_spo2' | 'temp' | 'flowsheet'>('bp');
  const [hoveredPoint, setHoveredPoint] = useState<VisitVitalPoint | null>(null);

  // Extract and sort chronological visits (oldest to newest)
  const visits: VisitVitalPoint[] = [...prescriptions]
    .filter((p) => p.createdAt)
    .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
    .map((p, idx) => {
      const bpMatch = (p.bp || '').match(/^(\d{2,3})\s*[\/\-]\s*(\d{2,3})$/);
      const systolic = bpMatch ? parseInt(bpMatch[1], 10) : null;
      const diastolic = bpMatch ? parseInt(bpMatch[2], 10) : null;

      const weightNum = p.weight ? parseFloat(p.weight.replace(/[^\d.]/g, '')) : null;
      const pulseNum = p.pulse ? parseInt(p.pulse.replace(/[^\d]/g, ''), 10) : null;
      const rawTempNum = p.temp ? parseFloat(p.temp.replace(/[^\d.]/g, '')) : null;
      const tempNum = rawTempNum !== null && !isNaN(rawTempNum)
        ? (rawTempNum > 50 ? parseFloat(((rawTempNum - 32) * 5 / 9).toFixed(1)) : parseFloat(rawTempNum.toFixed(1)))
        : null;
      const spo2Num = p.spo2 ? parseInt(p.spo2.replace(/[^\d]/g, ''), 10) : null;

      return {
        id: p.id,
        visitIndex: idx + 1,
        date: formatDate(p.createdAt),
        rawDate: new Date(p.createdAt!),
        bp: p.bp,
        systolic,
        diastolic,
        weight: weightNum && !isNaN(weightNum) ? weightNum : null,
        pulse: pulseNum && !isNaN(pulseNum) ? pulseNum : null,
        temp: tempNum && !isNaN(tempNum) ? tempNum : null,
        spo2: spo2Num && !isNaN(spo2Num) ? spo2Num : null,
        diagnosis: p.diagnosis || 'General Consultation',
      };
    });

  const visitsWithAnyVitals = visits.filter(
    (v) => v.systolic || v.weight || v.pulse || v.temp || v.spo2
  );

  if (visitsWithAnyVitals.length === 0) {
    return (
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-8 text-center text-slate-500">
          <Activity className="w-10 h-10 mx-auto mb-2 text-slate-400 opacity-60" />
          <h3 className="font-semibold text-slate-800 text-sm">No Vitals Recorded Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Vital signs (BP, Pulse, Weight, SpO2, Temperature) recorded during patient consultations will automatically generate longitudinal trend charts here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate Latest Vitals & Trend Deltas
  const latestBpVisit = [...visits].reverse().find((v) => v.systolic && v.diastolic);
  const prevBpVisit = [...visits].reverse().filter((v) => v.systolic && v.diastolic)[1];
  const bpDelta = latestBpVisit && prevBpVisit && latestBpVisit.systolic && prevBpVisit.systolic
    ? latestBpVisit.systolic - prevBpVisit.systolic
    : null;

  const latestWeightVisit = [...visits].reverse().find((v) => v.weight !== null);
  const firstWeightVisit = visits.find((v) => v.weight !== null);
  const weightDelta = latestWeightVisit && firstWeightVisit && latestWeightVisit.id !== firstWeightVisit.id && latestWeightVisit.weight && firstWeightVisit.weight
    ? Number((latestWeightVisit.weight - firstWeightVisit.weight).toFixed(1))
    : null;

  const latestPulseVisit = [...visits].reverse().find((v) => v.pulse !== null);
  const latestSpo2Visit = [...visits].reverse().find((v) => v.spo2 !== null);
  const latestTempVisit = [...visits].reverse().find((v) => v.temp !== null);

  // Helper to categorize BP
  const getBpCategory = (sys: number, dia: number) => {
    if (sys >= 140 || dia >= 90) return { label: 'Stage 2 HTN', color: 'bg-red-50 text-red-700 border-red-200' };
    if (sys >= 130 || dia >= 80) return { label: 'Stage 1 HTN', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (sys >= 120 && dia < 80) return { label: 'Elevated', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    return { label: 'Normal BP', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  // SVG Chart Geometry Helpers
  const width = 640;
  const height = 220;
  const padding = { left: 45, right: 35, top: 25, bottom: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const getX = (index: number, total: number) => {
    if (total <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (total - 1)) * plotWidth;
  };

  return (
    <Card className="border-slate-200 overflow-hidden shadow-sm">
      <CardHeader className="bg-slate-50/70 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-900">Vitals & Clinical Analytics</CardTitle>
              <p className="text-xs text-slate-500">
                Longitudinal progression for <span className="font-medium text-slate-700">{patientName}</span> across {visitsWithAnyVitals.length} {visitsWithAnyVitals.length === 1 ? 'consultation visit' : 'consultation visits'}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center bg-slate-200/80 p-1 rounded-lg gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('bp')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'bp' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Blood Pressure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('weight')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'weight' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weight
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pulse_spo2')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'pulse_spo2' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pulse & SpO2
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('temp')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'temp' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Temp
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('flowsheet')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'flowsheet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flowsheet
            </button>
          </div>
        </div>

        {/* Latest KPIs Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          {/* BP KPI */}
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Heart className="w-3.5 h-3.5 text-red-500" /> BP
              </span>
              {latestBpVisit?.systolic && latestBpVisit?.diastolic && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${getBpCategory(latestBpVisit.systolic, latestBpVisit.diastolic).color}`}>
                  {getBpCategory(latestBpVisit.systolic, latestBpVisit.diastolic).label}
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-slate-900">
              {latestBpVisit?.bp || '—'}
              <span className="text-[11px] font-normal text-slate-400 ml-1">mmHg</span>
            </div>
            {bpDelta !== null && (
              <div className="flex items-center gap-1 text-[11px] mt-0.5">
                {bpDelta < 0 ? (
                  <span className="text-emerald-600 flex items-center font-medium">
                    <TrendingDown className="w-3 h-3 mr-0.5" /> {Math.abs(bpDelta)} mmHg
                  </span>
                ) : bpDelta > 0 ? (
                  <span className="text-red-600 flex items-center font-medium">
                    <TrendingUp className="w-3 h-3 mr-0.5" /> +{bpDelta} mmHg
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center">
                    <Minus className="w-3 h-3 mr-0.5" /> Unchanged
                  </span>
                )}
                <span className="text-slate-400">vs prev</span>
              </div>
            )}
          </div>

          {/* Weight KPI */}
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Scale className="w-3.5 h-3.5 text-purple-500" /> Weight
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {latestWeightVisit?.weight !== undefined && latestWeightVisit.weight !== null ? `${latestWeightVisit.weight}` : '—'}
              <span className="text-[11px] font-normal text-slate-400 ml-1">kg</span>
            </div>
            {weightDelta !== null && (
              <div className="flex items-center gap-1 text-[11px] mt-0.5">
                {weightDelta > 0 ? (
                  <span className="text-purple-600 font-medium flex items-center">
                    <TrendingUp className="w-3 h-3 mr-0.5" /> +{weightDelta} kg
                  </span>
                ) : weightDelta < 0 ? (
                  <span className="text-blue-600 font-medium flex items-center">
                    <TrendingDown className="w-3 h-3 mr-0.5" /> {weightDelta} kg
                  </span>
                ) : (
                  <span className="text-slate-500">Unchanged</span>
                )}
                <span className="text-slate-400">overall</span>
              </div>
            )}
          </div>

          {/* Pulse & SpO2 KPI */}
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Activity className="w-3.5 h-3.5 text-emerald-500" /> Pulse / SpO2
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {latestPulseVisit?.pulse || '—'}
              <span className="text-[11px] font-normal text-slate-400 ml-0.5 mr-1.5">bpm</span>
              <span className="text-slate-300">|</span>
              <span className="ml-1.5">{latestSpo2Visit?.spo2 ? `${latestSpo2Visit.spo2}%` : '—'}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {latestSpo2Visit?.spo2 && latestSpo2Visit.spo2 >= 95 ? (
                <span className="text-emerald-600 font-medium">Normal O2 saturation</span>
              ) : (
                'Resting parameters'
              )}
            </div>
          </div>

          {/* Temperature KPI */}
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Temp
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {latestTempVisit?.temp ? `${latestTempVisit.temp}` : '—'}
              <span className="text-[11px] font-normal text-slate-400 ml-1">°C</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {latestTempVisit?.temp && latestTempVisit.temp > 37.5 ? (
                <span className="text-amber-600 font-medium">Elevated / Febrile</span>
              ) : (
                <span className="text-slate-500">Afebrile</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6">
        {/* TAB 1: BLOOD PRESSURE TREND */}
        {activeTab === 'bp' && (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Systolic
                </span>
                <span className="flex items-center gap-1.5 font-medium text-cyan-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 inline-block" /> Diastolic
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
                  <span className="w-2.5 h-2 bg-emerald-100 border border-emerald-300 inline-block" /> Normal target (&lt;120/80)
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                {visits.filter((v) => v.systolic).length} readings recorded
              </div>
            </div>

            {/* SVG Chart for Blood Pressure */}
            <div className="relative w-full overflow-x-auto">
              {(() => {
                const bpVisits = visits.filter((v) => v.systolic && v.diastolic);
                if (bpVisits.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No blood pressure values recorded for this patient.
                    </div>
                  );
                }

                // Y scale: 50 to 180 mmHg
                const minY = 50;
                const maxY = 180;
                const getY = (val: number) => padding.top + plotHeight - ((val - minY) / (maxY - minY)) * plotHeight;

                const sysPoints = bpVisits.map((v, i) => ({
                  x: getX(i, bpVisits.length),
                  y: getY(v.systolic!),
                  val: v.systolic!,
                  visit: v,
                }));

                const diaPoints = bpVisits.map((v, i) => ({
                  x: getX(i, bpVisits.length),
                  y: getY(v.diastolic!),
                  val: v.diastolic!,
                  visit: v,
                }));

                const sysPath = sysPoints.reduce(
                  (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                  ''
                );

                const diaPath = diaPoints.reduce(
                  (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                  ''
                );

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 select-none">
                    {/* Background Grid Lines & Ticks */}
                    {[60, 80, 100, 120, 140, 160].map((tick) => {
                      const yPos = getY(tick);
                      return (
                        <g key={tick}>
                          <line
                            x1={padding.left}
                            y1={yPos}
                            x2={width - padding.right}
                            y2={yPos}
                            stroke="#e2e8f0"
                            strokeDasharray={tick === 120 || tick === 140 ? '4 3' : '2 2'}
                            strokeWidth={tick === 120 || tick === 140 ? 1.2 : 0.8}
                          />
                          <text
                            x={padding.left - 8}
                            y={yPos + 3.5}
                            fontSize="9"
                            fill="#94a3b8"
                            textAnchor="end"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    {/* Normal Target Shaded Band (80 to 120 mmHg) */}
                    <rect
                      x={padding.left}
                      y={getY(120)}
                      width={plotWidth}
                      height={getY(80) - getY(120)}
                      fill="#10b981"
                      opacity="0.08"
                    />

                    {/* Systolic Line */}
                    {bpVisits.length > 1 && (
                      <path d={sysPath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Diastolic Line */}
                    {bpVisits.length > 1 && (
                      <path d={diaPath} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Systolic Points */}
                    {sysPoints.map((p, i) => (
                      <g
                        key={`sys-${i}`}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredPoint(p.visit)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle cx={p.x} cy={p.y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          fill="#1e40af"
                          textAnchor="middle"
                        >
                          {p.val}
                        </text>
                      </g>
                    ))}

                    {/* Diastolic Points */}
                    {diaPoints.map((p, i) => (
                      <g
                        key={`dia-${i}`}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredPoint(p.visit)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle cx={p.x} cy={p.y} r="5" fill="#0891b2" stroke="#ffffff" strokeWidth="2" />
                        <text
                          x={p.x}
                          y={p.y + 14}
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          fill="#0e7490"
                          textAnchor="middle"
                        >
                          {p.val}
                        </text>
                      </g>
                    ))}

                    {/* X-axis Labels */}
                    {bpVisits.map((v, i) => {
                      const xPos = getX(i, bpVisits.length);
                      return (
                        <g key={`x-${v.id}`}>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 16}
                            fontSize="9"
                            fill="#64748b"
                            fontWeight="500"
                            textAnchor="middle"
                          >
                            V{v.visitIndex}
                          </text>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 28}
                            fontSize="8"
                            fill="#94a3b8"
                            textAnchor="middle"
                          >
                            {v.date}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 2: WEIGHT PROGRESSION */}
        {activeTab === 'weight' && (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-purple-700">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" /> Body Weight (kg)
              </span>
              <div className="text-slate-400 text-[11px]">
                {visits.filter((v) => v.weight).length} measurements recorded
              </div>
            </div>

            <div className="relative w-full overflow-x-auto">
              {(() => {
                const wtVisits = visits.filter((v) => v.weight !== null);
                if (wtVisits.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No body weight measurements recorded for this patient.
                    </div>
                  );
                }

                const weights = wtVisits.map((v) => v.weight!);
                const minWeight = Math.floor(Math.min(...weights) - 3);
                const maxWeight = Math.ceil(Math.max(...weights) + 3);
                const getY = (w: number) => padding.top + plotHeight - ((w - minWeight) / (maxWeight - minWeight)) * plotHeight;

                const points = wtVisits.map((v, i) => ({
                  x: getX(i, wtVisits.length),
                  y: getY(v.weight!),
                  val: v.weight!,
                  visit: v,
                }));

                const pathData = points.reduce(
                  (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                  ''
                );

                const areaData =
                  points.length > 1
                    ? `${pathData} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
                    : '';

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 select-none">
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {[minWeight, Math.round((minWeight + maxWeight) / 2), maxWeight].map((tick) => {
                      const yPos = getY(tick);
                      return (
                        <g key={tick}>
                          <line
                            x1={padding.left}
                            y1={yPos}
                            x2={width - padding.right}
                            y2={yPos}
                            stroke="#e2e8f0"
                            strokeDasharray="2 2"
                            strokeWidth="0.8"
                          />
                          <text
                            x={padding.left - 8}
                            y={yPos + 3.5}
                            fontSize="9"
                            fill="#94a3b8"
                            textAnchor="end"
                          >
                            {tick} kg
                          </text>
                        </g>
                      );
                    })}

                    {areaData && <path d={areaData} fill="url(#weightGrad)" />}
                    {points.length > 1 && (
                      <path d={pathData} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {points.map((p, i) => (
                      <g
                        key={`wt-${i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p.visit)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle cx={p.x} cy={p.y} r="5" fill="#8b5cf6" stroke="#ffffff" strokeWidth="2" />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          fill="#6d28d9"
                          textAnchor="middle"
                        >
                          {p.val} kg
                        </text>
                      </g>
                    ))}

                    {/* X-axis labels */}
                    {wtVisits.map((v, i) => {
                      const xPos = getX(i, wtVisits.length);
                      return (
                        <g key={`x-wt-${v.id}`}>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 16}
                            fontSize="9"
                            fill="#64748b"
                            fontWeight="500"
                            textAnchor="middle"
                          >
                            V{v.visitIndex}
                          </text>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 28}
                            fontSize="8"
                            fill="#94a3b8"
                            textAnchor="middle"
                          >
                            {v.date}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 3: PULSE & SPO2 */}
        {activeTab === 'pulse_spo2' && (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Pulse (bpm)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> SpO2 (%)
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">Normal: Pulse 60-100 bpm | SpO2 &gt;95%</div>
            </div>

            <div className="relative w-full overflow-x-auto">
              {(() => {
                const relevantVisits = visits.filter((v) => v.pulse !== null || v.spo2 !== null);
                if (relevantVisits.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No pulse or oxygen saturation readings recorded.
                    </div>
                  );
                }

                const minVal = 50;
                const maxVal = 120;
                const getY = (val: number) => padding.top + plotHeight - ((val - minVal) / (maxVal - minVal)) * plotHeight;

                const pulsePoints = relevantVisits
                  .filter((v) => v.pulse !== null)
                  .map((v, i) => ({
                    x: getX(i, relevantVisits.length),
                    y: getY(v.pulse!),
                    val: v.pulse!,
                    visit: v,
                  }));

                const spo2Points = relevantVisits
                  .filter((v) => v.spo2 !== null)
                  .map((v, i) => ({
                    x: getX(i, relevantVisits.length),
                    y: getY(v.spo2!),
                    val: v.spo2!,
                    visit: v,
                  }));

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 select-none">
                    {[60, 80, 100].map((tick) => {
                      const yPos = getY(tick);
                      return (
                        <g key={tick}>
                          <line
                            x1={padding.left}
                            y1={yPos}
                            x2={width - padding.right}
                            y2={yPos}
                            stroke="#e2e8f0"
                            strokeDasharray="2 2"
                            strokeWidth="0.8"
                          />
                          <text
                            x={padding.left - 8}
                            y={yPos + 3.5}
                            fontSize="9"
                            fill="#94a3b8"
                            textAnchor="end"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    {/* Pulse Line & Points */}
                    {pulsePoints.length > 1 && (
                      <path
                        d={pulsePoints.reduce(
                          (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                          ''
                        )}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    )}

                    {/* SpO2 Line & Points */}
                    {spo2Points.length > 1 && (
                      <path
                        d={spo2Points.reduce(
                          (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                          ''
                        )}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="3 3"
                      />
                    )}

                    {pulsePoints.map((p, i) => (
                      <g
                        key={`pulse-${i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p.visit)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle cx={p.x} cy={p.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          fill="#047857"
                          textAnchor="middle"
                        >
                          {p.val} bpm
                        </text>
                      </g>
                    ))}

                    {spo2Points.map((p, i) => (
                      <g
                        key={`spo2-${i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p.visit)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle cx={p.x} cy={p.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
                        <text
                          x={p.x}
                          y={p.y + 14}
                          fontSize="9"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          fill="#1d4ed8"
                          textAnchor="middle"
                        >
                          {p.val}%
                        </text>
                      </g>
                    ))}

                    {/* X-axis labels */}
                    {relevantVisits.map((v, i) => {
                      const xPos = getX(i, relevantVisits.length);
                      return (
                        <g key={`x-p-${v.id}`}>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 16}
                            fontSize="9"
                            fill="#64748b"
                            fontWeight="500"
                            textAnchor="middle"
                          >
                            V{v.visitIndex}
                          </text>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 28}
                            fontSize="8"
                            fill="#94a3b8"
                            textAnchor="middle"
                          >
                            {v.date}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 4: TEMPERATURE */}
        {activeTab === 'temp' && (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Body Temp (°C)
              </span>
              <div className="text-slate-400 text-[11px]">Normal afebrile: 36.5°C – 37.5°C</div>
            </div>

            <div className="relative w-full overflow-x-auto">
              {(() => {
                const tempVisits = visits.filter((v) => v.temp !== null);
                if (tempVisits.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No temperature readings recorded for this patient.
                    </div>
                  );
                }

                const minTemp = 35.5;
                const maxTemp = 40.5;
                const getY = (t: number) => padding.top + plotHeight - ((t - minTemp) / (maxTemp - minTemp)) * plotHeight;

                const points = tempVisits.map((v, i) => ({
                  x: getX(i, tempVisits.length),
                  y: getY(v.temp!),
                  val: v.temp!,
                  visit: v,
                }));

                const pathData = points.reduce(
                  (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                  ''
                );

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 select-none">
                    {/* Fever threshold at 37.5°C */}
                    <line
                      x1={padding.left}
                      y1={getY(37.5)}
                      x2={width - padding.right}
                      y2={getY(37.5)}
                      stroke="#ef4444"
                      strokeDasharray="4 3"
                      strokeWidth="1"
                    />
                    <text
                      x={width - padding.right}
                      y={getY(37.5) - 4}
                      fontSize="8"
                      fill="#ef4444"
                      textAnchor="end"
                    >
                      Fever line (37.5°C)
                    </text>

                    {[36.0, 37.0, 38.0, 39.0, 40.0].map((tick) => {
                      const yPos = getY(tick);
                      return (
                        <g key={tick}>
                          <line
                            x1={padding.left}
                            y1={yPos}
                            x2={width - padding.right}
                            y2={yPos}
                            stroke="#e2e8f0"
                            strokeDasharray="2 2"
                            strokeWidth="0.8"
                          />
                          <text
                            x={padding.left - 8}
                            y={yPos + 3.5}
                            fontSize="9"
                            fill="#94a3b8"
                            textAnchor="end"
                          >
                            {tick.toFixed(1)}°C
                          </text>
                        </g>
                      );
                    })}

                    {points.length > 1 && (
                      <path d={pathData} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {points.map((p, i) => (
                      <g
                        key={`temp-${i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p.visit)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle cx={p.x} cy={p.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          fill="#b45309"
                          textAnchor="middle"
                        >
                          {p.val}°F
                        </text>
                      </g>
                    ))}

                    {/* X-axis labels */}
                    {tempVisits.map((v, i) => {
                      const xPos = getX(i, tempVisits.length);
                      return (
                        <g key={`x-t-${v.id}`}>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 16}
                            fontSize="9"
                            fill="#64748b"
                            fontWeight="500"
                            textAnchor="middle"
                          >
                            V{v.visitIndex}
                          </text>
                          <text
                            x={xPos}
                            y={height - padding.bottom + 28}
                            fontSize="8"
                            fill="#94a3b8"
                            textAnchor="middle"
                          >
                            {v.date}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 5: LONGITUDINAL FLOWSHEET TABLE */}
        {activeTab === 'flowsheet' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="py-2.5 px-3">Visit</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">BP (mmHg)</th>
                  <th className="py-2.5 px-3">Weight</th>
                  <th className="py-2.5 px-3">Pulse</th>
                  <th className="py-2.5 px-3">SpO2</th>
                  <th className="py-2.5 px-3">Temp</th>
                  <th className="py-2.5 px-3">Diagnosis</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      Visit #{v.visitIndex}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {v.date}
                    </td>
                    <td className="py-2 px-3 font-medium">
                      {v.bp ? (
                        <span className="flex items-center gap-1.5">
                          {v.bp}
                          {v.systolic && v.diastolic && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${getBpCategory(v.systolic, v.diastolic).color}`}>
                              {getBpCategory(v.systolic, v.diastolic).label}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {v.weight ? `${v.weight} kg` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {v.pulse ? `${v.pulse} bpm` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {v.spo2 ? (
                        <span className={v.spo2 < 95 ? 'text-amber-600 font-semibold' : ''}>
                          {v.spo2}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {v.temp ? `${v.temp} °C` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-3 max-w-[180px] truncate text-slate-800 font-medium">
                      {v.diagnosis}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Link href={`/prescription/${v.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-blue-600">
                          <ExternalLink className="w-3 h-3" /> View Rx
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Hover inspection detail banner */}
        {hoveredPoint && (
          <div className="mt-3 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 transition-all">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold">Visit #{hoveredPoint.visitIndex} ({hoveredPoint.date}):</span>
              <span>
                BP: <strong>{hoveredPoint.bp || 'N/A'}</strong> | Weight: <strong>{hoveredPoint.weight ? `${hoveredPoint.weight}kg` : 'N/A'}</strong> | Pulse: <strong>{hoveredPoint.pulse ? `${hoveredPoint.pulse}bpm` : 'N/A'}</strong>
              </span>
            </div>
            <span className="text-blue-700 italic truncate max-w-xs">{hoveredPoint.diagnosis}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
