import NewPrescriptionForm from "./form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Stethoscope, Settings } from "lucide-react";
import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Patient, Prescription } from "@/types";
import { requireRole, getSecurityConfig } from "@/lib/auth";
import { LockDeskButton } from "@/components/LockDeskButton";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewPrescriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; cloneFrom?: string }>;
}) {
  const { patientId, cloneFrom } = await searchParams;
  const redirectTarget = cloneFrom
    ? `/prescription/new?cloneFrom=${cloneFrom}`
    : patientId
    ? `/prescription/new?patientId=${patientId}`
    : '/prescription/new';
  await requireRole(['doctor'], redirectTarget);
  const { securityEnabled } = await getSecurityConfig();
  const settings = await db.query.clinicSettings.findFirst();
  const backHref = patientId ? `/patient/${patientId}` : "/";

  let cloneData: (Prescription & { patient?: Patient }) | null = null;
  const cloneFromId = cloneFrom ? parseInt(cloneFrom, 10) : undefined;

  if (cloneFromId && !isNaN(cloneFromId)) {
    const rx = await db.query.prescriptions.findFirst({
      where: eq(prescriptions.id, cloneFromId),
    });
    if (rx) {
      const patient = await db.query.patients.findFirst({
        where: eq(patients.id, rx.patientId),
      });
      cloneData = {
        ...(rx as Prescription),
        id: 0, // 0 ensures createPrescription is called rather than update
        weight: null,
        bp: null,
        pulse: null,
        temp: null,
        spo2: null,
        followUpDate: null,
        patient: (patient as Patient) || undefined,
      };
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={backHref}>
              <Button variant="ghost" size="icon" title="Go Back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                <Stethoscope className="text-white w-4 h-4" />
              </div>
              <div>
                <span className="text-xl font-bold text-slate-900 tracking-tight block leading-tight">
                  {cloneFromId ? `Repeat Consultation (from Rx #${cloneFromId})` : "New Consultation"}
                </span>
                {settings?.doctorName && (
                  <span className="text-[11px] text-slate-500 font-medium block leading-none mt-0.5">
                    {settings.doctorName} {settings.clinicName ? `• ${settings.clinicName}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SecurityAlertBell />
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Settings className="w-3.5 h-3.5" /> Clinic Settings
              </Button>
            </Link>
            {securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <NewPrescriptionForm
          initialPatientId={patientId || (cloneData?.patientId ? String(cloneData.patientId) : undefined)}
          initialData={cloneData}
          cloneFromId={cloneFromId}
          doctorSettings={settings || undefined}
        />
      </div>
    </div>
  );
}

