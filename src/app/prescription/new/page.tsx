import NewPrescriptionForm from "./form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Patient, Prescription } from "@/types";

export default async function NewPrescriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; cloneFrom?: string }>;
}) {
  const { patientId, cloneFrom } = await searchParams;
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-white w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {cloneFromId ? `Repeat Consultation (from Rx #${cloneFromId})` : "New Consultation"}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <NewPrescriptionForm
          initialPatientId={patientId || (cloneData?.patientId ? String(cloneData.patientId) : undefined)}
          initialData={cloneData}
          cloneFromId={cloneFromId}
        />
      </div>
    </div>
  );
}

