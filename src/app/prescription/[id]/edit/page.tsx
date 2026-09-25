import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import NewPrescriptionForm from "@/app/prescription/new/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Patient, Prescription } from "@/types";

export const dynamic = 'force-dynamic';

export default async function EditPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
            <span className="font-semibold text-slate-800">Edit Prescription #{prescriptionId}</span>
          </div>
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
