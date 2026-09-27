import { getReportsData } from "./actions";
import ReportsView from "./ReportsView";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Settings, PlusCircle, Users, Receipt, Bed, FlaskConical, CalendarCheck, Pill } from "lucide-react";
import { requireRole, getSecurityConfig, getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { LockDeskButton } from "@/components/LockDeskButton";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { db } from "@/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsPage() {
  await requireRole(['admin_doctor', 'doctor'], '/reports');
  const [{ securityEnabled }, role, currentUser, initialData, settings] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    getReportsData({ range: "month" }),
    db.query.clinicSettings.findFirst(),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Sticky Navbar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" title="Back to Dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                <BarChart3 className="text-white w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block leading-tight">Clinical Reports &amp; Audit</span>
                {settings?.doctorName && (
                  <span className="text-[11px] text-slate-500 font-medium block leading-none mt-0.5">
                    {settings.doctorName} {settings.clinicName ? `• ${settings.clinicName}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <UserProfileMenu user={currentUser} role={role} securityEnabled={securityEnabled} />
            <SecurityAlertBell />
            <Link href="/appointments">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <CalendarCheck className="w-3.5 h-3.5 text-blue-600" /> Queue
              </Button>
            </Link>
            <Link href="/inventory">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <Pill className="w-3.5 h-3.5 text-emerald-600" /> Pharmacy
              </Button>
            </Link>
            <Link href="/ipd">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <Bed className="w-3.5 h-3.5 text-purple-600" /> IPD
              </Button>
            </Link>
            <Link href="/labs">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <FlaskConical className="w-3.5 h-3.5 text-indigo-600" /> Labs
              </Button>
            </Link>
            <Link href="/billing">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Billing
              </Button>
            </Link>
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <Users className="w-3.5 h-3.5" /> Patients
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hidden sm:inline-flex">
                <Settings className="w-3.5 h-3.5" /> Settings
              </Button>
            </Link>
            <Link href="/prescription/new">
              <Button size="sm" className="gap-1.5 text-xs">
                <PlusCircle className="w-3.5 h-3.5" /> New Consultation
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <ReportsView initialData={initialData} />
      </main>
    </div>
  );
}
