'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginWithPin } from './actions';
import { Lock, KeyRound, AlertCircle, ArrowRight, Delete, ShieldCheck, ArrowLeft } from 'lucide-react';
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
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleKeypadPress = (digit: string) => {
    setError(null);
    if (!requiresMfa) {
      if (pin.length < 16) {
        setPin((prev) => prev + digit);
      }
    } else {
      if (mfaCode.length < 9) {
        setMfaCode((prev) => prev + digit);
      }
    }
  };

  const handleBackspace = () => {
    setError(null);
    if (!requiresMfa) {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setMfaCode((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setError(null);
    if (!requiresMfa) {
      setPin('');
    } else {
      setMfaCode('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Please enter your desk PIN.');
      return;
    }

    if (requiresMfa && !mfaCode) {
      setError('Please enter your 6-digit authenticator code or backup recovery code.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await loginWithPin(pin, redirectUrl, requiresMfa ? mfaCode : undefined);
      if (res.requiresMfa) {
        setRequiresMfa(true);
        if (res.error) setError(res.error);
      } else if (!res.success) {
        setError(res.error || 'Authentication failed');
        if (!requiresMfa) setPin('');
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
          {!requiresMfa ? (
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
                  maxLength={16}
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
          ) : (
            <div className="space-y-2 animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider text-center">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Two-Factor Code Required
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Enter the 6-digit code from Google Authenticator / Authy or your single-use recovery code.
              </p>
              <div className="relative">
                <input
                  id="mfa-input"
                  type="text"
                  maxLength={9}
                  value={mfaCode}
                  onChange={(e) => {
                    setError(null);
                    setMfaCode(e.target.value.toUpperCase());
                  }}
                  placeholder="e.g. 123456"
                  autoFocus
                  disabled={isPending}
                  className="w-full text-center font-mono tracking-widest text-2xl font-bold py-3 bg-indigo-50/50 border-2 border-indigo-400 focus:border-indigo-600 focus:bg-white rounded-xl outline-none transition-all"
                />
              </div>
            </div>
          )}

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
              disabled={isPending || (!requiresMfa ? pin.length === 0 : mfaCode.length === 0)}
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
              disabled={isPending || (!requiresMfa ? pin.length === 0 : mfaCode.length === 0)}
              className="h-12 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 transition-all text-slate-600"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <Button
            type="submit"
            disabled={isPending || (!requiresMfa ? pin.length === 0 : mfaCode.length === 0)}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
          >
            {isPending ? 'Verifying...' : (
              <>
                {!requiresMfa ? 'Unlock Desk' : 'Verify & Open Desk'} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          {requiresMfa && (
            <button
              type="button"
              onClick={() => {
                setRequiresMfa(false);
                setMfaCode('');
                setError(null);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to PIN Entry
            </button>
          )}
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          Session remains active for 24 hours on this device.
        </p>
      </div>
    </div>
  );
}
