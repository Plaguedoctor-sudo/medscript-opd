import { db } from "@/db";
import { patients, prescriptions, ipdAdmissions, labReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  FileText,
  Calendar,
  Phone,
  Fingerprint,
  PlusCircle,
  Edit,
  ExternalLink,
  Copy,
  MessageCircle,
  Bed,
  FlaskConical,
  HeartPulse,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Medication, Patient, Prescription, IpdAdmission, LabReport, LabResultParameter } from "@/types";
import { EditPatientModal } from "./EditPatientModal";
import { PatientVitalsAnalytics } from "./PatientVitalsAnalytics";
import { AdmitPatientModal } from "@/app/ipd/AdmitPatientModal";
import { LabEntryModal } from "@/app/labs/LabEntryModal";
import { formatDate } from "@/lib/utils";
import { requireAuth, getSecurityConfig, getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { LockDeskButton } from "@/components/LockDeskButton";
import { PrivacyShield } from "@/components/PrivacyShield";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { MaskedIdentifier } from "@/components/MaskedIdentifier";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";
import { PatientDocumentsSection } from "@/components/PatientDocumentsSection";
import { PatientCertificatesButton } from "@/components/PatientCertificatesButton";

export const dynamic = 'force-dynamic';

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth(`/patient/${id}`);
  const [{ securityEnabled }, role, currentUser] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
  ]);
  const patientId = parseInt(id, 10);

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
  });

  if (!patient) notFound();

  // Log clinical audit trail for record viewing
  await logAuditEvent({
    action: 'PATIENT_VIEWED',
    actorRole: role.toUpperCase(),
    details: `Patient medical profile viewed: ${patient.name} (Patient ID: ${patient.id}, Reg: ${patient.regNo || 'N/A'})`,
    status: 'SUCCESS',
  });

  const [patientPrescriptions, patientAdmissions, patientLabReports] = await Promise.all([
    db.query.prescriptions.findMany({
      where: eq(prescriptions.patientId, patientId),
      orderBy: [desc(prescriptions.createdAt)],
    }),
    db.query.ipdAdmissions.findMany({
      where: eq(ipdAdmissions.patientId, patientId),
      orderBy: [desc(ipdAdmissions.admissionDate)],
    }),
    db.query.labReports.findMany({
      where: eq(labReports.patientId, patientId),
      orderBy: [desc(labReports.createdAt)],
    }),
  ]);

  const typedPatient = patient as Patient;
  const typedPrescriptions = patientPrescriptions as Prescription[];
  const typedAdmissions = patientAdmissions as IpdAdmission[];
  const typedLabReports = patientLabReports as LabReport[];

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
            <UserProfileMenu user={currentUser} role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell />
            <EditPatientModal patient={typedPatient} />
            <LabEntryModal
              initialPatient={typedPatient}
              initialPatientId={typedPatient.id}
              triggerButton={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                  <FlaskConical className="w-3.5 h-3.5 text-indigo-600" /> Lab Test
                </Button>
              }
            />
            <AdmitPatientModal
              initialPatient={typedPatient}
              initialPatientId={typedPatient.id}
              triggerButton={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50">
                  <Bed className="w-3.5 h-3.5 text-purple-600" /> Admit IPD
                </Button>
              }
            />
            <PatientCertificatesButton patient={typedPatient} settings={null} />
            {(role === 'admin_doctor' || role === 'doctor') && (
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
                  {typedPatient.bloodGroup && (
                    <span className="font-mono text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full">
                      Blood Group: {typedPatient.bloodGroup}
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
                  {typedPatient.abhaAddress && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                      ABHA: {typedPatient.abhaAddress}
                    </span>
                  )}
                </div>
                {typedPatient.allergies ? (
                  <div className="mt-2.5 p-2 bg-rose-50 border border-rose-300 rounded-lg flex items-center gap-2 text-rose-900 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong className="text-rose-800 uppercase tracking-wide">Known Allergies: </strong>
                      {typedPatient.allergies}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>No known drug allergies (NKDA) reported</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {typedPrescriptions.length} {typedPrescriptions.length === 1 ? "Consultation" : "Consultations"}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                {typedAdmissions.length} {typedAdmissions.length === 1 ? "IPD Stay" : "IPD Stays"}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                {typedLabReports.length} {typedLabReports.length === 1 ? "Lab Report" : "Lab Reports"}
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
                            <Link href={`/prescription/${px.id}?send=whatsapp`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                title="Send Prescription to Patient via WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                              </Button>
                            </Link>
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

        {/* Inpatient Department (IPD) History */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-purple-950">
              <Bed className="w-5 h-5 text-purple-600" />
              Inpatient Admissions ({typedAdmissions.length})
            </CardTitle>
            <AdmitPatientModal
              initialPatient={typedPatient}
              initialPatientId={typedPatient.id}
              triggerButton={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50">
                  <Bed className="w-3.5 h-3.5 text-purple-600" /> Admit to IPD
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {typedAdmissions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No inpatient hospital stays recorded for this patient.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Ward & Bed</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedAdmissions.map((adm) => (
                    <TableRow key={adm.id}>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        <Link href={`/ipd/${adm.id}`} className="text-purple-700 hover:underline">
                          {adm.admissionNo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                        {adm.admissionDate ? formatDate(adm.admissionDate) : "N/A"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-bold text-purple-900 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                          {adm.bedNo}
                        </span>{" "}
                        <span className="text-slate-500 font-normal">({adm.ward})</span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-slate-900 font-medium">
                        {adm.admittingDiagnosis || "Under Clinical Evaluation"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            adm.status === "ADMITTED"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {adm.status === "ADMITTED" ? (
                            <HeartPulse className="w-3 h-3 text-purple-600 animate-pulse" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                          )}
                          {adm.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Link href={`/ipd/${adm.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <ExternalLink className="w-3 h-3" /> Case Sheet
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Diagnostic Laboratory Reports History */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-indigo-950">
              <FlaskConical className="w-5 h-5 text-indigo-600" />
              Diagnostic & Lab Reports ({typedLabReports.length})
            </CardTitle>
            <LabEntryModal
              initialPatient={typedPatient}
              initialPatientId={typedPatient.id}
              triggerButton={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                  <FlaskConical className="w-3.5 h-3.5 text-indigo-600" /> Record Lab Report
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {typedLabReports.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No diagnostic laboratory investigations recorded for this patient.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Investigation / Test</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Findings / Abnormalities</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedLabReports.map((lab) => {
                    let params: LabResultParameter[] = [];
                    try {
                      params = JSON.parse(lab.results || "[]");
                    } catch {
                      params = [];
                    }
                    const abnormals = params.filter(
                      (p) => p.flag === "HIGH" || p.flag === "LOW" || p.flag === "CRITICAL" || p.flag === "ABNORMAL"
                    );

                    return (
                      <TableRow key={lab.id}>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          <Link href={`/labs/${lab.id}`} className="text-indigo-700 hover:underline">
                            {lab.reportNo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                          {lab.createdAt ? formatDate(lab.createdAt) : "N/A"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-semibold text-slate-900">{lab.testName}</span>
                          <span className="text-[10px] text-slate-500 block font-normal">{lab.category}</span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              lab.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {lab.status === "COMPLETED" ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {lab.status}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {abnormals.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {abnormals.slice(0, 2).map((ab, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1 rounded font-semibold"
                                >
                                  {ab.parameter}: {ab.flag}
                                </span>
                              ))}
                              {abnormals.length > 2 && (
                                <span className="text-[10px] text-slate-400">+{abnormals.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium">Normal</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Link href={`/labs/${lab.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              <ExternalLink className="w-3 h-3" /> View Report
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Clinical Documents & Attachments Section */}
        <div className="pt-2">
          <PatientDocumentsSection patientId={patientId} userRole={role} />
        </div>
      </main>
    </div>
  );
}
