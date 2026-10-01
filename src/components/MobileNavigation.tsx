'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Bed,
  CalendarCheck,
  Menu,
  X,
  PlusCircle,
  Receipt,
  FlaskConical,
  Pill,
  BarChart3,
  Settings,
  Download,
  Smartphone,
  CheckCircle2,
  Lock,
  ChevronRight,
  ShieldAlert,
  Activity,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canDo, ROLE_PERMISSIONS } from '@/lib/role-scope';

interface MobileNavigationProps {
  userRole?: string;
  userName?: string;
  clinicName?: string;
}

export function MobileNavigation({
  userRole = 'doctor',
  userName,
  clinicName,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Check standalone mode and capture install prompt on Android
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        const isApp =
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true;
        setIsStandalone(isApp);
      }, 0);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setInstallSuccess(true);
        setIsStandalone(true);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  // Close drawer on route change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDrawerOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstallSuccess(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instruction for Android Chrome
      alert(
        'To install MedScript on your Android device:\n\n1. Tap the Chrome menu (⋮) in the top-right corner.\n2. Tap "Install app" or "Add to Home screen".\n3. Tap "Install" to create a standalone app on your home screen!'
      );
    }
  };

  const isDoctor = userRole === 'admin_doctor' || userRole === 'doctor';
  const isNurse = userRole === 'nurse';
  const isReceptionist = userRole === 'receptionist';
  const isLabTech = userRole === 'lab_technician';

  // Role permissions check
  const showPatients = canDo(userRole as any, 'patient:view');
  const showIpd = canDo(userRole as any, 'ipd:view');
  const showLabs = canDo(userRole as any, 'lab:view');
  const showBilling = canDo(userRole as any, 'billing:view');
  const showInventory = canDo(userRole as any, 'inventory:view');
  const showPharmacy = canDo(userRole as any, 'pharmacy:dispense');
  const showManager = canDo(userRole as any, 'manager:assets');
  const showReports = canDo(userRole as any, 'reports:view');
  const showSettings = canDo(userRole as any, 'settings:clinic');
  const canPrescribe = canDo(userRole as any, 'prescription:create');

  if (pathname === '/login' || pathname.startsWith('/login')) {
    return null;
  }

  return (
    <>
      {/* Android Mobile Bottom Navigation Bar (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-bottom shadow-lg print:hidden">
        <div className="flex items-center justify-around h-15 px-2">
          {/* Home */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              pathname === '/' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Home</span>
          </Link>

          {/* Queue */}
          <Link
            href="/appointments/queue"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              pathname.includes('/appointments') ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] mt-0.5">Queue</span>
          </Link>

          {/* New Rx or Quick Action for Doctor */}
          {canPrescribe && (
            <Link
              href="/prescription/new"
              className="flex flex-col items-center justify-center flex-1 py-1 -mt-4"
            >
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:bg-blue-700 transition-transform active:scale-95">
                <PlusCircle className="w-6 h-6" />
              </div>
              <span className="text-[10px] mt-0.5 font-bold text-blue-700">New Rx</span>
            </Link>
          )}

          {/* Patients */}
          {showPatients && (
            <Link
              href="/patients"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                pathname.startsWith('/patients') || pathname.startsWith('/patient/')
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] mt-0.5">Patients</span>
            </Link>
          )}

          {/* IPD Ward */}
          {showIpd && (
            <Link
              href="/ipd"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                pathname.startsWith('/ipd') ? 'text-purple-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Bed className="w-5 h-5 text-purple-600" />
              <span className="text-[10px] mt-0.5">IPD</span>
            </Link>
          )}

          {/* More Menu Drawer Trigger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-900"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-Out Android Navigation Drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div
            className="w-[85vw] max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div>
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
                    M
                  </div>
                  <div>
                    <div className="font-bold text-sm tracking-tight leading-tight">MedScript OPD</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {userName || 'Staff Member'} ({userRole})
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Android App Install Banner */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-slate-900">
                      {isStandalone ? 'Android App Active' : 'Install Android App'}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {isStandalone
                        ? 'Running in full screen standalone mode'
                        : 'Install MedScript directly to home screen'}
                    </div>
                    {!isStandalone && (
                      <Button
                        size="sm"
                        onClick={handleInstallClick}
                        className="mt-2 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1 w-full font-semibold shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Install App on Phone
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation Items List */}
              <div className="p-3 space-y-1 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 tracking-wider">
                  Clinical Modules
                </div>

                {canPrescribe && (
                  <Link
                    href="/prescription/new"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-blue-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <PlusCircle className="w-4 h-4 text-blue-600" />
                      <span>New Consultation (Rx)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showPatients && (
                  <Link
                    href="/patients"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>Patient Registry & Intake</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                <Link
                  href="/appointments/queue"
                  className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CalendarCheck className="w-4 h-4 text-blue-500" />
                    <span>Live OPD Token Queue</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>

                {showIpd && (
                  <Link
                    href="/ipd"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Bed className="w-4 h-4 text-purple-600" />
                      <span>IPD Inpatient Census & Case Sheets</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showIpd && (
                  <Link
                    href="/ipd/monitoring"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-emerald-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span>ICU &amp; IPD Device Telemetry</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showLabs && (
                  <Link
                    href="/labs"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FlaskConical className="w-4 h-4 text-indigo-600" />
                      <span>Laboratory Reports</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showBilling && (
                  <Link
                    href="/billing"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>Billing & Invoicing</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showInventory && (
                  <Link
                    href="/inventory"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Pill className="w-4 h-4 text-emerald-600" />
                      <span>Pharmacy Inventory</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showPharmacy && (
                  <Link
                    href="/pharmacy"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-emerald-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Pill className="w-4 h-4 text-emerald-600" />
                      <span>Pharmacy Dispensing Station</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showManager && (
                  <Link
                    href="/manager"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-blue-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className="w-4 h-4 text-blue-600" />
                      <span>Facility, Stores & Assets</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showReports && (
                  <Link
                    href="/reports"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <span>Clinical Analytics & IDSP</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {showSettings && (
                  <Link
                    href="/settings"
                    className="flex items-center justify-between p-2.5 rounded-lg text-slate-800 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-4 h-4 text-slate-600" />
                      <span>Clinic Settings & Staff</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 space-y-2">
              <div className="font-semibold text-slate-700">
                {clinicName || 'MedScript Healthcare System'}
              </div>
              <div className="flex items-center justify-between">
                <span>Android Optimized Mode</span>
                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                  v1.1.3
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
