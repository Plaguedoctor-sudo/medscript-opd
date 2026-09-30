'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SafeStaffUser, UserRole } from '@/types';
import { UserRoleBadge } from './UserRoleBadge';
import { logoutUser, changeOwnPasswordAction } from '@/app/login/actions';
import { getRoleScope } from '@/lib/role-scope';
import { toast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  KeyRound,
  AlertTriangle,
  Lock,
  Loader2,
  CheckCircle2,
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

  // Self-service password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutUser();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await changeOwnPasswordAction(currentPassword, newPassword, confirmPassword);
      if (res.success) {
        toast.show({
          title: 'Password Updated',
          description: 'Your account password has been updated securely. Default credentials revoked.',
          type: 'success',
        });
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.error || 'Failed to update password.');
      }
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const displayName =
    user?.name ||
    (role === 'admin_doctor'
      ? 'Admin Doctor'
      : role === 'doctor'
      ? 'Doctor'
      : role === 'nurse'
      ? 'Nurse'
      : role === 'lab_technician'
      ? 'Lab Tech'
      : 'Front Desk');
  const displaySubRole =
    user?.subRole ||
    (role === 'admin_doctor'
      ? 'Chief Medical Officer'
      : role === 'doctor'
      ? 'Consulting Physician'
      : role === 'nurse'
      ? 'Staff Nurse'
      : role === 'lab_technician'
      ? 'Pathology Technologist'
      : 'Receptionist');

  const isDefaultPassword = Boolean(user && !user.passwordUpdatedAt);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setIsChangingPassword(false);
          setPasswordError(null);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/80 transition-all text-left group"
            title="View Active Profile & Account Details"
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-2xs font-bold text-xs uppercase border border-slate-200 relative">
              {displayName.charAt(0)}
              {isDefaultPassword && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
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
          {/* Security Alert: Un-rotated Default Password */}
          {isDefaultPassword && !isChangingPassword && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs">Default Password Active</p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Your account is currently using the initial default password. To protect clinical records, please set a personal secure password.
                </p>
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(true)}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline mt-1 block"
                >
                  Rotate Password Now →
                </button>
              </div>
            </div>
          )}

          {/* Password Change Form Modal / View */}
          {isChangingPassword ? (
            <form onSubmit={handlePasswordSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>Update Account Password</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] leading-snug">
                  {passwordError}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">New Password (min 8 chars, letters & numbers)</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong passphrase"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordError(null);
                  }}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingPassword}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                >
                  {isSubmittingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <>
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
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 text-[11px] text-purple-900 space-y-2.5 max-h-56 overflow-y-auto">
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
                        ✓ Permitted Scope:
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
                          ✕ Access Restrictions:
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
            </>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5">
              {!isChangingPassword && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPassword(true)}
                  className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Change Password
                </Button>
              )}
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
            </div>

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
