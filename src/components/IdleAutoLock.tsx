'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { lockDeskAction } from '@/app/login/actions';
import { Lock, ShieldAlert, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WARNING_THRESHOLD_MS = 30 * 1000; // Warn 30 seconds before auto-locking

interface IdleAutoLockProps {
  autoLockMinutes?: number;
  enabled?: boolean;
}

export function IdleAutoLock({
  autoLockMinutes = 15,
  enabled = true,
}: IdleAutoLockProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(0);
  const isLockingRef = useRef<boolean>(false);

  // If already on login page or auto-lock is disabled / set to 0
  const isExcludedRoute = pathname === '/login';
  const isActive = enabled && autoLockMinutes > 0 && !isExcludedRoute;

  const timeoutMs = autoLockMinutes * 60 * 1000;

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsRemaining(null);
  }, []);

  const triggerLock = useCallback(async () => {
    if (isLockingRef.current) return;
    isLockingRef.current = true;
    try {
      await lockDeskAction();
    } catch {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (!isActive) return;

    // Reset last activity when mounted or route changes
    lastActivityRef.current = Date.now();
    isLockingRef.current = false;

    // Throttle activity listener to reduce overhead
    let lastThrottled = 0;
    const throttledActivity = () => {
      const now = Date.now();
      if (now - lastThrottled > 1000) {
        lastThrottled = now;
        handleActivity();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    for (const evt of events) {
      window.addEventListener(evt, throttledActivity, { passive: true });
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const timeLeftMs = timeoutMs - idleTime;

      if (timeLeftMs <= 0) {
        clearInterval(intervalId);
        triggerLock();
      } else if (timeLeftMs <= WARNING_THRESHOLD_MS) {
        setSecondsRemaining(Math.max(1, Math.ceil(timeLeftMs / 1000)));
      } else {
        setSecondsRemaining(null);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      for (const evt of events) {
        window.removeEventListener(evt, throttledActivity);
      }
    };
  }, [isActive, timeoutMs, handleActivity, triggerLock]);

  if (!isActive || secondsRemaining === null) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="autolock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-amber-200 p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-200 shadow-inner">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>

        <div>
          <h2 id="autolock-title" className="text-lg font-bold text-slate-900 flex items-center justify-center gap-1.5">
            <Timer className="w-5 h-5 text-amber-500" />
            Consultation Desk Inactivity Notice
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            To safeguard patient medical data and comply with clinical privacy policies, this consultation desk will lock automatically in:
          </p>
        </div>

        <div className="py-2">
          <div className="inline-block px-4 py-2 rounded-xl bg-amber-100/70 border border-amber-300/80 font-mono text-3xl font-extrabold text-amber-900 tracking-wider">
            00:{String(secondsRemaining).padStart(2, '0')}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Move your mouse, tap anywhere, or click &quot;Stay Unlocked&quot; to keep working.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={triggerLock}
            className="text-xs text-slate-600 hover:text-red-700 hover:bg-red-50 border-slate-200"
          >
            <Lock className="w-3.5 h-3.5 mr-1" /> Lock Now
          </Button>

          <Button
            type="button"
            onClick={handleActivity}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
          >
            Stay Unlocked
          </Button>
        </div>
      </div>
    </div>
  );
}
