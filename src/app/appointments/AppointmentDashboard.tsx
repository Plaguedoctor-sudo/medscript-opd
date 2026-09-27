'use client';

import { useState, useTransition } from 'react';
import {
  CalendarCheck,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  User,
  Tv,
  AlertTriangle,
  Stethoscope,
  X,
  Volume2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AppointmentWithPatient,
  AppointmentStatus,
  AppointmentType,
  UserRole,
  Patient,
} from '@/types';
import {
  createAppointment,
  updateAppointmentStatus,
  callNextPatientAction,
  AppointmentQueueStats,
} from './actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AppointmentDashboardProps {
  initialAppointments: AppointmentWithPatient[];
  initialStats: AppointmentQueueStats;
  selectedDate: string;
  allPatients: Patient[];
  userRole: UserRole;
}

export function AppointmentDashboard({
  initialAppointments,
  initialStats,
  selectedDate,
  allPatients,
  userRole,
}: AppointmentDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState(selectedDate);
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>(initialAppointments);
  const [stats, setStats] = useState<AppointmentQueueStats>(initialStats);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(allPatients[0]?.id || 0);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('OPD_CONSULTATION');
  const [timeSlot, setTimeSlot] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Nitin Hiralal Sonare');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  // Play audio chime when token is called
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {}
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    startTransition(() => {
      router.push(`/appointments?date=${newDate}`);
    });
  };

  const handleCallNext = async () => {
    setCalling(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await callNextPatientAction(date);
      if (res.success && res.calledToken) {
        playChime();
        setSuccessMsg(`Now Calling: Token #${res.calledToken} - ${res.calledPatient}!`);
        startTransition(() => router.refresh());
      } else {
        setErrorMsg(res.error || 'No patients waiting in queue.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setCalling(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: AppointmentStatus) => {
    const res = await updateAppointmentStatus(id, newStatus);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      );
      startTransition(() => router.refresh());
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setErrorMsg('Please select a patient.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await createAppointment({
      patientId: Number(selectedPatientId),
      appointmentDate: date,
      timeSlot,
      doctorName,
      type: appointmentType,
      chiefComplaint,
    });

    if (res.success) {
      setSuccessMsg(`Token #${res.tokenNo} generated successfully!`);
      setTimeout(() => {
        setShowAddModal(false);
        setSuccessMsg(null);
        startTransition(() => router.refresh());
      }, 800);
    } else {
      setErrorMsg(res.error || 'Failed to create token.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Call Next Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Live Calling Card */}
        <div className="md:col-span-2 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
            <Volume2 className="w-48 h-48" />
          </div>

          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                OPD Live Queue Board
              </span>
            </div>
            <div className="text-xs text-blue-200 font-medium">Date: {date}</div>
          </div>

          <div className="my-4 z-10">
            <div className="text-xs text-blue-200 uppercase font-semibold">Currently In Consultation</div>
            {stats.currentCallingToken ? (
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-5xl font-black text-white tracking-tight">
                  #{stats.currentCallingToken}
                </span>
                <div>
                  <div className="text-xl font-bold text-white leading-tight">
                    {stats.currentCallingPatient}
                  </div>
                  <div className="text-xs text-blue-200 mt-0.5">
                    Consulting: {stats.currentCallingDoctor || 'Doctor on Duty'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-white/80 mt-1">Waiting for next patient</div>
            )}
          </div>

          <div className="flex items-center gap-3 z-10 pt-2 border-t border-white/20">
            <Button
              onClick={handleCallNext}
              disabled={calling}
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-blue-900" />
              {calling ? 'Calling...' : 'Call Next Patient in Queue'}
            </Button>

            <Link href="/appointments/queue" target="_blank">
              <Button
                variant="outline"
                className="bg-blue-600/40 border-white/30 text-white hover:bg-blue-600/70 text-xs gap-1.5"
              >
                <Tv className="w-3.5 h-3.5" /> Launch TV Display Board
              </Button>
            </Link>
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="bg-white p-5 rounded-2xl border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Waiting in Queue</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-4xl font-black text-amber-700 my-2">{stats.waitingCount}</div>
          <div className="text-xs text-slate-500">Estimated wait: ~{stats.waitingCount * 12} mins</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-4xl font-black text-emerald-700 my-2">{stats.completedCount}</div>
          <div className="text-xs text-slate-500">Total Tokens Registered: {stats.totalToday}</div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Control Bar: Date Selector & Book Token Button */}
      <div className="bg-white p-4 rounded-xl border shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-slate-600">Schedule Date:</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-40 text-xs"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDateChange(new Date().toISOString().split('T')[0])}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Today
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
        >
          <Plus className="w-4 h-4" /> Book OPD Token
        </Button>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
        <div className="p-4 border-b bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            Tokens &amp; Appointments for {date} ({appointments.length})
          </h3>
          <span className="text-xs text-slate-500">Ordered by Token Sequence</span>
        </div>

        <div className="divide-y divide-slate-100">
          {appointments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CalendarCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              No appointment tokens booked for {date}. Click &quot;Book OPD Token&quot; above to generate one.
            </div>
          ) : (
            appointments.map((appt) => {
              const isCalling = appt.status === 'IN_CONSULTATION';
              const isWaiting = appt.status === 'WAITING';
              const isCompleted = appt.status === 'COMPLETED';

              return (
                <div
                  key={appt.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isCalling ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Big Token Number Badge */}
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs border ${
                        isCalling
                          ? 'bg-blue-600 text-white border-blue-700 animate-pulse'
                          : isWaiting
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase leading-none opacity-80">Token</span>
                      <span className="text-2xl leading-tight">#{appt.tokenNo}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{appt.patient.name}</span>
                        <span className="text-xs text-slate-500">
                          ({appt.patient.age}y / {appt.patient.gender})
                        </span>
                        {appt.patient.bloodGroup && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                            {appt.patient.bloodGroup}
                          </span>
                        )}
                        {appt.patient.regNo && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {appt.patient.regNo}
                          </span>
                        )}
                      </div>

                      {/* Allergies Highlight */}
                      {appt.patient.allergies && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Allergic to: {appt.patient.allergies}
                        </div>
                      )}

                      <div className="text-xs text-slate-600 flex items-center gap-3">
                        <span className="flex items-center gap-1 font-medium">
                          <Stethoscope className="w-3 h-3 text-slate-400" />
                          {appt.doctorName}
                        </span>
                        {appt.timeSlot && <span className="text-slate-400">• Slot: {appt.timeSlot}</span>}
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {appt.type.replace('_', ' ')}
                        </span>
                      </div>

                      {appt.chiefComplaint && (
                        <div className="text-xs text-slate-500 italic">
                          Complaint: &quot;{appt.chiefComplaint}&quot;
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Controls */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {/* Write Prescription Shortcut */}
                    <Link href={`/prescription/new?patientId=${appt.patient.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1 text-purple-700 border-purple-200 hover:bg-purple-50"
                      >
                        <FileText className="w-3.5 h-3.5" /> Consult &amp; Rx
                      </Button>
                    </Link>

                    {isWaiting && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(appt.id, 'IN_CONSULTATION')}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                      >
                        <Play className="w-3 h-3" /> Call In
                      </Button>
                    )}

                    {isCalling && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                      </Button>
                    )}

                    <select
                      value={appt.status}
                      onChange={(e) => handleStatusChange(appt.id, e.target.value as AppointmentStatus)}
                      className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 shadow-xs"
                    >
                      <option value="WAITING">Waiting</option>
                      <option value="IN_CONSULTATION">In Consultation</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="NO_SHOW">No Show</option>
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Book OPD Token Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-600" /> Book OPD Queue Token
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <Label className="text-xs font-semibold">Select Patient *</Label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.age}y, {p.gender}) {p.allergies ? `⚠️ Allergic: ${p.allergies}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Appointment Type</Label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="OPD_CONSULTATION">OPD Consultation</option>
                    <option value="FOLLOW_UP">Follow-Up Review</option>
                    <option value="EMERGENCY">Emergency / Priority</option>
                    <option value="VACCINATION">Vaccination</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Approx Time Slot</Label>
                  <Input
                    placeholder="e.g. 10:30 AM"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Attending Doctor</Label>
                <Input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Chief Complaint / Reason for Visit</Label>
                <Input
                  placeholder="e.g. Fever with chills, follow-up BP check, severe knee pain"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Generate Token
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
