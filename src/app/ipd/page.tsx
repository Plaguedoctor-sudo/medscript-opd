import { db } from "@/db";
import { requirePermission, getCurrentUserRole, getSecurityConfig, getCurrentUser } from "@/lib/auth";
import { getIpdAdmissions } from "./actions";
import { IpdDashboard } from "./IpdDashboard";
import { getSecurityAlerts } from "@/lib/security-engine";
import Link from "next/link";
import { Bed, Users, BarChart3, Settings, Receipt, ChevronLeft, FlaskConical, CalendarCheck, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";
import { LockDeskButton } from "@/components/LockDeskButton";
import { PrivacyShield } from "@/components/PrivacyShield";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IpdPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; ward?: string }>;
}) {
   await requirePermission('ipd:view', '/ipd');
  const [{ securityEnabled }, role, currentUser, resolvedParams, securityAlertsData] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    searchParams,
    getSecurityAlerts({ unacknowledgedOnly: false, limit: 30 }),
  ]);

  const { admissions, stats } = await getIpdAdmissions({
    query: resolvedParams?.q,
    status: resolvedParams?.status,
    ward: resolvedParams?.ward,
  });

  const clinicSettings = await db.query.clinicSettings.findFirst();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <nav className="bg-white border-b shadow-xs sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-xs">
                <Bed className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">MedScript IPD</span>
                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold border border-purple-200">
                    Inpatient Department
                  </span>
                </div>
                {clinicSettings?.clinicName && (
                  <div className="text-[11px] text-slate-500 font-medium leading-none">
                    {clinicSettings.clinicName}
                  </div>
                )}
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <UserProfileMenu user={currentUser} role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell initialStats={securityAlertsData} />
            <Link href="/appointments">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <CalendarCheck className="w-4 h-4 text-blue-600" /> Queue
              </Button>
            </Link>
            <Link href="/inventory">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Pill className="w-4 h-4 text-emerald-600" /> Pharmacy
              </Button>
            </Link>
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Users className="w-4 h-4" /> Patients
              </Button>
            </Link>
            <Link href="/labs">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <FlaskConical className="w-4 h-4 text-indigo-600" /> Labs
              </Button>
            </Link>
            <Link href="/billing">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Receipt className="w-4 h-4 text-emerald-600" /> Billing
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <BarChart3 className="w-4 h-4 text-blue-600" /> Reports
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </Link>
            {securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <IpdDashboard
          admissions={admissions}
          stats={stats}
          userRole={role}
          initialQuery={resolvedParams?.q || ""}
          initialStatus={resolvedParams?.status || "ADMITTED"}
          initialWard={resolvedParams?.ward || "All"}
        />
      </main>
    </div>
  );
}
