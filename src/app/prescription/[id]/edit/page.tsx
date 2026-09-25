import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import NewPrescriptionForm from "@/app/prescription/new/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Stethoscope } from "lucide-react";
import { Patient, Prescription } from "@/types";
import { requireRole } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(['doctor'], `/prescription/${id}/edit`);
  const prescriptionId = parseInt(id, 10);

  const prescription = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, prescriptionId),
  });

  if (!prescription) {
    notFound();
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, prescription.patientId),
  });

  const settings = await db.query.clinicSettings.findFirst();

  return (
    <div className="bg-slate-50 min-h-screen">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/prescription/${prescriptionId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                <Stethoscope className="text-white w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block leading-tight">Edit Prescription #{prescriptionId}</span>
                {settings?.doctorName && (
                  <span className="text-[11px] text-slate-500 font-medium block leading-none mt-0.5">
                    {settings.doctorName} {settings.clinicName ? `• ${settings.clinicName}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Settings className="w-3.5 h-3.5" /> Clinic Settings
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto py-6">
        <NewPrescriptionForm
          initialData={{
            ...(prescription as Prescription),
            patient: (patient as Patient) || undefined,
          }}
          doctorSettings={settings || undefined}
        />
      </div>
    </div>
  );
}
