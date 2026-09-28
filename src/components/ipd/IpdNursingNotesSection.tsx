'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Plus,
  Trash2,
  Clock,
  User,
  Activity,
  CheckCircle2,
  Loader2,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
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
import { IpdNursingNote, IpdAdmissionWithPatient } from '@/types';
import { formatDate } from '@/lib/utils';
import { addIpdNursingNote, deleteIpdNursingNote } from '@/app/actions/ipd-discharge-actions';

interface IpdNursingNotesSectionProps {
  admission: IpdAdmissionWithPatient;
  notes: IpdNursingNote[];
  currentStaffName?: string;
  userRole?: string;
}

export function IpdNursingNotesSection({
  admission,
  notes,
  currentStaffName,
  userRole,
}: IpdNursingNotesSectionProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [shiftDate, setShiftDate] = useState(todayStr);
  const [nurseName, setNurseName] = useState(currentStaffName || 'Duty Nurse');
  const [observations, setObservations] = useState('');
  const [vitalsSummary, setVitalsSummary] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observations.trim()) {
      toast.show({ title: 'Validation Error', description: 'Patient observations are required.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addIpdNursingNote({
        admissionId: admission.id,
        patientId: admission.patientId,
        shift,
        shiftDate,
        nurseName,
        observations,
        vitalsSummary,
        handoverNotes,
      });

      if (res.success) {
        toast.show({
          title: 'Handover Note Saved',
          description: `${shift} shift note recorded by ${nurseName}.`,
          type: 'success',
        });
        setModalOpen(false);
        setObservations('');
        setVitalsSummary('');
        setHandoverNotes('');
        router.refresh();
      } else {
        toast.show({
          title: 'Error',
          description: res.error || 'Failed to record nursing note.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error adding note',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this nursing handover note?')) return;
    try {
      const res = await deleteIpdNursingNote(noteId, admission.id);
      if (res.success) {
        toast.show({ title: 'Note Deleted', description: 'Handover note removed.', type: 'info' });
        router.refresh();
      }
    } catch {
      // ignore
    }
  };

  const getShiftBadge = (s: string) => {
    switch (s) {
      case 'Morning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Sun className="w-3 h-3 text-amber-600" /> Morning Shift
          </span>
        );
      case 'Evening':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Sunset className="w-3 h-3 text-sky-600" /> Evening Shift
          </span>
        );
      case 'Night':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Moon className="w-3 h-3 text-indigo-600" /> Night Shift
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
            {s}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Shift-to-Shift Nursing Handover Notes</h3>
            <p className="text-[11px] text-slate-500">
              Bedside nurse observations, cannula care, vital trends & task handovers between shifts.
            </p>
          </div>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs print:hidden" />}>
            <Plus className="w-3.5 h-3.5" /> Add Shift Note
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>Record Nursing Handover Note</DialogTitle>
                <DialogDescription>
                  Record patient status at end of shift for the incoming nursing team.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Shift *</Label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value as any)}
                      className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs"
                    >
                      <option value="Morning">Morning (08:00 AM - 02:00 PM)</option>
                      <option value="Evening">Evening (02:00 PM - 08:00 PM)</option>
                      <option value="Night">Night (08:00 PM - 08:00 AM)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shift Date *</Label>
                    <Input
                      type="date"
                      value={shiftDate}
                      onChange={(e) => setShiftDate(e.target.value)}
                      className="h-8 text-xs bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Duty Nurse Name *</Label>
                  <Input
                    value={nurseName}
                    onChange={(e) => setNurseName(e.target.value)}
                    placeholder="Staff Nurse Name"
                    className="h-8 text-xs bg-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Patient Observations & General Condition *</Label>
                  <textarea
                    rows={3}
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="General status, pain score, oral intake, IV cannula site, drain output, mobility..."
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Vitals Summary (Optional)</Label>
                  <Input
                    value={vitalsSummary}
                    onChange={(e) => setVitalsSummary(e.target.value)}
                    placeholder="e.g. BP 120/80, Pulse 76, Temp 98.4F, SpO2 99%"
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tasks Handed Over to Incoming Shift</Label>
                  <textarea
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Check 4 PM RBS, repeat CBC sample at 6 AM, IV antibiotic due at 8 PM..."
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between gap-2">
                <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700 text-white">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Handover Note'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {notes.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No nursing handover notes recorded yet for this admission.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getShiftBadge(n.shift)}
                  <span className="font-bold text-slate-900">{formatDate(n.shiftDate)}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 flex items-center gap-1 font-medium">
                    <User className="w-3 h-3 text-slate-400" /> {n.nurseName}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  className="text-slate-400 hover:text-red-600 print:hidden"
                  title="Delete Note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{n.observations}</p>

              {n.vitalsSummary && (
                <div className="text-[11px] font-mono text-slate-600 bg-white p-1.5 rounded border border-slate-200/80 inline-block">
                  <Activity className="w-3 h-3 inline mr-1 text-teal-600" />
                  {n.vitalsSummary}
                </div>
              )}

              {n.handoverNotes && (
                <div className="text-[11px] text-teal-900 bg-teal-50/80 p-2 rounded-lg border border-teal-200">
                  <strong className="text-teal-950 block text-[10px] uppercase font-bold">Tasks for Incoming Shift:</strong>
                  {n.handoverNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
