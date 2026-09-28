'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import {
  FileText,
  Printer,
  Save,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldCheck,
  Building,
  Loader2,
  Stethoscope,
  Pill,
  Calendar,
  Clock,
} from 'lucide-react';
import { IpdAdmissionWithPatient, ClinicSettings, Medication, IpdDischarge } from '@/types';
import { formatDate } from '@/lib/utils';
import { saveIpdDischargeRecord } from '@/app/actions/ipd-discharge-actions';

interface IpdDischargeModalProps {
  admission: IpdAdmissionWithPatient;
  existingDischarge?: IpdDischarge | null;
  settings: ClinicSettings | null;
  triggerButton?: React.ReactNode;
}

export function IpdDischargeModal({
  admission,
  existingDischarge,
  settings,
  triggerButton,
}: IpdDischargeModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'EDIT' | 'PRINT'>(existingDischarge ? 'PRINT' : 'EDIT');

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [dischargeDate, setDischargeDate] = useState(existingDischarge?.dischargeDate || todayStr);
  const [dischargeTime, setDischargeTime] = useState(existingDischarge?.dischargeTime || '02:00 PM');
  const [dischargeCondition, setDischargeCondition] = useState<
    'Recovered' | 'Improved' | 'Stable' | 'LAMA' | 'Referred' | 'Deceased'
  >((existingDischarge?.dischargeCondition as any) || 'Recovered');

  const [admissionDiagnosis, setAdmissionDiagnosis] = useState(
    existingDischarge?.admissionDiagnosis || admission.admittingDiagnosis || ''
  );
  const [finalDiagnosis, setFinalDiagnosis] = useState(
    existingDischarge?.finalDiagnosis || admission.admittingDiagnosis || ''
  );
  const [clinicalSummary, setClinicalSummary] = useState(
    existingDischarge?.clinicalSummary ||
      'Patient was admitted with the above complaints. Investigated and managed conservatively with IV fluids, antibiotics, and supportive therapy. Patient showed good clinical recovery, vitals remained stable throughout the inpatient stay, and is being discharged in a hemodynamically stable condition.'
  );
  const [investigationSummary, setInvestigationSummary] = useState(
    existingDischarge?.investigationSummary || 'Routine CBC, Renal Function Tests & Serum Electrolytes within normal physiological limits.'
  );
  const [proceduresPerformed, setProceduresPerformed] = useState(
    existingDischarge?.proceduresPerformed || 'None / Conservative Medical Management'
  );

  // Vitals
  let defaultVitals = { bp: '120/80', pulse: '76', temp: '98.4°F', spo2: '99%', rr: '18' };
  try {
    if (existingDischarge?.dischargeVitals) {
      defaultVitals = { ...defaultVitals, ...JSON.parse(existingDischarge.dischargeVitals) };
    }
  } catch {}
  const [vitals, setVitals] = useState(defaultVitals);

  // Discharge Medications
  let initialMeds: Medication[] = [];
  try {
    if (existingDischarge?.dischargeMedications) {
      initialMeds = JSON.parse(existingDischarge.dischargeMedications);
    }
  } catch {}
  if (initialMeds.length === 0) {
    initialMeds = [
      { prefix: 'Tab.', name: 'Pan-40', genericName: 'Pantoprazole', strength: '40mg', dosage: '1-0-0', timing: 'Before breakfast', duration: '5 days', instruction: 'Empty stomach' },
      { prefix: 'Tab.', name: 'Dolo 650', genericName: 'Paracetamol', strength: '650mg', dosage: '1-0-1', timing: 'After food', duration: '3 days SOS', instruction: 'Take for fever / pain' },
    ];
  }
  const [medications, setMedications] = useState<Medication[]>(initialMeds);

  // Advice & Followup
  const [dietAdvice, setDietAdvice] = useState(
    existingDischarge?.dietAdvice || 'Normal home-cooked soft bland diet. Maintain adequate oral fluid hydration (2.5L/day). Avoid oily, spicy, raw street food.'
  );
  const [activityRestrictions, setActivityRestrictions] = useState(
    existingDischarge?.activityRestrictions || 'Relative rest for 3-5 days. Avoid heavy weight lifting or strenuous exertion.'
  );
  const [followUpDate, setFollowUpDate] = useState(() => {
    if (existingDischarge?.followUpDate) return existingDischarge.followUpDate;
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [followUpInstructions, setFollowUpInstructions] = useState(
    existingDischarge?.followUpInstructions || 'Review in OPD with Dr. after 5 days or SOS in emergency.'
  );
  const [urgentWarningSigns, setUrgentWarningSigns] = useState(
    existingDischarge?.urgentWarningSigns || 'Report immediately to emergency if: High fever (>101°F), persistent vomiting, severe pain, breathing difficulty, or chest discomfort.'
  );
  const [consultantDoctorName, setConsultantDoctorName] = useState(
    existingDischarge?.consultantDoctorName || settings?.doctorName || 'Dr. Attending Physician'
  );
  const [doctorRegNo, setDoctorRegNo] = useState(
    existingDischarge?.doctorRegNo || settings?.regNumber || 'REG-PENDING'
  );

  // Medication handlers
  const handleAddMed = () => {
    setMedications((prev) => [
      ...prev,
      { prefix: 'Tab.', name: '', strength: '', dosage: '1-0-1', timing: 'After food', duration: '5 days', instruction: '' },
    ]);
  };

  const handleUpdateMed = (index: number, field: keyof Medication, val: string) => {
    setMedications((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveMed = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDischarge = async () => {
    if (!finalDiagnosis.trim()) {
      toast.show({ title: 'Validation Error', description: 'Final diagnosis is required.', type: 'error' });
      return;
    }
    if (!clinicalSummary.trim()) {
      toast.show({ title: 'Validation Error', description: 'Clinical summary is required.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveIpdDischargeRecord({
        admissionId: admission.id,
        patientId: admission.patientId,
        dischargeDate,
        dischargeTime,
        dischargeCondition,
        admissionDiagnosis,
        finalDiagnosis,
        clinicalSummary,
        investigationSummary,
        proceduresPerformed,
        dischargeVitals: vitals,
        dischargeMedications: medications.filter((m) => m.name.trim()),
        dietAdvice,
        activityRestrictions,
        followUpDate,
        followUpInstructions,
        urgentWarningSigns,
        consultantDoctorName,
        doctorRegNo,
      });

      if (res.success) {
        toast.show({
          title: 'Discharge Summary Finalized!',
          description: `Official discharge card generated for ${admission.patient.name}.`,
          type: 'success',
        });
        setViewMode('PRINT');
        router.refresh();
      } else {
        toast.show({
          title: 'Error',
          description: res.error || 'Failed to finalize discharge summary.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Discharge error',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerButton ? (triggerButton as any) : (
        <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
          <FileText className="w-4 h-4 text-emerald-600" />
          {existingDischarge ? 'View Discharge Summary' : 'Discharge Summary'}
        </Button>
      )} />

      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        {/* Modal Top Control Bar (Hidden when printing) */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base text-white font-bold leading-tight">
                IPD Discharge Summary & Hospital Course
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Inpatient #{admission.admissionNo} • {admission.patient.name} ({admission.patient.age}y / {admission.patient.gender})
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('EDIT')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  viewMode === 'EDIT' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Edit Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode('PRINT')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  viewMode === 'PRINT' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Printable Card
              </button>
            </div>

            {viewMode === 'PRINT' ? (
              <Button onClick={handlePrint} size="sm" className="bg-white hover:bg-slate-100 text-slate-900 gap-1.5 text-xs font-bold shadow-2xs">
                <Printer className="w-3.5 h-3.5" /> Print Card
              </Button>
            ) : (
              <Button
                onClick={handleSaveDischarge}
                disabled={isSaving}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold shadow-2xs"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Finalize & Save
              </Button>
            )}

            <DialogClose render={<Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs" />}>
              ✕
            </DialogClose>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {viewMode === 'EDIT' ? (
            <div className="space-y-6 text-xs">
              {/* Timing & Condition Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Discharge Date *</Label>
                  <Input
                    type="date"
                    value={dischargeDate}
                    onChange={(e) => setDischargeDate(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Discharge Time</Label>
                  <Input
                    value={dischargeTime}
                    onChange={(e) => setDischargeTime(e.target.value)}
                    placeholder="e.g. 03:30 PM"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Condition at Discharge *</Label>
                  <select
                    value={dischargeCondition}
                    onChange={(e) => setDischargeCondition(e.target.value as any)}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800"
                  >
                    <option value="Recovered">Recovered / Clinically Cured</option>
                    <option value="Improved">Improved / Stable</option>
                    <option value="Stable">Stable</option>
                    <option value="LAMA">LAMA (Left Against Medical Advice)</option>
                    <option value="Referred">Referred to Higher Facility</option>
                    <option value="Deceased">Deceased</option>
                  </select>
                </div>
              </div>

              {/* Diagnoses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Provisional / Admission Diagnosis</Label>
                  <Input
                    value={admissionDiagnosis}
                    onChange={(e) => setAdmissionDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Appendicitis / Enteric Fever"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-900">Final Diagnosis *</Label>
                  <Input
                    value={finalDiagnosis}
                    onChange={(e) => setFinalDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Suppurative Appendicitis with Peritonitis"
                    className="h-8 text-xs bg-white font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Clinical Summary & Course */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-900">Hospital Clinical Course & Management Summary *</Label>
                <textarea
                  rows={3}
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Detail symptoms upon admission, response to IV therapy, clinical milestones, and status at discharge..."
                />
              </div>

              {/* Investigations & Procedures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Investigation Summary (Labs & Imaging)</Label>
                  <textarea
                    rows={2}
                    value={investigationSummary}
                    onChange={(e) => setInvestigationSummary(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    placeholder="Significant findings from Blood tests, X-rays, USG, ECG..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Procedures / Surgery Performed</Label>
                  <textarea
                    rows={2}
                    value={proceduresPerformed}
                    onChange={(e) => setProceduresPerformed(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    placeholder="Operative procedures, incision & drainage, catheterization..."
                  />
                </div>
              </div>

              {/* Discharge Vitals */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> Discharge Vitals
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">BP (mmHg)</span>
                    <Input
                      value={vitals.bp}
                      onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                      placeholder="120/80"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Pulse (bpm)</span>
                    <Input
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      placeholder="76"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Temp</span>
                    <Input
                      value={vitals.temp}
                      onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                      placeholder="98.4°F"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">SpO2 (%)</span>
                    <Input
                      value={vitals.spo2}
                      onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                      placeholder="99%"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Resp. Rate (/min)</span>
                    <Input
                      value={vitals.rr}
                      onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
                      placeholder="18"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Take-Home Discharge Medications */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" /> Take-Home Discharge Medications (Rx)
                  </Label>
                  <Button type="button" size="sm" onClick={handleAddMed} variant="outline" className="h-7 text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Medicine
                  </Button>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {medications.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                      <div className="col-span-1">
                        <select
                          value={m.prefix || 'Tab.'}
                          onChange={(e) => handleUpdateMed(idx, 'prefix', e.target.value)}
                          className="w-full h-7 px-1 text-xs border border-slate-300 rounded bg-slate-50"
                        >
                          <option value="Tab.">Tab.</option>
                          <option value="Cap.">Cap.</option>
                          <option value="Syr.">Syr.</option>
                          <option value="Inj.">Inj.</option>
                          <option value="Oint.">Oint.</option>
                        </select>
                      </div>
                      <div className="col-span-3">
                        <Input
                          placeholder="Medicine Name"
                          value={m.name}
                          onChange={(e) => handleUpdateMed(idx, 'name', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          placeholder="Strength (e.g. 500mg)"
                          value={m.strength || ''}
                          onChange={(e) => handleUpdateMed(idx, 'strength', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          placeholder="Dosage (1-0-1)"
                          value={m.dosage}
                          onChange={(e) => handleUpdateMed(idx, 'dosage', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          placeholder="Duration (5 days)"
                          value={m.duration}
                          onChange={(e) => handleUpdateMed(idx, 'duration', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          placeholder="Timing"
                          value={m.timing}
                          onChange={(e) => handleUpdateMed(idx, 'timing', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveMed(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diet, Activity, Follow-up & Red Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Diet Advice</Label>
                  <Input
                    value={dietAdvice}
                    onChange={(e) => setDietAdvice(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Physical Activity / Rest Advice</Label>
                  <Input
                    value={activityRestrictions}
                    onChange={(e) => setActivityRestrictions(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Next Follow-Up Date</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Follow-Up Instructions</Label>
                  <Input
                    value={followUpInstructions}
                    onChange={(e) => setFollowUpInstructions(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Urgent Red-Flag Emergency Warning Signs
                </Label>
                <textarea
                  rows={2}
                  value={urgentWarningSigns}
                  onChange={(e) => setUrgentWarningSigns(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-red-200 text-xs bg-red-50/40 text-red-950 focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Doctor Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Consultant Physician / Surgeon *</Label>
                  <Input
                    value={consultantDoctorName}
                    onChange={(e) => setConsultantDoctorName(e.target.value)}
                    className="h-8 text-xs bg-white font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Medical Reg. Number</Label>
                  <Input
                    value={doctorRegNo}
                    onChange={(e) => setDoctorRegNo(e.target.value)}
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* PRINTABLE DISCHARGE SUMMARY CARD VIEW */
            <div className="p-8 sm:p-10 bg-white rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 text-slate-900">
              {/* Hospital Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    {settings?.clinicName || 'HOSPITAL INPATIENT CARE'}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    {settings?.address || 'Hospital Address & Emergency Care'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Contact: {settings?.contact || '+91 Hospital Helpdesk'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-emerald-800 text-white text-[11px] font-bold uppercase tracking-wider rounded">
                    Formal Discharge Summary
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-2">
                    IPD #{admission.admissionNo}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Discharge: {formatDate(dischargeDate)} {dischargeTime}
                  </div>
                </div>
              </div>

              {/* Patient Banner */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
                  <span className="font-bold text-slate-900 text-sm">{admission.patient.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Age / Gender</span>
                  <span className="font-semibold text-slate-800">{admission.patient.age} Yrs / {admission.patient.gender}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Admission Date</span>
                  <span className="font-medium text-slate-800">{formatDate(admission.admissionDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Condition at Discharge</span>
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px] inline-block">
                    {dischargeCondition}
                  </span>
                </div>
              </div>

              {/* Diagnoses */}
              <div className="space-y-3 mb-6 text-xs">
                {admissionDiagnosis && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-700 min-w-32">Admission Diagnosis:</span>
                    <span className="text-slate-800">{admissionDiagnosis}</span>
                  </div>
                )}
                <div className="flex items-start gap-2 border-l-2 border-emerald-600 pl-2">
                  <span className="font-black text-slate-900 min-w-32">Final Diagnosis:</span>
                  <span className="font-bold text-slate-950 text-sm">{finalDiagnosis}</span>
                </div>
                {proceduresPerformed && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-700 min-w-32">Procedures / Surgery:</span>
                    <span className="text-slate-800">{proceduresPerformed}</span>
                  </div>
                )}
              </div>

              {/* Clinical Course */}
              <div className="mb-6 space-y-1.5 text-xs">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b pb-1">
                  Hospital Course & Summary of Treatment
                </div>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{clinicalSummary}</p>
                {investigationSummary && (
                  <div className="pt-2">
                    <span className="font-bold text-slate-700">Significant Investigations: </span>
                    <span className="text-slate-800">{investigationSummary}</span>
                  </div>
                )}
              </div>

              {/* Discharge Vitals */}
              <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="font-bold text-slate-800 mb-1 text-[11px] uppercase tracking-wider">
                  Vitals at Discharge
                </div>
                <div className="flex flex-wrap gap-4 font-mono text-slate-700">
                  {vitals.bp && <span>BP: <strong className="text-slate-900">{vitals.bp}</strong></span>}
                  {vitals.pulse && <span>Pulse: <strong className="text-slate-900">{vitals.pulse} bpm</strong></span>}
                  {vitals.temp && <span>Temp: <strong className="text-slate-900">{vitals.temp}</strong></span>}
                  {vitals.spo2 && <span>SpO2: <strong className="text-slate-900">{vitals.spo2}</strong></span>}
                  {vitals.rr && <span>RR: <strong className="text-slate-900">{vitals.rr}/min</strong></span>}
                </div>
              </div>

              {/* Take-Home Medications Table */}
              <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 text-xs">
                <div className="bg-slate-100 px-3 py-2 font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Take-Home Discharge Medications (Rx)
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Medicine & Strength</th>
                      <th className="py-2 px-3">Dosage</th>
                      <th className="py-2 px-3">Timing</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medications.map((m, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {m.prefix} {m.name} {m.strength}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{m.dosage}</td>
                        <td className="py-2 px-3 text-slate-600">{m.timing}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{m.duration}</td>
                        <td className="py-2 px-3 text-slate-600">{m.instruction || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Advice, Follow-up & Danger Signs */}
              <div className="space-y-3 mb-8 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                    Discharge Advice & Follow-Up
                  </div>
                  <p><strong>Diet:</strong> {dietAdvice}</p>
                  <p><strong>Activity:</strong> {activityRestrictions}</p>
                  <p>
                    <strong>Next Follow-up:</strong> {followUpDate ? formatDate(followUpDate) : 'SOS'} — {followUpInstructions}
                  </p>
                </div>

                <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-red-950">
                  <div className="font-bold text-red-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> When to Seek Emergency Medical Attention
                  </div>
                  <p className="text-[11px] leading-relaxed">{urgentWarningSigns}</p>
                </div>
              </div>

              {/* Signatures & Seal */}
              <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> MedScript Verified Hospital Discharge Summary
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    Cryptographic Seal: {existingDischarge?.digitalSealHash || 'SEAL-PENDING-FINALIZATION'}
                  </p>
                </div>

                <div className="text-right">
                  <div className="w-48 border-b border-slate-400 mb-1.5"></div>
                  <div className="font-bold text-slate-900">{consultantDoctorName}</div>
                  <div className="text-[10px] text-slate-500">Reg: {doctorRegNo} • Consultant Physician</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
