'use client';

/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Inpatient Bedside eMAR (Electronic Medication Administration Record)
 * Clearly records and displays Prescribing Attending Doctor and Administering Nurse.
 */

import { useState, useTransition } from 'react';
import {
  Pill,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Trash2,
  ShieldCheck,
  X,
  Stethoscope,
  HeartPulse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmarRecord, EmarStatus } from '@/types';
import {
  addEmarRecordAction,
  updateEmarDoseStatusAction,
  deleteEmarRecordAction,
} from '@/app/ipd/actions';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/utils';

interface NurseEmarSectionProps {
  admissionId: number;
  initialRecords: EmarRecord[];
  userRole?: string;
  currentStaffName?: string;
  attendingDoctorName?: string;
}

export function NurseEmarSection({
  admissionId,
  initialRecords,
  userRole,
  currentStaffName,
  attendingDoctorName,
}: NurseEmarSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [records, setRecords] = useState<EmarRecord[]>(initialRecords);
  const [showAddModal, setShowAddModal] = useState(false);

  // Administer dose modal state
  const [administerTargetId, setAdministerTargetId] = useState<number | null>(null);
  const [administeringNurseName, setAdministeringNurseName] = useState(
    currentStaffName || (userRole === 'nurse' ? 'Staff Nurse' : 'Sister on Duty')
  );

  // Withhold modal state
  const [withholdTargetId, setWithholdTargetId] = useState<number | null>(null);
  const [withholdReason, setWithholdReason] = useState('');

  // Schedule modal form state
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('IV Infusion');
  const [scheduledTimeString, setScheduledTimeString] = useState('');
  const [prescribedBy, setPrescribedBy] = useState(attendingDoctorName || 'Dr. Attending Physician');
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStatusUpdate = async (
    id: number,
    status: EmarStatus,
    extraNotes?: string,
    nurseNameOverride?: string
  ) => {
    const finalNurseName = nurseNameOverride || administeringNurseName || currentStaffName || 'Staff Nurse';
    const res = await updateEmarDoseStatusAction(id, status, admissionId, extraNotes, finalNurseName);
    if (res.success) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                nurseName: status === 'GIVEN' ? finalNurseName : r.nurseName,
                administeredAt: status === 'GIVEN' ? new Date() : null,
                notes: extraNotes || r.notes,
              }
            : r
        )
      );
      setAdministerTargetId(null);
      setWithholdTargetId(null);
      setWithholdReason('');
      startTransition(() => router.refresh());
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this scheduled medication order?')) return;
    const res = await deleteEmarRecordAction(id, admissionId);
    if (res.success) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      startTransition(() => router.refresh());
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicationName || !dosage) {
      setErrorMsg('Medication name and dosage are required.');
      return;
    }

    const scheduledDate = scheduledTimeString
      ? new Date(scheduledTimeString).getTime()
      : Date.now();

    const res = await addEmarRecordAction({
      admissionId,
      medicationName,
      dosage,
      route,
      scheduledTime: scheduledDate,
      prescribedBy: prescribedBy.trim() || attendingDoctorName || 'Attending Physician',
      notes,
    });

    if (res.success) {
      setShowAddModal(false);
      setMedicationName('');
      setDosage('');
      setNotes('');
      setErrorMsg(null);
      startTransition(() => router.refresh());
    } else {
      setErrorMsg(res.error || 'Failed to schedule dose.');
    }
  };

  const routes = ['Oral', 'IV Infusion', 'IV Bolus', 'IM', 'SC', 'Nebulization', 'Topical', 'Sublingual'];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between border-b-2 border-emerald-200 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center">
            <Pill className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider">
              Inpatient Nurse eMAR (Electronic Medication Administration) ({records.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Prescribing attending doctor and administering nurse names recorded on every dose.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            setPrescribedBy(attendingDoctorName || 'Dr. Attending Physician');
            setShowAddModal(true);
          }}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-7 px-2.5 print:hidden"
        >
          <Plus className="w-3.5 h-3.5" /> Schedule Dose
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          No scheduled medication administration doses recorded. Click &quot;Schedule Dose&quot; to add doctor&apos;s treatment orders to the bedside nurse chart.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Scheduled Time</th>
                <th className="px-3 py-3">Medication &amp; Dosage</th>
                <th className="px-3 py-3">Route</th>
                <th className="px-3 py-3">Prescribed By (Doctor)</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Administered By (Nurse)</th>
                <th className="px-4 py-3 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => {
                const isGiven = r.status === 'GIVEN';
                const isPendingDose = r.status === 'PENDING';
                const isWithheld = r.status === 'WITHHELD';
                const isRefused = r.status === 'REFUSED';

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {r.scheduledTime
                          ? new Date(r.scheduledTime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : 'Stat'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {r.scheduledTime ? new Date(r.scheduledTime).toLocaleDateString('en-IN') : ''}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{r.medicationName}</div>
                      <div className="text-[11px] text-slate-600 font-medium">{r.dosage}</div>
                      {r.notes && <div className="text-[10px] text-slate-400 italic mt-0.5">{r.notes}</div>}
                    </td>

                    <td className="px-3 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {r.route || 'Oral'}
                      </span>
                    </td>

                    {/* Prescribed By Doctor */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-slate-800 font-semibold text-[11px]">
                        <Stethoscope className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>{r.prescribedBy || attendingDoctorName || 'Dr. Attending'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      {isGiven ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> GIVEN
                        </span>
                      ) : isPendingDose ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" /> PENDING
                        </span>
                      ) : isWithheld ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-600" /> WITHHELD
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          <XCircle className="w-3 h-3 text-slate-500" /> REFUSED
                        </span>
                      )}
                    </td>

                    {/* Administered By Nurse */}
                    <td className="px-3 py-3 text-slate-600">
                      {isGiven && r.nurseName ? (
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <HeartPulse className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>Nurse {r.nurseName}</span>
                          </div>
                          {r.administeredAt && (
                            <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {formatDateTime(r.administeredAt)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Pending administration</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right print:hidden">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPendingDose && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setAdministeringNurseName(currentStaffName || 'Staff Nurse');
                                setAdministerTargetId(r.id);
                              }}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 font-semibold"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Administer
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setWithholdTargetId(r.id)}
                              className="h-7 text-xs text-rose-700 hover:bg-rose-50 px-2"
                            >
                              Withhold
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(r.id)}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Administer Medication Nurse Confirmation Modal */}
      {administerTargetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Confirm Bedside Administration
            </h3>
            <p className="text-xs text-slate-500">
              Confirm patient identity, 5 rights of medication administration, and verify the administering nurse&apos;s name.
            </p>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Administering Nurse Name *</Label>
              <Input
                autoFocus
                placeholder="Nurse Full Name"
                value={administeringNurseName}
                onChange={(e) => setAdministeringNurseName(e.target.value)}
                className="text-xs font-semibold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => setAdministerTargetId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(administerTargetId, 'GIVEN', undefined, administeringNurseName)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Sign &amp; Record Administration
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Withhold Reason Modal */}
      {withholdTargetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Withhold Medication Dose</h3>
            <p className="text-xs text-slate-500">
              Provide clinical rationale for withholding dose (e.g. Patient NPO, hypotension BP &lt; 90/60, vomited).
            </p>
            <Input
              autoFocus
              placeholder="e.g. Withheld due to low BP 85/55"
              value={withholdReason}
              onChange={(e) => setWithholdReason(e.target.value)}
              className="text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setWithholdTargetId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(withholdTargetId, 'WITHHELD', withholdReason)}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Withhold
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Dose Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Schedule Bedside Medication Dose
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-semibold">Medication Name *</Label>
                <Input
                  required
                  placeholder="e.g. Inj Pantoprazole, IV Ringer Lactate 500ml, Duolin Respule"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Dosage / Instructions *</Label>
                  <Input
                    required
                    placeholder="e.g. 40mg IV stat, 75ml/hr"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Route</Label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {routes.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prescribing Attending Doctor */}
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-indigo-600" /> Prescribing Attending Doctor *
                </Label>
                <Input
                  required
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={prescribedBy}
                  onChange={(e) => setPrescribedBy(e.target.value)}
                  className="mt-1 text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Scheduled Date &amp; Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledTimeString}
                  onChange={(e) => setScheduledTimeString(e.target.value)}
                  className="mt-1 text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Leave blank for immediate/current shift</p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Nurse Notes / Infusion Rate</Label>
                <Input
                  placeholder="e.g. Over 30 mins, check vitals Q1H"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Add to eMAR Chart
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
