import { db } from "@/db";
import { prescriptions, patients } from "@/db/schema";
import { desc, eq, or, like } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { PlusCircle, Settings, Users, FileText, AlertCircle, Edit, ExternalLink, Calendar } from "lucide-react";
import { DashboardSearch } from "@/components/DashboardSearch";
import { formatDate } from "@/lib/utils";
import { requireAuth, getSecurityConfig } from "@/lib/auth";
import { LockDeskButton } from "@/components/LockDeskButton";

interface ConsultationRow {
  id: number;
  patientId: number;
  createdAt: Date | null;
  diagnosis: string | null;
  patient: {
    name: string;
    age: number;
    gender: string;
    regNo?: string | null;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAuth('/');
  const { securityEnabled } = await getSecurityConfig();
  const query = (await searchParams)?.q;
  const clean = query ? query.trim() : "";
  let hyphenated = clean;
  if (/^\d{9,}$/.test(clean)) {
    hyphenated = `${clean.slice(0, 8)}-${clean.slice(8)}`;
  }

  // Fetch prescriptions with patient data, filtered by search query if present
  const results = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      createdAt: prescriptions.createdAt,
      diagnosis: prescriptions.diagnosis,
      patient: {
        name: patients.name,
        age: patients.age,
        gender: patients.gender,
        regNo: patients.regNo,
      },
    })
    .from(prescriptions)
    .innerJoin(patients, eq(prescriptions.patientId, patients.id))
    .where(
      clean
        ? or(
            like(patients.name, `%${clean}%`),
            like(patients.phone, `%${clean}%`),
            like(patients.regNo, `%${clean}%`),
            like(patients.regNo, `%${hyphenated}%`),
            like(prescriptions.diagnosis, `%${clean}%`)
          )
        : undefined
    )
    .orderBy(desc(prescriptions.createdAt))
    .limit(25);

  const totalPatients = await db.select().from(patients);
  const totalPrescriptions = await db.select().from(prescriptions);
  const settings = await db.query.clinicSettings.findFirst();

  const typedResults = results as ConsultationRow[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900 tracking-tight">MedScript OPD</span>
                <span className="hidden sm:inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Clinic EMR
                </span>
              </div>
              {settings?.doctorName && (
                <div className="text-[11px] text-slate-500 font-medium leading-none">
                  {settings.doctorName} {settings.clinicName ? `• ${settings.clinicName}` : ''}
                </div>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Users className="w-4 h-4" /> Patients
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </Link>
            <Link href="/prescription/new">
              <Button size="sm" className="gap-1.5">
                <PlusCircle className="w-4 h-4" /> New Consultation
              </Button>
            </Link>
            {securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Setup Banner if Settings are Empty */}
        {!settings && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Clinic Details Not Configured</p>
                <p className="text-xs text-amber-800">
                  Set up your doctor name, registration number, clinic logo, and contact info so they appear on prescription headers.
                </p>
              </div>
            </div>
            <Link href="/settings">
              <Button size="sm" variant="outline" className="bg-white border-amber-300 hover:bg-amber-100 text-amber-900 shrink-0">
                Setup Clinic Profile
              </Button>
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/patients" className="block group">
            <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Patients</p>
                    <h3 className="text-2xl font-bold text-slate-900">{totalPatients.length}</h3>
                  </div>
                </div>
                <span className="text-xs text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
                  View All &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Prescriptions Issued</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalPrescriptions.length}</h3>
              </div>
            </CardContent>
          </Card>

          <Link href="/prescription/new" className="block">
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Quick Consultation</h3>
                  <p className="text-blue-100 text-xs mt-0.5">Start consultation & issue Rx</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <PlusCircle className="w-6 h-6 text-white" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Records */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">
                {query ? `Search Results for "${query}"` : "Recent Consultations"}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {query ? `${typedResults.length} matching consultations found` : "Latest patient consultations and issued prescriptions"}
              </p>
            </div>
            <DashboardSearch />
          </CardHeader>
          <CardContent>
            {typedResults.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-base font-medium">{query ? "No matching records found." : "No prescriptions issued yet."}</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  {query ? "Try searching for a different name, phone number, or diagnosis." : "Create your first consultation to generate digital prescriptions."}
                </p>
                <Link href="/prescription/new">
                  <Button size="sm">Start First Consultation</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Age / Gender</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedResults.map((px) => (
                    <TableRow key={px.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {px.createdAt ? formatDate(px.createdAt) : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/patient/${px.patientId}`} className="text-blue-600 hover:underline font-semibold">
                          {px.patient.name}
                        </Link>
                        {px.patient.regNo && (
                          <span className="block font-mono text-[11px] text-slate-500 font-normal">
                            Reg: {px.patient.regNo}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs">
                        {px.patient.age}y / {px.patient.gender}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-800 text-xs font-medium">
                        {px.diagnosis || "No diagnosis recorded"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/prescription/${px.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-blue-600 gap-1" title="Edit Prescription">
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
