import { db } from '@/db';
import { patients, prescriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, getCurrentUserRole, getSecurityConfig } from '@/lib/auth';
import { getBillingSummary } from './actions';
import { BillingDashboard } from './BillingDashboard';
import { getSecurityAlerts } from '@/lib/security-engine';
import Link from 'next/link';
import { FileText, Users, BarChart3, Settings, Receipt, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRoleBadge } from '@/components/UserRoleBadge';
import { SecurityAlertBell } from '@/components/SecurityAlertBell';
import { LockDeskButton } from '@/components/LockDeskButton';
import { PrivacyShield } from '@/components/PrivacyShield';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; prescriptionId?: string; q?: string; status?: string }>;
}) {
  await requireAuth('/billing');
  const [{ securityEnabled }, role, resolvedParams, securityAlertsData] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    searchParams,
    getSecurityAlerts({ unacknowledgedOnly: false, limit: 30 }),
  ]);

  const patientIdNum = resolvedParams?.patientId ? parseInt(resolvedParams.patientId, 10) : null;
  const prescriptionIdNum = resolvedParams?.prescriptionId ? parseInt(resolvedParams.prescriptionId, 10) : null;

  let initialPatientData = null;
  if (patientIdNum) {
    const p = await db.query.patients.findFirst({
      where: eq(patients.id, patientIdNum),
    });
    if (p) {
      initialPatientData = p;
    }
  }

  const summary = await getBillingSummary({
    query: resolvedParams?.q,
    status: resolvedParams?.status,
  });

  const clinicSettings = await db.query.clinicSettings.findFirst();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b shadow-xs sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-xs">
                <Receipt className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">MedScript OPD</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                    OPD Billing
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
            <UserRoleBadge role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell initialStats={securityAlertsData} />
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Users className="w-4 h-4" /> Patients
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
        <BillingDashboard
          summary={summary}
          userRole={role}
          initialPatientId={patientIdNum}
          initialPrescriptionId={prescriptionIdNum}
          initialPatientData={initialPatientData}
        />
      </main>
    </div>
  );
}
