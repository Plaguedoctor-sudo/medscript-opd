'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginWithPin } from './actions';
import { Lock, KeyRound, AlertCircle, ArrowRight, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LoginFormProps {
  doctorName: string;
  clinicName: string;
}

export function LoginForm({ doctorName, clinicName }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleKeypadPress = (digit: string) => {
    setError(null);
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Please enter your desk PIN.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await loginWithPin(pin, redirectUrl);
      if (!res.success) {
        setError(res.error || 'Authentication failed');
        setPin('');
      } else {
        router.push(res.redirectUrl || '/');
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white text-center">
        <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl mx-auto flex items-center justify-center mb-3 shadow-inner">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">{clinicName}</h1>
        <p className="text-blue-100 text-xs mt-0.5">{doctorName}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-800/50 border border-blue-400/30 text-[11px] text-blue-100">
          <KeyRound className="w-3 h-3" /> Consultation Desk Protected
        </div>
      </div>

      {/* Main Lock Form */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin-input" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider text-center mb-2">
              Enter Access PIN
            </label>
            <div className="relative">
              <input
                id="pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setError(null);
                  setPin(e.target.value.replace(/[^\d]/g, ''));
                }}
                placeholder="• • • •"
                autoFocus
                disabled={isPending}
                className="w-full text-center tracking-[0.6em] text-2xl font-bold py-3 bg-slate-50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl outline-none transition-all placeholder:tracking-normal placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* On-screen touch keypad for tablets & clinic PCs */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                disabled={isPending}
                className="h-12 text-lg font-semibold rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 active:scale-95 border border-slate-200 transition-all text-slate-700"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending || pin.length === 0}
              className="h-12 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 transition-all text-slate-600"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              disabled={isPending}
              className="h-12 text-lg font-semibold rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 active:scale-95 border border-slate-200 transition-all text-slate-700"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isPending || pin.length === 0}
              className="h-12 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 transition-all text-slate-600"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <Button
            type="submit"
            disabled={isPending || pin.length === 0}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
          >
            {isPending ? 'Unlocking...' : (
              <>
                Unlock Desk <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          Session remains active for 24 hours on this device.
        </p>
      </div>
    </div>
  );
}
