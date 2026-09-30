'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginWithCredentials, loginWithPin } from './actions';
import { SafeStaffUser, UserRole } from '@/types';
import {
  Lock,
  KeyRound,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  ClipboardList,
  FlaskConical,
  Eye,
  EyeOff,
  User,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginFormProps {
  doctorName: string;
  clinicName: string;
  initialStaffUsers?: SafeStaffUser[];
}

export function LoginForm({ doctorName, clinicName, initialStaffUsers = [] }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  // Mode: 'CREDENTIALS' (individual login ID & password) or 'PIN' (quick desk PIN)
  const [mode, setMode] = useState<'CREDENTIALS' | 'PIN'>('CREDENTIALS');

  // Credential inputs
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Selected persona card
  const [selectedLoginId, setSelectedLoginId] = useState<string | null>(null);

  // Category filter for staff personas
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // PIN inputs
  const [pin, setPin] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter staff personas
  const filteredStaff = initialStaffUsers.filter((u) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'DOCTOR') return u.role === 'admin_doctor' || u.role === 'doctor';
    if (categoryFilter === 'NURSE') return u.role === 'nurse';
    if (categoryFilter === 'RECEPTIONIST') return u.role === 'receptionist';
    if (categoryFilter === 'LAB_TECHNICIAN') return u.role === 'lab_technician';
    return true;
  });

  const handleSelectPersona = (staff: SafeStaffUser) => {
    setError(null);
    setSelectedLoginId(staff.loginId);
    setLoginId(staff.loginId);
    setPassword('');
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      setError('Please enter both your Login ID and Password.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await loginWithCredentials(loginId, password, redirectUrl);
      if (!res.success) {
        setError(res.error || 'Authentication failed. Please check your credentials.');
      } else {
        window.location.href = res.redirectUrl || '/';
      }
    });
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Please enter your desk PIN.');
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
        window.location.href = res.redirectUrl || '/';
      }
    });
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin_doctor':
        return <ShieldAlert className="w-4 h-4 text-purple-600" />;
      case 'doctor':
        return <Stethoscope className="w-4 h-4 text-indigo-600" />;
      case 'nurse':
        return <HeartPulse className="w-4 h-4 text-rose-600" />;
      case 'lab_technician':
        return <FlaskConical className="w-4 h-4 text-cyan-600" />;
      case 'receptionist':
      default:
        return <ClipboardList className="w-4 h-4 text-amber-600" />;
    }
  };

  const getRoleBadgeClasses = (role: UserRole) => {
    switch (role) {
      case 'admin_doctor':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'doctor':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'nurse':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'lab_technician':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'receptionist':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getRoleTitle = (role: UserRole) => {
    switch (role) {
      case 'admin_doctor':
        return 'Admin Doctor • Full Authorities';
      case 'doctor':
        return 'Doctor • Clinical';
      case 'nurse':
        return 'Nurse • Inpatient Care';
      case 'lab_technician':
        return 'Lab Technician • Pathology';
      case 'receptionist':
      default:
        return 'Receptionist • Front Desk';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/20">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{clinicName}</h1>
            <p className="text-blue-100 text-xs sm:text-sm font-medium mt-0.5">
              Multi-Role Hospital Consultation & EMR Portal • {doctorName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode(mode === 'CREDENTIALS' ? 'PIN' : 'CREDENTIALS')}
            className="text-white hover:bg-white/20 border border-white/25 text-xs font-semibold rounded-xl"
          >
            {mode === 'CREDENTIALS' ? (
              <>
                <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Switch to Desk PIN
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 mr-1.5" /> Staff Login ID & Password
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{error}</div>
          </div>
        )}

        {mode === 'CREDENTIALS' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Direct Login ID & Password Form */}
            <div className="lg:col-span-5 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" /> Staff Credential Login
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Sign in with your individual staff Login ID and password to access authorized clinical and administrative modules.
                </p>
              </div>

              <form onSubmit={handleCredentialSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Login ID / Username</Label>
                  <Input
                    value={loginId}
                    onChange={(e) => {
                      setLoginId(e.target.value);
                      setSelectedLoginId(null);
                    }}
                    placeholder="e.g. admin, doctor, nurse, labtech"
                    className="h-10 text-xs font-medium bg-white"
                    disabled={isPending}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="h-10 text-xs font-medium bg-white"
                    disabled={isPending}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs gap-2 mt-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In to Consultation Desk <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 leading-normal flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Protected by memory-hard scrypt KDF encryption and session rate-limiting.</span>
              </div>
            </div>

            {/* Right Column: Persona Quick-Picker Categories */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" /> Select Staff Role & Persona
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any staff member to select your account profile, then enter your confidential password.
                  </p>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All Staff
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('DOCTOR')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'DOCTOR' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Doctors
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('NURSE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'NURSE' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Nursing
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('RECEPTIONIST')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'RECEPTIONIST' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Reception & Billing
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('LAB_TECHNICIAN')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'LAB_TECHNICIAN' ? 'bg-white text-cyan-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Laboratory
                </button>
              </div>

              {/* Staff Persona Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredStaff.map((staff) => {
                  const isSelected = selectedLoginId === staff.loginId;
                  return (
                    <div
                      key={staff.id}
                      onClick={() => handleSelectPersona(staff)}
                      className={`cursor-pointer p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/70 shadow-2xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                              {getRoleIcon(staff.role)}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-900 leading-tight">
                                {staff.name}
                              </div>
                              <div className="text-[10px] text-slate-500 leading-tight">
                                {staff.subRole || staff.department || 'Staff'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeClasses(staff.role)}`}
                          >
                            {getRoleTitle(staff.role)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>ID: <strong className="text-slate-800">{staff.loginId}</strong></span>
                        <span className="text-[10px] text-indigo-600 font-semibold font-sans">
                          {isSelected ? '✓ Selected' : 'Click to select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* PIN Entry Fallback Mode */
          <div className="max-w-xs mx-auto space-y-5 text-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" /> Quick Consultation Desk PIN
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your numeric desk PIN or staff passkey.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={16}
                className="h-12 text-center text-xl font-mono tracking-widest bg-slate-50"
                disabled={isPending}
                autoFocus
              />

              {requiresMfa && (
                <div className="space-y-1.5 text-left">
                  <Label className="text-xs font-semibold text-slate-700">6-Digit Authenticator Code / Backup Code</Label>
                  <Input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    maxLength={16}
                    className="h-10 text-center text-base font-mono tracking-widest bg-white"
                    disabled={isPending}
                    autoFocus
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying PIN...
                  </>
                ) : (
                  <>
                    Unlock Desk <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
