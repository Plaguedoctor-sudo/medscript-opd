import { db } from "@/db";
import { requireAuth, getCurrentUserRole, getSecurityConfig, getCurrentUser } from "@/lib/auth";
import { getAppointments } from "./actions";
import { AppointmentDashboard } from "./AppointmentDashboard";
import { getSecurityAlerts } from "@/lib/security-engine";
import Link from "next/link";
import {
  CalendarCheck,
  Users,
  BarChart3,
  Settings,
  Receipt,
  ChevronLeft,
  FlaskConical,
  Bed,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";
import { LockDeskButton } from "@/components/LockDeskButton";
import { PrivacyShield } from "@/components/PrivacyShield";
import { Patient } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAuth("/appointments");
  const [{ securityEnabled }, role, currentUser, resolvedParams, securityAlertsData] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    searchParams,
    getSecurityAlerts({ unacknowledgedOnly: false, limit: 30 }),
  ]);

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedDate = resolvedParams?.date || todayStr;

  const [{ appointments, stats }, patientsRows, clinicSettings] = await Promise.all([
    getAppointments(selectedDate),
    db.query.patients.findMany({
      orderBy: (p, { asc }) => [asc(p.name)],
    }),
    db.query.clinicSettings.findFirst(),
  ]);

  const allPatients: Patient[] = patientsRows.map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    phone: p.phone,
    regNo: p.regNo,
    allergies: p.allergies,
    bloodGroup: p.bloodGroup,
    abhaId: p.abhaId,
    abhaAddress: p.abhaAddress,
    createdAt: p.createdAt,
  }));

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
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                <CalendarCheck className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">MedScript Queue</span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                    OPD Appointments &amp; Tokens
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

            <Link href="/inventory">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Pill className="w-4 h-4 text-emerald-600" /> Pharmacy
              </Button>
            </Link>
            <Link href="/ipd">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Bed className="w-4 h-4 text-purple-600" /> IPD
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
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Users className="w-4 h-4" /> Patients
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
        <AppointmentDashboard
          initialAppointments={appointments}
          initialStats={stats}
          selectedDate={selectedDate}
          allPatients={allPatients}
          userRole={role}
        />
      </main>
    </div>
  );
}
