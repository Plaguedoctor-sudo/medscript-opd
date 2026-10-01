'use client';

import React from 'react';
import { UserRole } from '@/lib/auth';
import { Stethoscope, ClipboardList, ShieldCheck, HeartPulse, FlaskConical, ShieldAlert, Pill, Wrench } from 'lucide-react';

interface UserRoleBadgeProps {
  role: UserRole;
  securityEnabled?: boolean;
  userName?: string;
  subRole?: string;
}

export function UserRoleBadge({ role, securityEnabled = true, userName, subRole }: UserRoleBadgeProps) {
  if (!securityEnabled) {
    return (
      <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        {userName ? `${userName} (Admin)` : 'Offline Sovereign EMR'}
      </span>
    );
  }

  if (role === 'admin_doctor') {
    return (
      <span
        title={`Active Role: Admin Doctor - Full System Authorities${subRole ? ` (${subRole})` : ''}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
        <span className="font-bold">{userName || 'Admin Doctor'}</span>
        <span className="hidden xl:inline text-[10px] text-purple-500 font-normal">• Full Authority</span>
      </span>
    );
  }

  if (role === 'doctor') {
    return (
      <span
        title={`Active Role: Doctor - Clinical OPD & IPD Authority${subRole ? ` (${subRole})` : ''}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
      >
        <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
        <span className="font-bold">{userName || 'Doctor'}</span>
        <span className="hidden xl:inline text-[10px] text-indigo-500 font-normal">• Clinical</span>
      </span>
    );
  }

  if (role === 'nurse') {
    return (
      <span
        title={`Active Role: Nurse - Inpatient Care & Vitals${subRole ? ` (${subRole})` : ''}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
      >
        <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
        <span className="font-bold">{userName || 'Nurse'}</span>
        <span className="hidden xl:inline text-[10px] text-rose-500 font-normal">• Inpatient Care</span>
      </span>
    );
  }

  if (role === 'lab_technician') {
    return (
      <span
        title={`Active Role: Lab Technician - Pathology & Diagnostics${subRole ? ` (${subRole})` : ''}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-2xs"
      >
        <FlaskConical className="w-3.5 h-3.5 text-cyan-600" />
        <span className="font-bold">{userName || 'Lab Technician'}</span>
        <span className="hidden xl:inline text-[10px] text-cyan-600 font-normal">• Pathology</span>
      </span>
    );
  }

  if (role === 'pharmacist') {
    return (
      <span
        title={`Active Role: Pharmacist - Drug Dispensing & Stock Verification${subRole ? ` (${subRole})` : ''}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
      >
        <Pill className="w-3.5 h-3.5 text-emerald-600" />
        <span className="font-bold">{userName || 'Pharmacist'}</span>
        <span className="hidden xl:inline text-[10px] text-emerald-600 font-normal">• Dispensing</span>
      </span>
    );
  }

  if (role === 'manager') {
    return (
      <span
        title={`Active Role: Hospital Manager - Facility, Instruments & Procurement${subRole ? ` (${subRole})` : ''}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs"
      >
        <Wrench className="w-3.5 h-3.5 text-blue-600" />
        <span className="font-bold">{userName || 'Hospital Manager'}</span>
        <span className="hidden xl:inline text-[10px] text-blue-600 font-normal">• Stores & Assets</span>
      </span>
    );
  }

  // Default: receptionist / front desk
  return (
    <span
      title={`Active Role: Front Desk & Reception - Patient Intake & Billing${subRole ? ` (${subRole})` : ''}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs"
    >
      <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
      <span className="font-bold">{userName || 'Front Desk'}</span>
      <span className="hidden xl:inline text-[10px] text-amber-600 font-normal">• Reception</span>
    </span>
  );
}
