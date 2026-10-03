'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, CheckCircle2, AlertTriangle, Clock, Syringe } from 'lucide-react';
import { PatientImmunization } from '@/types';
import { administerVaccineAction, getOrInitImmunizationScheduleAction } from '@/app/actions/pediatric-actions';

interface ImmunizationTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  initialImmunizations: PatientImmunization[];
  doctorOrNurseName: string;
}

export function ImmunizationTrackerModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  initialImmunizations,
  doctorOrNurseName,
}: ImmunizationTrackerModalProps) {
  const [immunizations, setImmunizations] = useState<PatientImmunization[]>(initialImmunizations);
  const [selectedVaccine, setSelectedVaccine] = useState<PatientImmunization | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAdminister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaccine || !batchNumber) return;

    startTransition(async () => {
      const res = await administerVaccineAction({
        immunizationId: selectedVaccine.id!,
        patientId,
        batchNumber,
        manufacturer,
        administeredBy: doctorOrNurseName,
      });

      if (res.success) {
        setFeedback(`Administered ${selectedVaccine.vaccineName} successfully.`);
        const updated = await getOrInitImmunizationScheduleAction(patientId);
        if (updated.success) {
          setImmunizations(updated.immunizations);
        }
        setSelectedVaccine(null);
        setBatchNumber('');
        setManufacturer('');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback(`Error: ${res.error}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            IAP National Immunization Schedule — {patientName}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Indian Academy of Pediatrics Standard Timetable (Birth to 12 Years) with batch tracking
          </DialogDescription>
        </DialogHeader>

        {feedback && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Administration Form if a vaccine is selected */}
        {selectedVaccine && (
          <form onSubmit={handleAdminister} className="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/60 space-y-3">
            <h4 className="text-xs font-semibold text-white flex items-center gap-2">
              <Syringe className="w-4 h-4 text-indigo-400" />
              Chart Administration: {selectedVaccine.vaccineName} (Dose #{selectedVaccine.doseNumber})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-slate-400">Vaccine Batch / Lot Number*</Label>
                <Input
                  placeholder="e.g. B-99481-A"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Manufacturer</Label>
                <Input
                  placeholder="e.g. Serum Institute / Bharat Biotech"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Site & Route</Label>
                <div className="mt-2 text-xs text-indigo-300 font-mono">
                  {selectedVaccine.site} ({selectedVaccine.route})
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedVaccine(null)}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                Confirm Dose Given
              </Button>
            </div>
          </form>
        )}

        {/* Immunization Table */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2.5">Due Age</th>
                <th className="p-2.5">Vaccine</th>
                <th className="p-2.5">Dose</th>
                <th className="p-2.5">Scheduled</th>
                <th className="p-2.5">Route & Site</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Batch / Nurse</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {immunizations.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-slate-300">
                    {v.dueAgeMonths === 0 ? 'Birth' : `${v.dueAgeMonths} mo`}
                  </td>
                  <td className="p-2.5 font-semibold text-white">{v.vaccineName}</td>
                  <td className="p-2.5 text-slate-400">#{v.doseNumber}</td>
                  <td className="p-2.5 text-slate-300">{v.scheduledDate.toLocaleDateString()}</td>
                  <td className="p-2.5 text-slate-400 text-[11px]">{v.site}</td>
                  <td className="p-2.5">
                    {v.status === 'GIVEN' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Given
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                        Due
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-400 text-[11px]">
                    {v.batchNumber ? `${v.batchNumber} (${v.administeredBy || 'Nurse'})` : '—'}
                  </td>
                  <td className="p-2.5 text-right">
                    {v.status !== 'GIVEN' && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedVaccine(v)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] h-7 px-2"
                      >
                        Administer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
