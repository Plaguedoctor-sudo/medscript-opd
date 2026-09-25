'use client';

import React from 'react';
import { UserRole } from '@/lib/auth';
import { Stethoscope, ClipboardList, ShieldCheck } from 'lucide-react';

interface UserRoleBadgeProps {
  role: UserRole;
  securityEnabled: boolean;
}

export function UserRoleBadge({ role, securityEnabled }: UserRoleBadgeProps) {
  if (!securityEnabled) {
    return (
      <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Offline Sovereign EMR
      </span>
    );
  }

  if (role === 'doctor') {
    return (
      <span
        title="Active Role: Doctor (Full Clinical Prescribing Authority)"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
      >
        <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
        <span className="font-bold">Doctor</span>
        <span className="hidden xl:inline text-[10px] text-indigo-500 font-normal">• Clinical Admin</span>
      </span>
    );
  }

  return (
    <span
      title="Active Role: Front Desk / Reception (Patient Intake & Triage)"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs"
    >
      <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
      <span className="font-bold">Front Desk</span>
      <span className="hidden xl:inline text-[10px] text-amber-600 font-normal">• Triage</span>
    </span>
  );
}
