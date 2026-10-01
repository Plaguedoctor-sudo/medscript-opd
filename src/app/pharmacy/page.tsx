import React from 'react';
import { requirePermission, getCurrentUser, getCurrentUserRole, getSecurityConfig } from '@/lib/auth';
import { getPendingPharmacyOrders, getDispensationHistory } from './actions';
import { PharmacyDispensingStation } from '@/components/pharmacy/PharmacyDispensingStation';
import { UserProfileMenu } from '@/components/UserProfileMenu';
import { PrivacyShield } from '@/components/PrivacyShield';
import { SecurityAlertBell } from '@/components/SecurityAlertBell';
import { Pill, ChevronLeft, Package, Bed, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function PharmacyPage() {
  const role = await requirePermission('prescription:view', '/pharmacy');
  const [{ securityEnabled }, currentUser, ordersData, historyData] = await Promise.all([
    getSecurityConfig(),
    getCurrentUser(),
    getPendingPharmacyOrders(),
    getDispensationHistory(30),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Navbar */}
      <nav className="bg-white border-b shadow-xs sticky top-0 z-20 print:hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1600px] h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link href="/pharmacy" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-xs">
                <Pill className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">MedScript Pharmacy</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                    Drug Dispensing Station
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <UserProfileMenu user={currentUser} role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell />

            <Link href="/inventory">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Package className="w-4 h-4 text-emerald-600" /> Inventory
              </Button>
            </Link>
            <Link href="/ipd">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Bed className="w-4 h-4 text-purple-600" /> IPD Wards
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px]">
        <PharmacyDispensingStation
          initialPrescriptions={ordersData.prescriptions}
          initialIpdRounds={ordersData.ipdRounds}
          initialHistory={historyData}
          stats={ordersData.stats}
          currentUserRole={role}
          currentUserName={currentUser?.name}
        />
      </main>
    </div>
  );
}
