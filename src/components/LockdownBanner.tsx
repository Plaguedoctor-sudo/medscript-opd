'use client';

import React, { useState, useTransition } from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Radio,
  AlertOctagon,
  EyeOff,
  RefreshCw,
  X,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from './ui/toast';
import {
  liftEmergencyLockdownAction,
  toggleDeceptionModeAction,
  triggerEmergencyLockdownAction,
} from '@/app/actions/security-alert-actions';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface LockdownBannerProps {
  initialStatus: {
    lockdownActive: boolean;
    lockdownReason: string | null;
    lockdownTriggeredAt: Date | null;
    deceptionModeActive: boolean;
  };
  userRole?: string;
}

export function LockdownBanner({ initialStatus, userRole = 'doctor' }: LockdownBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [doctorPin, setDoctorPin] = useState('');
  const [unlockError, setUnlockError] = useState('');

  if (!status.lockdownActive && !status.deceptionModeActive) {
    return null;
  }

  const handleLiftLockdown = () => {
    setUnlockError('');
    if (!doctorPin.trim()) {
      setUnlockError('Please enter your Doctor PIN to authorize lockdown removal.');
      return;
    }

    startTransition(async () => {
      const res = await liftEmergencyLockdownAction(doctorPin.trim());
      if (res.success) {
        toast.success(
          'System Restored',
          'Emergency lockdown lifted. Normal clinical operations resumed.'
        );
        setStatus((prev) => ({
          ...prev,
          lockdownActive: false,
          lockdownReason: null,
          lockdownTriggeredAt: null,
          deceptionModeActive: false,
        }));
        setIsUnlockModalOpen(false);
        setDoctorPin('');
        router.refresh();
      } else {
        setUnlockError(res.error || 'Failed to lift lockdown. Invalid PIN.');
      }
    });
  };

  const handleToggleDeception = () => {
    const nextVal = !status.deceptionModeActive;
    startTransition(async () => {
      const res = await toggleDeceptionModeAction(nextVal);
      if (res.success) {
        setStatus((prev) => ({ ...prev, deceptionModeActive: nextVal }));
        toast.success(
          nextVal ? 'Honeypot Decoy Mode Armed' : 'Honeypot Decoy Mode Disarmed',
          nextVal
            ? 'Adversaries attempting data extraction will receive false randomized synthetic records.'
            : 'Standard data stream restored.'
        );
        router.refresh();
      } else {
        toast.error('Error', res.error || 'Failed to update deception mode');
      }
    });
  };

  return (
    <>
      <div className="mb-6 rounded-2xl border-2 border-rose-600 bg-rose-950/95 text-white p-5 shadow-xl ring-4 ring-rose-500/20 animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5 shadow-md animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-2xs">
                  Breach Containment Lockdown Active
                </span>

                {status.deceptionModeActive && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-2xs animate-pulse">
                    <Radio className="w-3 h-3" /> Honeypot Active: False Data Stream
                  </span>
                )}
              </div>

              <h2 className="text-base font-bold tracking-tight text-white">
                {status.lockdownReason || 'Autonomous security containment triggered by anomaly sentinel.'}
              </h2>

              <p className="text-xs text-rose-200/90 leading-relaxed max-w-2xl">
                Clinical mutations are frozen to prevent unauthorized alteration. If an adversary cannot be stopped,
                the active deception engine intercepts scraping and serves randomized synthetic decoy records.
                {status.lockdownTriggeredAt && (
                  <span className="ml-1 text-rose-300 font-mono">
                    (Triggered: {formatDate(status.lockdownTriggeredAt)})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleDeception}
              disabled={isPending}
              className={`text-xs border-rose-400/50 ${
                status.deceptionModeActive
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold'
                  : 'bg-rose-900/60 text-rose-100 hover:bg-rose-800'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 mr-1" />
              {status.deceptionModeActive ? 'Disarm False Data Stream' : 'Arm Honeypot (Feed False Data)'}
            </Button>

            <Button
              size="sm"
              onClick={() => setIsUnlockModalOpen(true)}
              className="bg-white hover:bg-slate-100 text-rose-950 font-bold text-xs shadow-md"
            >
              <Unlock className="w-3.5 h-3.5 mr-1 text-rose-600" />
              Lift Lockdown & Unlock
            </Button>
          </div>
        </div>
      </div>

      {/* Doctor Master Unlock PIN Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Doctor Authorization Required</h3>
                  <p className="text-xs text-slate-400">Lift containment & restore clinical operations</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsUnlockModalOpen(false);
                  setDoctorPin('');
                  setUnlockError('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Enter your Doctor Security PIN to verify your identity and safely terminate the containment lockdown.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Doctor Security PIN</label>
                <Input
                  type="password"
                  value={doctorPin}
                  onChange={(e) => setDoctorPin(e.target.value)}
                  placeholder="Enter 4-12 digit Doctor PIN"
                  className="font-mono text-center tracking-widest text-base h-10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLiftLockdown();
                    }
                  }}
                />
              </div>

              {unlockError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{unlockError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setDoctorPin('');
                    setUnlockError('');
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLiftLockdown}
                  disabled={isPending || !doctorPin.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5"
                >
                  {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Verify PIN & Lift Lockdown
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
