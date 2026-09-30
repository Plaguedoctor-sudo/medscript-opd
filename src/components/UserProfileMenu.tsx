'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SafeStaffUser, UserRole } from '@/types';
import { UserRoleBadge } from './UserRoleBadge';
import { logoutUser } from '@/app/login/actions';
import { getRoleScope } from '@/lib/role-scope';
import {
  User,
  LogOut,
  ArrowRightLeft,
  Shield,
  Building,
  Phone,
  Mail,
  Award,
  FileCheck,
  ChevronDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UserProfileMenuProps {
  user?: SafeStaffUser | null;
  role: UserRole;
  securityEnabled?: boolean;
}

export function UserProfileMenu({ user, role, securityEnabled = true }: UserProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutUser();
  };

  const displayName = user?.name || (role === 'admin_doctor' ? 'Admin Doctor' : role === 'doctor' ? 'Doctor' : role === 'nurse' ? 'Nurse' : role === 'lab_technician' ? 'Lab Tech' : 'Front Desk');
  const displaySubRole = user?.subRole || (role === 'admin_doctor' ? 'Chief Medical Officer' : role === 'doctor' ? 'Consulting Physician' : role === 'nurse' ? 'Staff Nurse' : role === 'lab_technician' ? 'Pathology Technologist' : 'Receptionist');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/80 transition-all text-left group"
            title="View Active Profile & Account Details"
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-2xs font-bold text-xs uppercase border border-slate-200">
              {displayName.charAt(0)}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-slate-800 leading-tight group-hover:text-slate-950">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-500 leading-none">
                {displaySubRole}
              </span>
            </div>
            <UserRoleBadge role={role} securityEnabled={securityEnabled} />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 ml-0.5" />
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
              {displayName.charAt(0)}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {displayName}
              </DialogTitle>
              <p className="text-xs text-slate-500 font-medium">{displaySubRole}</p>
              <div className="mt-1">
                <UserRoleBadge role={role} securityEnabled={securityEnabled} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* User Details Grid */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 text-slate-500">
                <User className="w-3.5 h-3.5" /> Login ID:
              </span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {user?.loginId || 'offline_doctor'}
              </span>
            </div>

            {user?.department && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Building className="w-3.5 h-3.5" /> Department:
                </span>
                <span className="font-medium text-slate-800">{user.department}</span>
              </div>
            )}

            {user?.qualifications && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Award className="w-3.5 h-3.5" /> Qualifications:
                </span>
                <span className="font-medium text-slate-800">{user.qualifications}</span>
              </div>
            )}

            {user?.regNumber && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <FileCheck className="w-3.5 h-3.5" /> License / Reg No:
                </span>
                <span className="font-mono font-medium text-slate-800">{user.regNumber}</span>
              </div>
            )}

            {user?.phone && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Phone className="w-3.5 h-3.5" /> Contact:
                </span>
                <span className="text-slate-800">{user.phone}</span>
              </div>
            )}

            {user?.email && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Mail className="w-3.5 h-3.5" /> Email:
                </span>
                <span className="text-slate-800">{user.email}</span>
              </div>
            )}
          </div>

          {/* Role Authorities & Scope Breakdown */}
          {(() => {
            const scope = getRoleScope(role);
            return (
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 text-[11px] text-purple-900 space-y-2.5 max-h-64 overflow-y-auto">
                <div className="font-bold flex items-center justify-between text-purple-950 border-b border-purple-200 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-700" />
                    <span>Role Scope &amp; Responsibilities</span>
                  </div>
                  <span className="text-[10px] text-purple-700 font-mono">{scope.department}</span>
                </div>

                {/* Exclusive Work Highlight */}
                {scope.exclusiveWork.length > 0 && (
                  <div className="bg-purple-100/70 p-2 rounded-lg text-purple-950 font-semibold border border-purple-300">
                    <span className="text-[10px] uppercase font-bold text-purple-800 block mb-0.5">
                      ⭐ Exclusive Authority:
                    </span>
                    {scope.exclusiveWork.map((ex: string, i: number) => (
                      <div key={i} className="text-[11px] leading-tight">• {ex}</div>
                    ))}
                  </div>
                )}

                {/* What role CAN DO */}
                <div className="space-y-1">
                  <span className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider block">
                    ✓ Permitted Scope (What You Can Do):
                  </span>
                  <ul className="space-y-0.5 text-slate-800">
                    {scope.allowedWork.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-emerald-600 font-bold shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What role CANNOT DO */}
                {scope.restrictedWork.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-purple-200">
                    <span className="font-bold text-rose-800 text-[10px] uppercase tracking-wider block">
                      ✕ Access Restrictions (What You Cannot Do):
                    </span>
                    <ul className="space-y-0.5 text-rose-900">
                      {scope.restrictedWork.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-rose-600 font-bold shrink-0">✕</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push('/login?switch=true');
              }}
              className="gap-1.5 text-xs text-slate-700"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Switch Account
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="gap-1.5 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" /> {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
