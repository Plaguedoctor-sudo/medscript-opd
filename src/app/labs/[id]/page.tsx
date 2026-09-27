import { notFound } from "next/navigation";
import { requireAuth, getCurrentUserRole, getSecurityConfig, getCurrentUser } from "@/lib/auth";
import { getLabReportById } from "../actions";
import { LabReportView } from "./LabReportView";
import Link from "next/link";
import { FlaskConical, Users, Settings, Receipt, ChevronLeft, Bed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { PrivacyShield } from "@/components/PrivacyShield";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";

export const dynamic = "force-dynamic";

export default async function LabReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth(`/labs/${id}`);
  const reportId = parseInt(id, 10);
  if (isNaN(reportId)) notFound();

  const [{ securityEnabled }, role, currentUser, data] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    getLabReportById(reportId),
  ]);

  if (!data.report) notFound();

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Top Navbar */}
      <nav className="bg-white border-b shadow-xs sticky top-0 z-10 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/labs" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-xs">
                <FlaskConical className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">MedScript Lab</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                    Diagnostic Report
                  </span>
                </div>
                {data.settings?.clinicName && (
                  <div className="text-[11px] text-slate-500 font-medium leading-none">
                    {data.settings.clinicName}
                  </div>
                )}
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <UserProfileMenu user={currentUser} role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell />
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Users className="w-4 h-4" /> Patients
              </Button>
            </Link>
            <Link href="/ipd">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Bed className="w-4 h-4 text-purple-600" /> IPD
              </Button>
            </Link>
            <Link href="/billing">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Receipt className="w-4 h-4 text-emerald-600" /> Billing
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <LabReportView report={data.report} settings={data.settings} userRole={role} />
      </main>
    </div>
  );
}
