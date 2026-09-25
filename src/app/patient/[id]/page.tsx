import { db } from "@/db";
import { patients, prescriptions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, User, FileText, Calendar, Phone, Fingerprint, PlusCircle, Edit, ExternalLink, Copy } from "lucide-react";
import { Medication, Patient, Prescription } from "@/types";
import { EditPatientModal } from "./EditPatientModal";
import { PatientVitalsAnalytics } from "./PatientVitalsAnalytics";
import { formatDate } from "@/lib/utils";
import { requireAuth, getSecurityConfig, getCurrentUserRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { LockDeskButton } from "@/components/LockDeskButton";
import { PrivacyShield } from "@/components/PrivacyShield";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { MaskedIdentifier } from "@/components/MaskedIdentifier";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";

export const dynamic = 'force-dynamic';

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth(`/patient/${id}`);
  const [{ securityEnabled }, role] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
  ]);
  const patientId = parseInt(id, 10);

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
  });

  if (!patient) notFound();

  // Log clinical audit trail for record viewing
  await logAuditEvent({
    action: 'PATIENT_VIEWED',
    actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
    details: `Patient medical profile viewed: ${patient.name} (Patient ID: ${patient.id}, Reg: ${patient.regNo || 'N/A'})`,
    status: 'SUCCESS',
  });

  const patientPrescriptions = await db.query.prescriptions.findMany({
    where: eq(prescriptions.patientId, patientId),
    orderBy: [desc(prescriptions.createdAt)],
  });

  const typedPatient = patient as Patient;
  const typedPrescriptions = patientPrescriptions as Prescription[];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/patients">
              <Button variant="ghost" size="icon" title="Back to Patients">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Patient Profile</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <UserRoleBadge role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell />
            <EditPatientModal patient={typedPatient} />
            {role === 'doctor' && (
              <Link href={`/prescription/new?patientId=${typedPatient.id}`}>
                <Button size="sm" className="gap-1.5 shadow-xs">
                  <PlusCircle className="w-4 h-4" /> New Consultation
                </Button>
              </Link>
            )}
            {securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        {/* Patient Info Card */}
        <Card className="overflow-hidden border-slate-200">
          <div className="h-2 bg-blue-600" />
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                <User className="w-8 h-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <CardTitle className="text-2xl text-slate-900">{typedPatient.name}</CardTitle>
                  {typedPatient.regNo && (
                    <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full">
                      Reg No: {typedPatient.regNo}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-slate-500 text-sm">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-slate-400" /> {typedPatient.age} years / {typedPatient.gender}
                  </span>
                  {typedPatient.phone && (
                    <MaskedIdentifier
                      value={typedPatient.phone}
                      type="phone"
                      icon={<Phone className="w-3.5 h-3.5 text-slate-400" />}
                    />
                  )}
                  {typedPatient.abhaId && (
                    <MaskedIdentifier
                      value={typedPatient.abhaId}
                      type="abha"
                      icon={<Fingerprint className="w-3.5 h-3.5 text-slate-400" />}
                    />
                  )}
                </div>
              </div>
            </div>
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {typedPrescriptions.length} {typedPrescriptions.length === 1 ? "Consultation" : "Consultations"}
              </span>
            </div>
          </CardHeader>
        </Card>

        {/* Longitudinal Vitals & Clinical Analytics */}
        <PatientVitalsAnalytics prescriptions={typedPrescriptions} patientName={typedPatient.name} />

        {/* Prescription History */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              Prescription History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typedPrescriptions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="mb-4">No prescriptions found for this patient.</p>
                <Link href={`/prescription/new?patientId=${typedPatient.id}`}>
                  <Button size="sm">Start Consultation</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Medications</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedPrescriptions.map((px) => {
                    let medications: Medication[] = [];
                    try {
                      medications = JSON.parse(px.medications || "[]");
                    } catch {
                      medications = [];
                    }

                    return (
                      <TableRow key={px.id}>
                        <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                          {px.createdAt ? formatDate(px.createdAt) : "N/A"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-800 font-medium">
                          {px.diagnosis || "No specific diagnosis"}
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <div className="text-xs text-slate-600 truncate">
                            {medications.length > 0
                              ? medications.map((m) => `${m.prefix ? `${m.prefix} ` : ""}${m.name}`).filter(Boolean).join(", ")
                              : "None"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {px.followUpDate ? formatDate(px.followUpDate) : "None"}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/prescription/new?patientId=${typedPatient.id}&cloneFrom=${px.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 gap-1 text-slate-600 hover:text-emerald-600"
                                title="Repeat / Clone medications into a new consultation"
                              >
                                <Copy className="w-3.5 h-3.5" /> Repeat Rx
                              </Button>
                            </Link>
                            <Link href={`/prescription/${px.id}/edit`}>
                              <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-slate-600 hover:text-blue-600" title="Edit Prescription">
                                <Edit className="w-3.5 h-3.5" /> Edit
                              </Button>
                            </Link>
                            <Link href={`/prescription/${px.id}`}>
                              <Button variant="outline" size="sm" className="h-8 gap-1">
                                <ExternalLink className="w-3.5 h-3.5" /> View/Print
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
