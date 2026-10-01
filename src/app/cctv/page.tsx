import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cctv, Bed, Users, Pill, CalendarCheck, ShieldCheck } from 'lucide-react';
import { requirePermission, getSecurityConfig, getCurrentUserRole, getCurrentUser } from '@/lib/auth';
import { UserProfileMenu } from '@/components/UserProfileMenu';
import { SecurityAlertBell } from '@/components/SecurityAlertBell';
import { LockDeskButton } from '@/components/LockDeskButton';
import { getCctvCameras, getCctvIncidents, getCctvStats } from './actions';
import { HospitalCctvCommandCenter } from '@/components/cctv/HospitalCctvCommandCenter';

export const dynamic = 'force-dynamic';

export default async function CctvSurveillancePage() {
  await requirePermission('cctv:view', '/cctv');

  const [cameras, incidents, stats, role, currentUser, securityConfig] = await Promise.all([
    getCctvCameras(),
    getCctvIncidents(),
    getCctvStats(),
    getCurrentUserRole(),
    getCurrentUser(),
    getSecurityConfig(),
  ]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      {/* Sovereign Top Navigation Bar */}
      <nav className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" title="Dashboard" className="text-slate-300 hover:text-white hover:bg-slate-800">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg border border-indigo-500/30">
                <Cctv className="text-white w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  CCTV Command Station
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hidden sm:inline-block">
                    Multi-Zone Sentinel
                  </span>
                </span>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Hospital Patient Safety, Fall Detection & Facility Security
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <UserProfileMenu
              user={currentUser}
              role={role}
              securityEnabled={securityConfig.securityEnabled}
            />
            <SecurityAlertBell />

            <div className="hidden lg:flex items-center gap-2 ml-2 pl-2 border-l border-slate-800">
              <Link href="/ipd">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800">
                  <Bed className="w-4 h-4 text-purple-400" /> IPD Wards
                </Button>
              </Link>
              <Link href="/pharmacy">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800">
                  <Pill className="w-4 h-4 text-emerald-400" /> Pharmacy
                </Button>
              </Link>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800">
                  <CalendarCheck className="w-4 h-4 text-blue-400" /> Queue
                </Button>
              </Link>
            </div>

            {securityConfig.securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="container mx-auto px-4 py-6">
        <HospitalCctvCommandCenter
          initialCameras={cameras}
          initialIncidents={incidents}
          stats={stats}
          currentUserRole={role}
          currentUserName={currentUser?.name}
        />
      </main>
    </div>
  );
}
