'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Heart,
  Droplets,
  Wind,
  Thermometer,
  Syringe,
  FileCheck,
  Maximize2,
  AlertTriangle,
  RefreshCw,
  Radio,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { BedsideMonitorWaveform } from './BedsideMonitorWaveform';
import {
  getPatientLiveDeviceTelemetryAction,
  syncTelemetryToNursingVitalsAction,
} from '@/app/ipd/device-actions';

interface PatientBedsideDeviceSectionProps {
  admissionId: number;
  ward: string;
  bedNo: string;
  userRole?: string;
}

export function PatientBedsideDeviceSection({
  admissionId,
  ward,
  bedNo,
  userRole,
}: PatientBedsideDeviceSectionProps) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    getPatientLiveDeviceTelemetryAction(admissionId)
      .then((data) => {
        if (active) {
          setDevices(data);
          setLoading(false);
        }
      })
      .catch((e) => console.error(e));

    const interval = setInterval(() => {
      getPatientLiveDeviceTelemetryAction(admissionId)
        .then((data) => {
          if (active) setDevices(data);
        })
        .catch((e) => console.error(e));
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [admissionId]);

  const monitor = devices.find((d) => d.deviceType === 'patient_monitor') || devices[0];
  const ventilator = devices.find((d) => d.deviceType === 'ventilator');
  const pump = devices.find((d) => d.deviceType === 'infusion_pump');

  const tele = monitor?.latestTelemetry || {};
  const ventTele = ventilator?.latestTelemetry || {};
  const pumpTele = pump?.latestTelemetry || {};

  const handleSyncToChart = async () => {
    if (!tele.heartRate && !tele.spo2 && !tele.systolicBp) {
      toast.show({
        title: 'No Telemetry Available',
        description: 'Wait for live device stream before syncing.',
        type: 'warning',
      });
      return;
    }

    setSyncing(true);
    try {
      await syncTelemetryToNursingVitalsAction(admissionId, {
        heartRate: tele.heartRate,
        spo2: tele.spo2,
        systolicBp: tele.systolicBp,
        diastolicBp: tele.diastolicBp,
        respiratoryRate: tele.respiratoryRate,
        bodyTemperature: tele.bodyTemperature,
        news2Score: tele.news2Score,
      });

      toast.show({
        title: 'Vitals Synced to Progress Notes',
        description: `HR: ${tele.heartRate || '--'} bpm, SpO2: ${tele.spo2 || '--'}%, BP: ${tele.systolicBp || '--'}/${tele.diastolicBp || '--'} recorded into IPD flow sheet.`,
        type: 'success',
      });
      window.location.reload();
    } catch (err: any) {
      toast.show({ title: 'Sync Failed', description: err.message, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mb-8 print:hidden">
      <div className="flex items-center justify-between border-b-2 border-emerald-300 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Connected ICU / IPD Bedside Devices ({devices.length})
          </h2>
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> LIVE TELEMETRY
          </span>
        </div>

        <div className="flex items-center gap-2">
          {devices.length > 0 && (
            <Button
              onClick={handleSyncToChart}
              disabled={syncing}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              <FileCheck className="w-3.5 h-3.5" />
              {syncing ? 'Syncing...' : '1-Click Sync to Progress Notes'}
            </Button>
          )}

          <Link href="/ipd/monitoring">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-slate-300 hover:bg-slate-100 text-slate-700"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
              Open Central Station
            </Button>
          </Link>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center text-xs text-slate-500 space-y-3">
          <Activity className="w-8 h-8 text-slate-400 mx-auto" />
          <div>
            <div className="font-semibold text-slate-700 text-sm">No Medical Devices Attached to Bed {bedNo}</div>
            <p className="mt-1">
              Connect a bedside monitor, Hamilton ventilator, or B. Braun infusion pump to enable real-time ICU vitals streaming.
            </p>
          </div>
          <Link href="/ipd/monitoring">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Attach Device via Central Monitoring Station
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-5">
          {/* Top Bar of Section */}
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[11px]">
                {bedNo} ({ward})
              </span>
              <span className="text-slate-300 font-semibold">{monitor?.name}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400">
                Protocol: {monitor?.protocol || 'HL7_V2_ORU'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  (tele.news2Score ?? 0) >= 7
                    ? 'bg-red-500 text-white'
                    : (tele.news2Score ?? 0) >= 5
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                NEWS2: {tele.news2Score ?? 0}
              </span>
            </div>
          </div>

          {/* Real-time Oscilloscope Waveform Display */}
          <BedsideMonitorWaveform
            heartRate={tele.heartRate}
            spo2={tele.spo2}
            respiratoryRate={tele.respiratoryRate}
            isAlarm={tele.alertLevel === 'CRITICAL' || tele.alertLevel === 'HIGH'}
            compact={false}
          />

          {/* Live Parameter Big Digits */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {/* HR */}
            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-950/80">
              <div className="flex items-center justify-between text-emerald-400 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 animate-pulse" /> HR / PULSE
                </span>
                <span className="text-slate-500 font-mono">bpm</span>
              </div>
              <div className="text-3xl font-mono font-black text-emerald-400 my-1">
                {tele.heartRate || '--'}
              </div>
              <div className="text-[10px] text-slate-500">Normal 60-100</div>
            </div>

            {/* SpO2 */}
            <div className="bg-slate-950 p-3 rounded-xl border border-cyan-950/80">
              <div className="flex items-center justify-between text-cyan-400 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" /> SpO2
                </span>
                <span className="text-slate-500 font-mono">%</span>
              </div>
              <div className="text-3xl font-mono font-black text-cyan-400 my-1">
                {tele.spo2 || '--'}
              </div>
              <div className="text-[10px] text-slate-500">&gt; 94%</div>
            </div>

            {/* NIBP */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-300 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-rose-500" /> NIBP
                </span>
                <span className="text-slate-500 font-mono">mmHg</span>
              </div>
              <div className="text-xl font-mono font-black text-white my-1">
                {tele.systolicBp && tele.diastolicBp
                  ? `${tele.systolicBp}/${tele.diastolicBp}`
                  : '--/--'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                MAP: {tele.meanArterialPressure || '--'}
              </div>
            </div>

            {/* RR */}
            <div className="bg-slate-950 p-3 rounded-xl border border-yellow-950/80">
              <div className="flex items-center justify-between text-yellow-400 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" /> RESP
                </span>
                <span className="text-slate-500 font-mono">/min</span>
              </div>
              <div className="text-3xl font-mono font-black text-yellow-400 my-1">
                {tele.respiratoryRate || '--'}
              </div>
              <div className="text-[10px] text-slate-500">12 - 20</div>
            </div>

            {/* Temp */}
            <div className="bg-slate-950 p-3 rounded-xl border border-orange-950/80 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-orange-400 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3" /> TEMP
                </span>
                <span className="text-slate-500 font-mono">°C</span>
              </div>
              <div className="text-3xl font-mono font-black text-orange-400 my-1">
                {tele.bodyTemperature ? tele.bodyTemperature.toFixed(1) : '--'}
              </div>
              <div className="text-[10px] text-slate-500">36.5 - 37.5</div>
            </div>
          </div>

          {/* Ventilator & Infusion Pump Details if present */}
          {(ventilator || pump) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {ventilator && (
                <div className="bg-slate-950 border border-indigo-900/50 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-indigo-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-indigo-400" />
                      Ventilator ({ventilator.name})
                    </span>
                    <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono text-[10px]">
                      {ventTele.ventilatorMode || 'SIMV+PS'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    <div className="bg-slate-900 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">FiO2</div>
                      <div className="font-bold text-indigo-300">{ventTele.fio2 || 40}%</div>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">PEEP</div>
                      <div className="font-bold text-indigo-300">{ventTele.peep || 5.0}</div>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">PIP</div>
                      <div className={`font-bold ${ventTele.peakInspiratoryPressure > 34 ? 'text-red-400 animate-pulse' : 'text-indigo-300'}`}>
                        {ventTele.peakInspiratoryPressure || 19.5}
                      </div>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">Vt</div>
                      <div className="font-bold text-indigo-300">{ventTele.tidalVolume || 460}ml</div>
                    </div>
                  </div>
                </div>
              )}

              {pump && (
                <div className="bg-slate-950 border border-purple-900/50 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-purple-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Syringe className="w-4 h-4 text-purple-400" />
                      Infusion Pump ({pump.name})
                    </span>
                    <span className="bg-purple-950 text-purple-300 px-2 py-0.5 rounded font-mono text-[10px]">
                      {pumpTele.infusionStatus || 'INFUSING'}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">{pumpTele.infusionDrug || 'Active Infusion'}</div>
                      <div className="text-[10px] text-slate-400">Dose: {pumpTele.infusionDose || 'Titrated'}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-purple-300 font-bold text-sm">{pumpTele.infusionRate || 4.0} mL/h</div>
                      <div className="text-[10px] text-slate-500">Vol: {pumpTele.totalVolumeInfused || 12.0} mL</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
