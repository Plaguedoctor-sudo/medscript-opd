import { notFound } from "next/navigation";
import { requirePermission, getSecurityConfig, getCurrentUser } from "@/lib/auth";
import { getIpdAdmissionById } from "../actions";
import { getIpdDischargeRecord, getIpdNursingNotes } from "@/app/actions/ipd-discharge-actions";
import { IpdCaseSheet } from "./IpdCaseSheet";
import Link from "next/link";
import { Bed, Users, Settings, Receipt, ChevronLeft, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { PrivacyShield } from "@/components/PrivacyShield";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";

export const dynamic = "force-dynamic";

export default async function IpdAdmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await requirePermission('ipd:view', `/ipd/${id}`);
  const admissionId = parseInt(id, 10);
  if (isNaN(admissionId)) notFound();

  const [{ securityEnabled }, currentUser, data, existingDischarge, nursingNotes] = await Promise.all([
    getSecurityConfig(),
    getCurrentUser(),
    getIpdAdmissionById(admissionId),
    getIpdDischargeRecord(admissionId),
    getIpdNursingNotes(admissionId),
  ]);

  if (!data.admission) notFound();

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Top Navbar */}
      <nav className="bg-white border-b shadow-xs sticky top-0 z-10 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/ipd" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
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
                    Inpatient Case Sheet
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
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <IpdCaseSheet
          admission={data.admission}
          rounds={data.rounds}
          labReportsList={data.labReportsList}
          emarRecords={data.emarRecordsList || []}
          consents={data.consentsList || []}
          deposits={data.depositsList || []}
          fluidBalanceRecords={data.fluidBalanceList || []}
          settings={data.settings}
          userRole={role}
          currentStaffName={currentUser?.name}
          existingDischarge={existingDischarge}
          nursingNotes={nursingNotes}
          handovers={data.handoversList || []}
          clinicalServices={data.clinicalServicesList || []}
        />
      </main>
    </div>
  );
}
