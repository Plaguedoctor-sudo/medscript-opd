'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Eye, Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { Button } from './ui/button';

export function PrivacyShield() {
  const [isShieldActive, setIsShieldActive] = useState(false);
  const lastActivityRef = useRef<number>(0);

  const toggleShield = useCallback(() => {
    setIsShieldActive((prev) => !prev);
  }, []);

  // Listen for keyboard shortcut: Alt + P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === 'p' || e.key === 'P')) || (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p'))) {
        e.preventDefault();
        toggleShield();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleShield]);

  // Track user activity for soft auto-blur (2 minutes of inactivity)
  useEffect(() => {
    lastActivityRef.current = Date.now();

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity, { passive: true });
    window.addEventListener('click', recordActivity, { passive: true });

    const interval = setInterval(() => {
      // 2 minutes (120,000 ms) idle soft-shield
      if (!isShieldActive && lastActivityRef.current > 0 && Date.now() - lastActivityRef.current > 120000) {
        setIsShieldActive(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('click', recordActivity);
      clearInterval(interval);
    };
  }, [isShieldActive]);

  return (
    <>
      {/* Privacy Guard Toggle Button in Navbar */}
      <button
        type="button"
        onClick={toggleShield}
        title="Patient Privacy Shield (Alt+P) - Instantly obscure screen from visitors"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isShieldActive
            ? 'bg-amber-500 text-white shadow-xs'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        }`}
      >
        <Shield className="w-3.5 h-3.5 text-indigo-600" />
        <span className="hidden sm:inline">Privacy Guard</span>
        <kbd className="hidden md:inline-block px-1 py-0.5 text-[9px] bg-slate-200 text-slate-600 rounded">
          Alt+P
        </kbd>
      </button>

      {/* Frosted Privacy Overlay Shield */}
      {isShieldActive && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsShieldActive(false)}
          className="fixed inset-0 z-50 backdrop-blur-2xl bg-slate-950/75 flex items-center justify-center p-4 transition-all animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4 cursor-default animate-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" /> Patient Privacy Shield Active
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Consultation screen and protected health information (PHI) are currently obscured to safeguard patient confidentiality.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>Press <strong className="text-slate-700">Alt + P</strong> or click below to resume</span>
            </div>

            <Button
              type="button"
              onClick={() => setIsShieldActive(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 shadow-xs"
            >
              <Eye className="w-4 h-4" /> Resume Consultation Desk
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
