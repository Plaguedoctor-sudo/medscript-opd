'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Clock,
  UserCheck,
  Stethoscope,
  Building2,
  Maximize,
  Minimize,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { getAppointments, AppointmentQueueStats } from '../actions';
import { AppointmentWithPatient } from '@/types';

function playHospitalChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.22); // A5
    gain2.gain.setValueAtTime(0.3, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 1.1);
  } catch {
    // AudioContext blocked before user gesture
  }
}

export default function QueueDisplayPage() {
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [stats, setStats] = useState<AppointmentQueueStats | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const lastAnnouncedTokenRef = useRef<number | null>(null);

  const fetchQueue = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const data = await getAppointments(todayStr);
      setAppointments(data.appointments);
      setStats(data.stats);

      // Check if newly called patient
      const inConsultation = data.appointments.find((a) => a.status === 'IN_CONSULTATION');
      if (inConsultation && inConsultation.tokenNo !== lastAnnouncedTokenRef.current) {
        lastAnnouncedTokenRef.current = inConsultation.tokenNo;
        if (isAudioEnabled) {
          playHospitalChime();
          if ('speechSynthesis' in window) {
            setTimeout(() => {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(
                `Token number ${inConsultation.tokenNo}. ${inConsultation.patient.name}. Please proceed to Consulting Room One.`
              );
              utterance.rate = 0.9;
              window.speechSynthesis.speak(utterance);
            }, 600);
          }
        }
      }
    } catch (err) {
      console.error('Queue poll error:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchQueue();
    }, 0);
    const interval = setInterval(() => {
      void fetchQueue();
    }, 5000); // 5-second polling for waiting TV

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const waitingAppointments = appointments.filter((a) => a.status === 'WAITING');
  const callingAppointment = appointments.find((a) => a.status === 'IN_CONSULTATION');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* TV Header Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              MedScript OPD Consulting Queue
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-widest font-bold">
                Live TV Display
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Please proceed to the designated consulting room when your token is called
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-mono font-bold tracking-wider text-blue-400">
              {currentTime || '--:--:--'}
            </div>
            <div className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>

          <button
            onClick={() => {
              const next = !isAudioEnabled;
              setIsAudioEnabled(next);
              if (next) playHospitalChime();
            }}
            title={isAudioEnabled ? "Mute Voice Announcements" : "Enable Audio Chime & Voice Call"}
            className={`p-2.5 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold ${
              isAudioEnabled
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            }`}
          >
            {isAudioEnabled ? (
              <>
                <Volume2 className="w-5 h-5 text-white animate-pulse" />
                <span className="hidden md:inline">Voice Call Active</span>
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5" />
                <span className="hidden md:inline">Voice Off</span>
              </>
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen for TV"}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Split Screen */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8">
        {/* Left Column (7 cols): Huge "NOW CALLING" Display */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex-1 rounded-3xl bg-gradient-to-br from-blue-950/80 via-slate-900 to-indigo-950/70 border border-blue-500/30 p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-5">
              <Volume2 className="w-96 h-96" />
            </div>

            <div className="flex items-center justify-between z-10">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-sm font-bold uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                Now Calling to Doctor
              </div>
              <div className="text-sm font-semibold text-slate-400">Consulting Room #1</div>
            </div>

            {callingAppointment ? (
              <div className="my-auto py-8 text-center z-10 space-y-4">
                <div className="text-sm font-bold uppercase tracking-widest text-blue-400">
                  TOKEN NUMBER
                </div>
                <div className="text-8xl md:text-9xl font-black tracking-tight text-white drop-shadow-[0_10px_20px_rgba(59,130,246,0.5)]">
                  #{callingAppointment.tokenNo}
                </div>
                <div className="text-3xl md:text-4xl font-extrabold text-blue-100">
                  {callingAppointment.patient.name}
                </div>
                <div className="inline-flex items-center gap-2 text-base font-semibold text-blue-300 bg-blue-900/40 px-4 py-2 rounded-xl border border-blue-700/50">
                  <Stethoscope className="w-5 h-5 text-blue-400" />
                  Attending: {callingAppointment.doctorName || 'Dr. Nitin Hiralal Sonare'}
                </div>
              </div>
            ) : (
              <div className="my-auto text-center py-16 text-slate-500 space-y-2 z-10">
                <Clock className="w-16 h-16 mx-auto text-slate-600 animate-pulse" />
                <div className="text-2xl font-bold text-slate-400">Consultation Desk In Readiness</div>
                <div className="text-sm text-slate-500">Next patient will be called shortly</div>
              </div>
            )}

            {/* Bottom KPI Bar */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 z-10 text-center">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Waiting in Lounge</div>
                <div className="text-3xl font-black text-amber-400 mt-1">
                  {stats?.waitingCount || 0}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Completed Consultations</div>
                <div className="text-3xl font-black text-emerald-400 mt-1">
                  {stats?.completedCount || 0}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Total Tokens Registered</div>
                <div className="text-3xl font-black text-blue-400 mt-1">
                  {stats?.totalToday || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Next in Line Queue */}
        <div className="lg:col-span-5 flex flex-col rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              Next in Line (Waiting)
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {waitingAppointments.length} in queue
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 mt-2 space-y-1">
            {waitingAppointments.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mb-2" />
                All waiting patients have been attended!
              </div>
            ) : (
              waitingAppointments.slice(0, 7).map((appt, idx) => (
                <div
                  key={appt.id}
                  className="py-3.5 px-3 rounded-xl flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xl text-amber-300">
                      #{appt.tokenNo}
                    </div>
                    <div>
                      <div className="font-bold text-base text-white">{appt.patient.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{appt.type.replace('_', ' ')}</span>
                        {appt.timeSlot && <span>• Slot: {appt.timeSlot}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-semibold bg-slate-800 px-2.5 py-1 rounded-full">
                      Wait ~{(idx + 1) * 10}m <ArrowRight className="w-3 h-3 text-slate-500" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Hospital Announcement Ticker */}
          <div className="pt-4 mt-auto border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              💡 <em>Please keep your prescription booklet and ABHA card ready before entering.</em>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
