'use client';

import React, { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bed,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wind,
  Activity,
  HeartPulse,
  Sparkles,
  Wrench,
  Clock,
  UserCheck,
} from 'lucide-react';
import { HospitalWard, HospitalBed, BedStatus } from '@/types';
import { updateBedStatusAction, getHospitalBedsAction } from '@/app/actions/bed-actions';

interface VisualBedOccupancyGridProps {
  initialWards: HospitalWard[];
  initialBeds: HospitalBed[];
  isDoctorOrNurse: boolean;
}

export function VisualBedOccupancyGrid({
  initialWards,
  initialBeds,
  isDoctorOrNurse,
}: VisualBedOccupancyGridProps) {
  const [wards, setWards] = useState<HospitalWard[]>(initialWards);
  const [beds, setBeds] = useState<HospitalBed[]>(initialBeds);
  const [selectedWardId, setSelectedWardId] = useState<number | 'ALL'>('ALL');
  const [isPending, startTransition] = useTransition();

  const filteredBeds = selectedWardId === 'ALL'
    ? beds
    : beds.filter((b) => b.wardId === selectedWardId);

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === 'OCCUPIED').length;
  const vacantBeds = beds.filter((b) => b.status === 'VACANT').length;
  const cleaningBeds = beds.filter((b) => b.status === 'CLEANING').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const refreshBeds = () => {
    startTransition(async () => {
      const res = await getHospitalBedsAction();
      if (res.success && res.beds) {
        setBeds(res.beds);
      }
    });
  };

  const handleStatusChange = (bedId: number, newStatus: BedStatus) => {
    startTransition(async () => {
      const res = await updateBedStatusAction(bedId, newStatus);
      if (res.success) {
        refreshBeds();
      }
    });
  };

  const getStatusBadge = (status: BedStatus) => {
    switch (status) {
      case 'OCCUPIED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Occupied
          </span>
        );
      case 'VACANT':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Vacant
          </span>
        );
      case 'CLEANING':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
            Cleaning
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <Wrench className="w-3 h-3 text-slate-400" />
            Maintenance
          </span>
        );
      case 'RESERVED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Clock className="w-3 h-3 text-blue-400" />
            Reserved
          </span>
        );
    }
  };

  return (
    <Card className="p-6 border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl text-slate-100">
      {/* Header & Floor Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Bed className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white tracking-wide">
                Hospital Floor & Ward Command Grid
              </h3>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Live Occupancy
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time inpatient bed allocation, clinical monitors, and terminal sanitization tracker
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={refreshBeds}
          disabled={isPending}
          className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPending ? 'animate-spin' : ''}`} />
          Refresh Floor
        </Button>
      </div>

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400">Overall Occupancy</span>
          <span className="text-lg font-bold text-white mt-0.5">{occupancyRate}%</span>
          <span className="text-[10px] text-slate-500">{occupiedBeds} of {totalBeds} beds occupied</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400">Available Vacant</span>
          <span className="text-lg font-bold text-emerald-400 mt-0.5">{vacantBeds}</span>
          <span className="text-[10px] text-slate-500">Ready for admission</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400">Cleaning / Disinfection</span>
          <span className="text-lg font-bold text-amber-400 mt-0.5">{cleaningBeds}</span>
          <span className="text-[10px] text-slate-500">Sanitization turnaround</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400">Total Wards</span>
          <span className="text-lg font-bold text-indigo-400 mt-0.5">{wards.length}</span>
          <span className="text-[10px] text-slate-500">ICU, Emergency, General, Deluxe</span>
        </div>
      </div>

      {/* Ward Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-3 mt-2 border-b border-slate-800/60">
        <button
          onClick={() => setSelectedWardId('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
            selectedWardId === 'ALL'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          All Wards ({totalBeds})
        </button>

        {wards.map((ward) => (
          <button
            key={ward.id}
            onClick={() => setSelectedWardId(ward.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              selectedWardId === ward.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {ward.name} ({ward.occupiedBeds}/{ward.totalBeds})
          </button>
        ))}
      </div>

      {/* Bed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-5">
        {filteredBeds.map((bed) => (
          <div
            key={bed.id}
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              bed.status === 'OCCUPIED'
                ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60'
                : bed.status === 'VACANT'
                ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-700/60'
                : bed.status === 'CLEANING'
                ? 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-xs font-mono text-slate-400 block">{bed.wardName}</span>
                  <span className="text-base font-bold text-white tracking-wide">{bed.bedNumber}</span>
                </div>
                {getStatusBadge(bed.status)}
              </div>

              {/* Equipment badges */}
              <div className="flex items-center gap-2 mt-2">
                {bed.hasOxygen && (
                  <span title="Piped Medical Oxygen" className="p-1 rounded bg-sky-950/60 text-sky-400 border border-sky-800/60 text-[10px] flex items-center gap-1">
                    <Wind className="w-3 h-3" /> O2
                  </span>
                )}
                {bed.hasVentilator && (
                  <span title="ICU Mechanical Ventilator" className="p-1 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/60 text-[10px] flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Vent
                  </span>
                )}
                {bed.hasMonitor && (
                  <span title="Multipara Patient Monitor" className="p-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] flex items-center gap-1">
                    <HeartPulse className="w-3 h-3" /> Monitor
                  </span>
                )}
                <span className="text-[10px] text-slate-400 ml-auto font-mono">
                  ₹{bed.dailyRate}/day
                </span>
              </div>

              {/* Patient Info or Vacant status */}
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs">
                {bed.status === 'OCCUPIED' ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-white truncate flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      {bed.patientName}
                    </div>
                    {bed.patientRegNo && (
                      <div className="text-[11px] text-slate-400 font-mono">{bed.patientRegNo}</div>
                    )}
                    {bed.attendingDoctor && (
                      <div className="text-[11px] text-indigo-300">Dr: {bed.attendingDoctor}</div>
                    )}
                    {bed.notes && (
                      <div className="text-[10px] text-slate-400 italic line-clamp-2 mt-1">{bed.notes}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px]">
                    {bed.status === 'VACANT' && 'Bed cleaned, sanitized, and ready.'}
                    {bed.status === 'CLEANING' && 'Housekeeping cleaning & linen replacement in progress.'}
                    {bed.status === 'MAINTENANCE' && 'Engineering maintenance.'}
                    {bed.status === 'RESERVED' && 'Bed reserved for upcoming transfer.'}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {isDoctorOrNurse && (
              <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1">
                {bed.status === 'OCCUPIED' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(bed.id, 'CLEANING')}
                    disabled={isPending}
                    className="text-[11px] h-7 px-2 text-amber-400 hover:bg-amber-950/30"
                  >
                    Send to Cleaning
                  </Button>
                )}

                {bed.status === 'CLEANING' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(bed.id, 'VACANT')}
                    disabled={isPending}
                    className="text-[11px] h-7 px-2 text-emerald-400 hover:bg-emerald-950/30"
                  >
                    Mark Clean & Vacant
                  </Button>
                )}

                {bed.status === 'VACANT' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(bed.id, 'RESERVED')}
                    disabled={isPending}
                    className="text-[11px] h-7 px-2 text-blue-400 hover:bg-blue-950/30"
                  >
                    Reserve Bed
                  </Button>
                )}

                {bed.status === 'RESERVED' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(bed.id, 'VACANT')}
                    disabled={isPending}
                    className="text-[11px] h-7 px-2 text-slate-400 hover:bg-slate-800"
                  >
                    Cancel Reservation
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
