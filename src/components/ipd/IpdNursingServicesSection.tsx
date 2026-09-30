'use client';

/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Inpatient Nursing Procedures & Clinical Services Log
 * Explicitly records and displays Administering Nurse and Round Attending Doctor names
 * for Oxygen Therapy, Airway Suctioning, Surgical Drainage Care, and other bedside interventions.
 */

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wind,
  Activity,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Stethoscope,
  HeartPulse,
  Droplet,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { IpdClinicalService, ClinicalServiceType } from '@/types';
import { addClinicalServiceAction, deleteClinicalServiceAction } from '@/app/ipd/actions';
import { formatDateTime } from '@/lib/utils';

interface IpdNursingServicesSectionProps {
  admissionId: number;
  patientId: number;
  initialServices: IpdClinicalService[];
  userRole?: string;
  currentStaffName?: string;
  attendingDoctorName?: string;
}

const SERVICE_PRESETS: Array<{
  type: ClinicalServiceType;
  name: string;
  defaultDetails: string;
  label: string;
}> = [
  {
    type: 'OXYGEN_THERAPY',
    name: 'Oxygen Inhalation (Nasal Cannula / Mask)',
    defaultDetails: '3 L/min via Nasal Cannula; target SpO2 > 95%',
    label: '🫁 Oxygen Therapy',
  },
  {
    type: 'SUCTIONING',
    name: 'Oral / Endotracheal Airway Suctioning',
    defaultDetails: 'Endotracheal suctioning under aseptic technique; copious mucous aspirated',
    label: '🌪️ Airway Suctioning',
  },
  {
    type: 'DRAINAGE_CARE',
    name: 'Surgical / Chest Tube Drain Care & Output',
    defaultDetails: 'Emptied 120 mL serosanguinous fluid; negative suction re-established',
    label: '🩸 Drainage Care',
  },
  {
    type: 'NEBULIZATION',
    name: 'Bronchodilator / Saline Nebulization',
    defaultDetails: 'Nebulization with Duolin + Budecort respules over 15 mins',
    label: '💨 Nebulization',
  },
  {
    type: 'CATHETER_CARE',
    name: 'Foley Catheter Care & Bladder Wash',
    defaultDetails: 'Perineal care completed, catheter position verified, bag emptied',
    label: '💧 Catheter Care',
  },
  {
    type: 'WOUND_DRESSING',
    name: 'Sterile Surgical Wound Dressing',
    defaultDetails: 'Surgical incision inspected; dry & clean; sterile dressing replaced',
    label: '🩹 Wound Dressing',
  },
];

export function IpdNursingServicesSection({
  admissionId,
  patientId,
  initialServices,
  userRole,
  currentStaffName,
  attendingDoctorName,
}: IpdNursingServicesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [services, setServices] = useState<IpdClinicalService[]>(initialServices);

  // Filter state
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal form state
  const [isOpen, setIsOpen] = useState(false);
  const [serviceType, setServiceType] = useState<ClinicalServiceType>('OXYGEN_THERAPY');
  const [serviceName, setServiceName] = useState('Oxygen Inhalation (Nasal Cannula / Mask)');
  const [flowRateOrDetails, setFlowRateOrDetails] = useState('3 L/min via Nasal Cannula; target SpO2 > 95%');
  const [nurseName, setNurseName] = useState(
    currentStaffName || (userRole === 'nurse' ? 'Staff Nurse' : 'Sister on Duty')
  );
  const [doctorName, setDoctorName] = useState(attendingDoctorName || 'Dr. Attending Physician');
  const [performedAt, setPerformedAt] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState<'COMPLETED' | 'ONGOING' | 'DISCONTINUED'>('COMPLETED');

  const filteredServices = services.filter((s) => {
    if (filterType === 'ALL') return true;
    return s.serviceType === filterType;
  });

  const handleOpenAdd = (presetType?: ClinicalServiceType) => {
    const pType = presetType || 'OXYGEN_THERAPY';
    setServiceType(pType);
    const preset = SERVICE_PRESETS.find((p) => p.type === pType);
    if (preset) {
      setServiceName(preset.name);
      setFlowRateOrDetails(preset.defaultDetails);
    }
    setNurseName(currentStaffName || (userRole === 'nurse' ? 'Staff Nurse' : 'Sister on Duty'));
    setDoctorName(attendingDoctorName || 'Dr. Attending Physician');
    setObservations('');
    setStatus('COMPLETED');
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setPerformedAt(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setIsOpen(true);
  };

  const handleSelectPreset = (preset: (typeof SERVICE_PRESETS)[0]) => {
    setServiceType(preset.type);
    setServiceName(preset.name);
    setFlowRateOrDetails(preset.defaultDetails);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      toast.show({ title: 'Validation Error', description: 'Procedure name is required.', type: 'error' });
      return;
    }
    if (!nurseName.trim() || !doctorName.trim()) {
      toast.show({
        title: 'Validation Error',
        description: 'Both administering nurse and round attending doctor names must be provided.',
        type: 'error',
      });
      return;
    }

    startTransition(async () => {
      const res = await addClinicalServiceAction({
        admissionId,
        patientId,
        serviceType,
        serviceName,
        flowRateOrDetails,
        nurseName,
        attendingDoctorName: doctorName,
        performedAt,
        observations,
        status,
      });

      if (res.success && res.id) {
        const newRecord: IpdClinicalService = {
          id: res.id,
          admissionId,
          patientId,
          serviceType,
          serviceName,
          flowRateOrDetails,
          nurseName,
          attendingDoctorName: doctorName,
          performedAt: new Date(performedAt),
          observations,
          status,
          createdAt: new Date(),
        };
        setServices((prev) => [newRecord, ...prev]);
        setIsOpen(false);
        toast.show({
          title: 'Procedure Recorded',
          description: `${serviceName} administered by Nurse ${nurseName} (Ordered by Dr. ${doctorName}).`,
          type: 'success',
        });
        router.refresh();
      } else {
        toast.show({
          title: 'Failed to Save',
          description: res.error || 'Server error occurred.',
          type: 'error',
        });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this bedside procedure entry?')) return;
    startTransition(async () => {
      const res = await deleteClinicalServiceAction(id, admissionId);
      if (res.success) {
        setServices((prev) => prev.filter((s) => s.id !== id));
        toast.show({ title: 'Record Removed', description: 'Procedure entry deleted.', type: 'info' });
        router.refresh();
      } else {
        toast.show({ title: 'Error', description: res.error || 'Could not delete entry.', type: 'error' });
      }
    });
  };

  const getServiceBadge = (type: string) => {
    switch (type) {
      case 'OXYGEN_THERAPY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Wind className="w-3 h-3 text-sky-600" /> Oxygen Therapy
          </span>
        );
      case 'SUCTIONING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
            <Activity className="w-3 h-3 text-cyan-600" /> Suctioning
          </span>
        );
      case 'DRAINAGE_CARE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Droplet className="w-3 h-3 text-amber-600" /> Drain Care
          </span>
        );
      case 'NEBULIZATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
            <Wind className="w-3 h-3 text-teal-600" /> Nebulization
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Layers className="w-3 h-3 text-purple-600" /> Bedside Care
          </span>
        );
    }
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-teal-200 pb-3 mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center">
              <Wind className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-teal-950 uppercase tracking-wider">
              Inpatient Nursing Procedures &amp; Clinical Services ({services.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Surveillance of Oxygen therapy, Airway suctioning, Surgical drainage care, and bedside clinical interventions.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <Button
            size="sm"
            onClick={() => handleOpenAdd('OXYGEN_THERAPY')}
            className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white gap-1 font-semibold"
          >
            <Wind className="w-3.5 h-3.5" /> Log Oxygen
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenAdd('SUCTIONING')}
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white gap-1 font-semibold"
          >
            <Activity className="w-3.5 h-3.5" /> Log Suction
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenAdd('DRAINAGE_CARE')}
            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1 font-semibold"
          >
            <Droplet className="w-3.5 h-3.5" /> Log Drain
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAdd('OTHER')}
            className="h-7 text-xs border-teal-300 text-teal-800 hover:bg-teal-50 gap-1 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Other Procedure
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 mb-3 print:hidden">
        <button
          type="button"
          onClick={() => setFilterType('ALL')}
          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({services.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('OXYGEN_THERAPY')}
          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'OXYGEN_THERAPY' ? 'bg-sky-700 text-white' : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
          }`}
        >
          Oxygen ({services.filter((s) => s.serviceType === 'OXYGEN_THERAPY').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('SUCTIONING')}
          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'SUCTIONING' ? 'bg-cyan-700 text-white' : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
          }`}
        >
          Suction ({services.filter((s) => s.serviceType === 'SUCTIONING').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('DRAINAGE_CARE')}
          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-colors ${
            filterType === 'DRAINAGE_CARE' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          Drainage ({services.filter((s) => s.serviceType === 'DRAINAGE_CARE').length})
        </button>
      </div>

      {/* Services List Table */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          No nursing procedures or oxygen/suction/drainage services logged yet. Click the buttons above to log bedside care.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Date &amp; Time</th>
                <th className="px-3 py-2.5">Procedure &amp; Type</th>
                <th className="px-3 py-2.5">Clinical Details / Flow Rate</th>
                <th className="px-3 py-2.5">Administering Nurse</th>
                <th className="px-3 py-2.5">Round Attending Doctor</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {s.performedAt ? formatDateTime(s.performedAt) : 'N/A'}
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-900">{s.serviceName}</div>
                    <div className="mt-0.5">{getServiceBadge(s.serviceType)}</div>
                  </td>

                  <td className="px-3 py-2.5 max-w-xs">
                    {s.flowRateOrDetails && (
                      <div className="font-semibold text-slate-800 text-[11px]">{s.flowRateOrDetails}</div>
                    )}
                    {s.observations && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5">{s.observations}</div>
                    )}
                  </td>

                  {/* Administering Nurse Attribution */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                      <HeartPulse className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Nurse {s.nurseName}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">Bedside Nurse</span>
                  </td>

                  {/* Round Attending Doctor Attribution */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-bold text-indigo-950 flex items-center gap-1 text-[11px]">
                      <Stethoscope className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span>{s.attendingDoctorName.startsWith('Dr.') ? s.attendingDoctorName : `Dr. ${s.attendingDoctorName}`}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">Attending Doctor</span>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : s.status === 'ONGOING'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" /> {s.status}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 text-right whitespace-nowrap print:hidden">
                    {(userRole === 'admin_doctor' || userRole === 'doctor' || userRole === 'nurse') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(s.id)}
                        className="h-6 w-6 text-slate-400 hover:text-red-600"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Nursing Service / Procedure Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Log Inpatient Nursing Procedure / Service
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Records execution details, administering nurse, and round attending doctor credentials.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Preset selection bar */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">Quick Select Procedure</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_PRESETS.map((p) => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`text-[11px] px-2 py-1 rounded-md border font-medium transition-colors ${
                        serviceType === p.type
                          ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Procedure Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Procedure / Service Name *</Label>
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Oxygen Therapy, Oral Suctioning, Chest Drain Milking"
                  required
                  className="h-8 text-xs font-semibold text-slate-900"
                />
              </div>

              {/* Clinical Details / Flow Rate / Volume */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Procedure Parameters &amp; Details (Flow Rate / Volume / Equipment) *
                </Label>
                <Input
                  value={flowRateOrDetails}
                  onChange={(e) => setFlowRateOrDetails(e.target.value)}
                  placeholder="e.g. 3 L/min via Nasal Cannula, SpO2 rose from 91% to 98%"
                  required
                  className="h-8 text-xs font-medium"
                />
              </div>

              {/* Attribution: Administering Nurse & Round Attending Doctor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-600" /> Administering Nurse *
                  </Label>
                  <Input
                    value={nurseName}
                    onChange={(e) => setNurseName(e.target.value)}
                    placeholder="Nurse Full Name"
                    required
                    className="h-8 text-xs font-bold bg-white text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Name of nurse administering service</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-600" /> Round Attending Doctor *
                  </Label>
                  <Input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Doctor Full Name"
                    required
                    className="h-8 text-xs font-bold bg-white text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Attending physician authorizing service</span>
                </div>
              </div>

              {/* Date & Time and Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-600" /> Date &amp; Exact Time *
                  </Label>
                  <Input
                    type="datetime-local"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    required
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Status</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'COMPLETED' | 'ONGOING' | 'DISCONTINUED')}
                    className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-900"
                  >
                    <option value="COMPLETED">COMPLETED (Successfully Administered)</option>
                    <option value="ONGOING">ONGOING (Active Continuous Therapy)</option>
                    <option value="DISCONTINUED">DISCONTINUED (Therapy Stopped / Weaned)</option>
                  </select>
                </div>
              </div>

              {/* Clinical Observations */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Patient Clinical Tolerance &amp; Notes</Label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="e.g. Patient tolerated well, respiratory effort normalized, vitals stable."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
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
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Service Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
