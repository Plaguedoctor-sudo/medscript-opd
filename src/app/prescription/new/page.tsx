import NewPrescriptionForm from "./form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Stethoscope } from "lucide-react";

export default async function NewPrescriptionPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const patientId = (await searchParams)?.patientId;
  const backHref = patientId ? `/patient/${patientId}` : "/";

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
              <span className="text-xl font-bold text-slate-900 tracking-tight">New Consultation</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <NewPrescriptionForm initialPatientId={patientId} />
      </div>
    </div>
  );
}

