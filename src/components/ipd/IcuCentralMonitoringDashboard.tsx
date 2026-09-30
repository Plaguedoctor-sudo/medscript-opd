'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Activity,
  Heart,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Play,
  Pause,
  Filter,
  Layers,
  ArrowRight,
  Maximize2,
  Syringe,
  Settings2,
  X,
  Radio,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { BedsideMonitorWaveform } from './BedsideMonitorWaveform';
import {
  DeviceWithPatientInfo,
  attachDeviceToPatientAction,
  detachDeviceFromPatientAction,
  registerDeviceAction,
  syncTelemetryToNursingVitalsAction,
  acknowledgeDeviceAlertAction,
  simulateTelemetryTickAction,
} from '@/app/ipd/device-actions';

interface IcuCentralMonitoringDashboardProps {
  initialDevices: DeviceWithPatientInfo[];
  activeAdmissions: Array<{
    id: number;
    admissionNo: string;
    patientName: string;
    ward: string;
    bedNo: string;
  }>;
  userRole?: string;
}

export function IcuCentralMonitoringDashboard({
  initialDevices,
  activeAdmissions,
  userRole,
}: IcuCentralMonitoringDashboardProps) {
  const [devices, setDevices] = useState<DeviceWithPatientInfo[]>(initialDevices);
  const [wardFilter, setWardFilter] = useState<string>('ALL');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationScenario, setSimulationScenario] = useState<'STABLE' | 'SEPSIS' | 'ARDS' | 'ARRHYTHMIA'>('STABLE');
  const [isPending, startTransition] = useTransition();

  // Modals
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [selectedDeviceForAttach, setSelectedDeviceForAttach] = useState<string>('');
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<number | ''>('');
  const [selectedBed, setSelectedBed] = useState<string>('');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('patient_monitor');
  const [newWard, setNewWard] = useState('ICU');
  const [newBed, setNewBed] = useState('');

  // Auto-refresh simulation tick every 3.5 seconds when simulation is running
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      startTransition(async () => {
        try {
          await simulateTelemetryTickAction(simulationScenario);
          // Gently update in-memory telemetry so UI smoothly reflects values
          setDevices((prev) =>
            prev.map((d) => {
              if (d.status === 'OFFLINE' || d.status === 'STANDBY') return d;

              const jitter = (val: number, range: number) =>
                Math.round(val + (Math.random() - 0.5) * range);

              const currentTele = d.latestTelemetry || {
                heartRate: 75,
                spo2: 98,
                systolicBp: 120,
                diastolicBp: 80,
                respiratoryRate: 16,
                bodyTemperature: 36.8,
              };

              let nextTele = { ...currentTele };

              if (d.deviceType === 'patient_monitor') {
                if (simulationScenario === 'SEPSIS') {
                  nextTele = {
                    ...nextTele,
                    heartRate: jitter(124, 4),
                    systolicBp: jitter(82, 4),
                    diastolicBp: jitter(48, 3),
                    spo2: jitter(94, 2),
                    respiratoryRate: jitter(26, 2),
                    bodyTemperature: 38.9,
                    news2Score: 7,
                    alertLevel: 'HIGH',
                  };
                } else if (simulationScenario === 'ARDS') {
                  nextTele = {
                    ...nextTele,
                    heartRate: jitter(108, 3),
                    systolicBp: jitter(118, 4),
                    diastolicBp: jitter(72, 3),
                    spo2: Math.min(91, Math.max(86, jitter(88, 2))), // Low SpO2
                    respiratoryRate: jitter(24, 2),
                    bodyTemperature: 37.6,
                    news2Score: 6,
                    alertLevel: 'CRITICAL',
                  };
                } else if (simulationScenario === 'ARRHYTHMIA') {
                  nextTele = {
                    ...nextTele,
                    heartRate: jitter(144, 8),
                    systolicBp: jitter(102, 5),
                    diastolicBp: jitter(64, 4),
                    spo2: jitter(95, 2),
                    respiratoryRate: jitter(18, 2),
                    news2Score: 5,
                    alertLevel: 'HIGH',
                  };
                } else {
                  // Stable
                  nextTele = {
                    ...nextTele,
                    heartRate: jitter(74, 2),
                    systolicBp: jitter(120, 3),
                    diastolicBp: jitter(78, 2),
                    spo2: Math.min(100, Math.max(97, jitter(99, 1))),
                    respiratoryRate: jitter(16, 1),
                    bodyTemperature: 36.8,
                    news2Score: 0,
                    alertLevel: 'NORMAL',
                  };
                }
              } else if (d.deviceType === 'ventilator') {
                if (simulationScenario === 'ARDS') {
                  nextTele = {
                    ...nextTele,
                    ventilatorMode: 'PCV',
                    fio2: 70,
                    peep: 14.0,
                    peakInspiratoryPressure: 36.8,
                    tidalVolume: jitter(380, 15),
                    alertLevel: 'CRITICAL',
                  };
                } else {
                  nextTele = {
                    ...nextTele,
                    ventilatorMode: 'SIMV+PS',
                    fio2: 40,
                    peep: 5.0,
                    peakInspiratoryPressure: 19.4,
                    tidalVolume: jitter(460, 20),
                    alertLevel: 'NORMAL',
                  };
                }
              } else if (d.deviceType === 'infusion_pump') {
                nextTele = {
                  ...nextTele,
                  totalVolumeInfused: Number(((nextTele.totalVolumeInfused || 45) + 0.1).toFixed(1)),
                  infusionRate: simulationScenario === 'SEPSIS' ? 12.0 : 4.0,
                  infusionDrug:
                    simulationScenario === 'SEPSIS'
                      ? 'Noradrenaline (4mg/50mL)'
                      : 'Pantoprazole 40mg',
                };
              }

              return {
                ...d,
                latestTelemetry: nextTele,
              };
            })
          );
        } catch (e) {
          console.error('Tick error:', e);
        }
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isSimulating, simulationScenario]);

  // Filter devices
  const filteredDevices = devices.filter((d) => {
    if (wardFilter === 'ALL') return true;
    return d.locationWard.toUpperCase() === wardFilter.toUpperCase();
  });

  // Group devices by Bed / Admission to provide a bedside multi-device cockpit
  const bedMap = new Map<string, DeviceWithPatientInfo[]>();
  for (const dev of filteredDevices) {
    const key = dev.assignedBed || `${dev.locationWard}-Unassigned`;
    if (!bedMap.has(key)) {
      bedMap.set(key, []);
    }
    bedMap.get(key)!.push(dev);
  }

  // Handle Attach
  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceForAttach || !selectedAdmissionId) {
      toast.show({ title: 'Validation Error', description: 'Please select device and patient.', type: 'error' });
      return;
    }

    try {
      await attachDeviceToPatientAction(selectedDeviceForAttach, Number(selectedAdmissionId), selectedBed);
      toast.show({ title: 'Device Attached', description: 'Medical device attached to patient bed.', type: 'success' });
      setIsAttachOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.show({ title: 'Attachment Failed', description: err.message, type: 'error' });
    }
  };

  // Handle Detach
  const handleDetach = async (deviceId: string) => {
    if (!confirm('Are you sure you want to detach this device from the patient bed?')) return;
    try {
      await detachDeviceFromPatientAction(deviceId);
      toast.show({ title: 'Device Detached', description: 'Device is now in Standby.', type: 'info' });
      window.location.reload();
    } catch (err: any) {
      toast.show({ title: 'Detach Failed', description: err.message, type: 'error' });
    }
  };

  // Handle Sync to Chart
  const handleSyncToChart = async (admissionId: number, telemetry: any) => {
    try {
      await syncTelemetryToNursingVitalsAction(admissionId, {
        heartRate: telemetry?.heartRate,
        spo2: telemetry?.spo2,
        systolicBp: telemetry?.systolicBp,
        diastolicBp: telemetry?.diastolicBp,
        respiratoryRate: telemetry?.respiratoryRate,
        bodyTemperature: telemetry?.bodyTemperature,
        news2Score: telemetry?.news2Score,
      });
      toast.show({
        title: 'Synced to Clinical Chart',
        description: 'Bedside telemetry snapshot recorded in IPD Rounds & Vitals flow sheet.',
        type: 'success',
      });
    } catch (err: any) {
      toast.show({ title: 'Sync Failed', description: err.message, type: 'error' });
    }
  };

  // Handle Register Device
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId || !newDeviceName) {
      toast.show({ title: 'Missing Information', description: 'Device ID and Name are required.', type: 'error' });
      return;
    }

    try {
      await registerDeviceAction({
        deviceId: newDeviceId,
        name: newDeviceName,
        deviceType: newDeviceType,
        locationWard: newWard,
        assignedBed: newBed || undefined,
      });
      toast.show({ title: 'Device Registered', description: `${newDeviceName} added to hospital inventory.`, type: 'success' });
      setIsRegisterOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.show({ title: 'Registration Failed', description: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Command Bar */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-emerald-500/20 shadow-md">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Central ICU & IPD Telemetry Station</h1>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> LIVE STREAM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Continuous multiparameter bedside monitoring, mechanical ventilation scalars & infusion telemetry.
              </p>
            </div>
          </div>

          {/* Quick Controls & Simulator Switch */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Simulation Scenario Selector */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
              <span className="text-[11px] text-slate-400 px-2 font-semibold">Scenario:</span>
              {(['STABLE', 'SEPSIS', 'ARDS', 'ARRHYTHMIA'] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setSimulationScenario(sc)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    simulationScenario === sc
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>

            <Button
              onClick={() => setIsSimulating(!isSimulating)}
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs border-slate-700 ${
                isSimulating
                  ? 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isSimulating ? 'Simulator Active' : 'Simulator Paused'}
            </Button>

            <Button
              onClick={() => setIsAttachOpen(true)}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              <Radio className="w-3.5 h-3.5" /> Attach Bed Device
            </Button>

            <Button
              onClick={() => setIsRegisterOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Device
            </Button>
          </div>
        </div>

        {/* Ward Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Ward Filter:
            </span>
            {['ALL', 'ICU', 'HDU', 'General Ward'].map((w) => (
              <button
                key={w}
                onClick={() => setWardFilter(w)}
                className={`px-3 py-1 rounded-full font-semibold transition-all ${
                  wardFilter === w
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Normal NEWS2 (0-4)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Medium Risk (5-6)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> High ICU Risk (&ge;7)
            </span>
          </div>
        </div>
      </div>

      {/* Bedside Monitors Matrix Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from(bedMap.entries()).map(([bedName, bedDevices]) => {
          // Identify primary patient monitor, ventilator, and syringe pump on this bed
          const patientMonitor = bedDevices.find((d) => d.deviceType === 'patient_monitor') || bedDevices[0];
          const ventilator = bedDevices.find((d) => d.deviceType === 'ventilator');
          const infusionPump = bedDevices.find((d) => d.deviceType === 'infusion_pump');

          const patient = patientMonitor?.patient;
          const tele = patientMonitor?.latestTelemetry || {};
          const ventTele = ventilator?.latestTelemetry || {};
          const pumpTele = infusionPump?.latestTelemetry || {};

          const news2 = tele.news2Score ?? 0;
          const isAlarm = tele.alertLevel === 'CRITICAL' || tele.alertLevel === 'HIGH';

          return (
            <div
              key={bedName}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm flex flex-col ${
                isAlarm ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-200 hover:shadow-md'
              }`}
            >
              {/* Bed Card Header */}
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-blue-600/80 px-2.5 py-1 rounded-md text-xs font-mono font-bold">
                    <span>{bedName}</span>
                  </div>
                  <div>
                    {patient ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{patient.name}</span>
                        <span className="text-xs text-slate-400">
                          ({patient.age}y/{patient.gender}) • Adm #{patient.admissionNo}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">
                        Unoccupied / Ready for Admission
                      </span>
                    )}
                  </div>
                </div>

                {/* NEWS2 & Alarm Badges */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                      news2 >= 7
                        ? 'bg-red-500 text-white animate-pulse'
                        : news2 >= 5
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    NEWS2: {news2}
                  </span>

                  {patient && (
                    <Button
                      onClick={() => handleSyncToChart(patient.id, tele)}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] gap-1 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                      title="Sync current live vitals into IPD Nursing Chart"
                    >
                      <FileCheck className="w-3 h-3 text-emerald-400" /> Sync Chart
                    </Button>
                  )}
                </div>
              </div>

              {/* Main Body: Real-time Oscilloscope Waveform & Numeric Parameters */}
              <div className="p-4 space-y-4 flex-1">
                {/* Waveform Trace */}
                <div>
                  <BedsideMonitorWaveform
                    heartRate={tele.heartRate}
                    spo2={tele.spo2}
                    respiratoryRate={tele.respiratoryRate}
                    isAlarm={isAlarm}
                    compact={false}
                  />
                </div>

                {/* Big-Number Vital Parameter Readouts */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                  {/* HR / Pulse (Phosphor Green) */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-950 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-400 text-[10px] font-bold">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 animate-pulse" /> HR / PULSE
                      </span>
                      <span className="text-slate-500 font-mono">bpm</span>
                    </div>
                    <div className="text-3xl font-mono font-black text-emerald-400 tracking-tight my-1">
                      {tele.heartRate || '--'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">50 - 120</div>
                  </div>

                  {/* SpO2 (Cyan) */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-cyan-950 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-cyan-400 text-[10px] font-bold">
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> SpO2
                      </span>
                      <span className="text-slate-500 font-mono">%</span>
                    </div>
                    <div className="text-3xl font-mono font-black text-cyan-400 tracking-tight my-1">
                      {tele.spo2 || '--'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">&gt; 92%</div>
                  </div>

                  {/* NIBP / Arterial Pressure (White/Red) */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-300 text-[10px] font-bold">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-rose-500" /> NIBP
                      </span>
                      <span className="text-slate-500 font-mono">mmHg</span>
                    </div>
                    <div className="text-xl font-mono font-black text-white tracking-tight my-1">
                      {tele.systolicBp && tele.diastolicBp
                        ? `${tele.systolicBp}/${tele.diastolicBp}`
                        : '--/--'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      MAP: {tele.meanArterialPressure || '--'}
                    </div>
                  </div>

                  {/* Respiratory Rate (Yellow) */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-yellow-950 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-yellow-400 text-[10px] font-bold">
                      <span className="flex items-center gap-1">
                        <Wind className="w-3 h-3" /> RESP
                      </span>
                      <span className="text-slate-500 font-mono">/min</span>
                    </div>
                    <div className="text-3xl font-mono font-black text-yellow-400 tracking-tight my-1">
                      {tele.respiratoryRate || '--'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">12 - 20</div>
                  </div>

                  {/* Temperature (Orange) */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-orange-950 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between text-orange-400 text-[10px] font-bold">
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" /> TEMP
                      </span>
                      <span className="text-slate-500 font-mono">°C</span>
                    </div>
                    <div className="text-3xl font-mono font-black text-orange-400 tracking-tight my-1">
                      {tele.bodyTemperature ? tele.bodyTemperature.toFixed(1) : '--'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">36.5 - 37.5</div>
                  </div>
                </div>

                {/* Mechanical Ventilator Card (if attached to this bed) */}
                {ventilator && (
                  <div className="bg-indigo-950/20 border border-indigo-200/50 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-900 font-bold">
                        <Wind className="w-4 h-4 text-indigo-600" />
                        <span>Ventilator: {ventilator.name}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                        MODE: {ventTele.ventilatorMode || 'SIMV+PS'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center pt-1 font-mono">
                      <div className="bg-white p-1.5 rounded-lg border border-indigo-100">
                        <div className="text-[10px] text-slate-500">FiO2</div>
                        <div className="font-bold text-sm text-indigo-700">{ventTele.fio2 || 40}%</div>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-indigo-100">
                        <div className="text-[10px] text-slate-500">PEEP</div>
                        <div className="font-bold text-sm text-indigo-700">{ventTele.peep || 5.0} cmH2O</div>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-indigo-100">
                        <div className="text-[10px] text-slate-500">PIP</div>
                        <div className={`font-bold text-sm ${ventTele.peakInspiratoryPressure > 34 ? 'text-red-600 animate-pulse' : 'text-indigo-700'}`}>
                          {ventTele.peakInspiratoryPressure || 19.5} cmH2O
                        </div>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-indigo-100">
                        <div className="text-[10px] text-slate-500">Tidal Vol</div>
                        <div className="font-bold text-sm text-indigo-700">{ventTele.tidalVolume || 460} mL</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Syringe / Infusion Pump Card (if attached to this bed) */}
                {infusionPump && (
                  <div className="bg-purple-950/20 border border-purple-200/50 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-900 font-bold">
                        <Syringe className="w-4 h-4 text-purple-600" />
                        <span>Infusion Pump: {infusionPump.name}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                        {pumpTele.infusionStatus || 'INFUSING'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-purple-100">
                      <div>
                        <div className="font-semibold text-slate-900">{pumpTele.infusionDrug || 'Vasopressor Infusion'}</div>
                        <div className="text-[11px] text-slate-500">Dose: {pumpTele.infusionDose || '0.12 mcg/kg/min'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-purple-700">{pumpTele.infusionRate || 8.0} mL/h</div>
                        <div className="text-[10px] text-slate-400 font-mono">Infused: {pumpTele.totalVolumeInfused || 24.5} mL</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Device Info & Detach Action */}
              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    {patientMonitor?.deviceId}
                  </span>
                  <span>{patientMonitor?.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDetach(patientMonitor?.deviceId)}
                    className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]"
                  >
                    Detach Bed
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Attach Device to Patient Bed */}
      {isAttachOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Attach Device to Bedside</h3>
              </div>
              <button onClick={() => setIsAttachOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAttachSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Medical Device</label>
                <select
                  value={selectedDeviceForAttach}
                  onChange={(e) => setSelectedDeviceForAttach(e.target.value)}
                  className="w-full text-xs font-medium h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  <option value="">-- Choose Device --</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      [{d.deviceType.toUpperCase()}] {d.name} ({d.deviceId}) - Current: {d.assignedBed || 'Standby'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Admitted Patient</label>
                <select
                  value={selectedAdmissionId}
                  onChange={(e) => {
                    const admId = Number(e.target.value);
                    setSelectedAdmissionId(admId);
                    const adm = activeAdmissions.find((a) => a.id === admId);
                    if (adm) setSelectedBed(adm.bedNo);
                  }}
                  className="w-full text-xs font-medium h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  <option value="">-- Choose Admitted Patient --</option>
                  {activeAdmissions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.patientName} (Adm #{a.admissionNo} • {a.ward} - {a.bedNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bed Number</label>
                <input
                  type="text"
                  value={selectedBed}
                  onChange={(e) => setSelectedBed(e.target.value)}
                  placeholder="e.g. ICU-01, HDU-02"
                  className="w-full text-xs font-medium h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAttachOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  Confirm Attachment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register New Medical Device */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Register Medical Device</h3>
              </div>
              <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Device ID / Asset Code</label>
                <input
                  type="text"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  placeholder="e.g. DEV-ICU-MON-03"
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Device Name & Model</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g. Mindray ePM 12M Bedside Monitor"
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Device Category</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value)}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="patient_monitor">Multiparameter Patient Monitor</option>
                  <option value="ventilator">Mechanical ICU Ventilator</option>
                  <option value="infusion_pump">Syringe / Infusion Pump</option>
                  <option value="dialysis_crrt">CRRT / Dialysis Unit</option>
                  <option value="capnograph">EtCO2 Capnograph</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ward Location</label>
                  <select
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="ICU">Intensive Care Unit (ICU)</option>
                    <option value="HDU">High Dependency Unit (HDU)</option>
                    <option value="General Ward">General Ward</option>
                    <option value="Emergency / Triage">Emergency / Triage</option>
                    <option value="Post-Op Recovery">Post-Op Recovery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Bed (Optional)</label>
                  <input
                    type="text"
                    value={newBed}
                    onChange={(e) => setNewBed(e.target.value)}
                    placeholder="e.g. ICU-03"
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRegisterOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Register Asset
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
