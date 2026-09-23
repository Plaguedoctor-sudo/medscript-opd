import { db } from "@/db";
import { patients, prescriptions } from "@/db/schema";
import { desc, like, or, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Users, PlusCircle, ArrowLeft, Phone, Fingerprint } from "lucide-react";
import { DashboardSearch } from "@/components/DashboardSearch";
import { Patient } from "@/types";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams)?.q;

  // Fetch patients, optionally filtered by search
  const patientList = await db
    .select()
    .from(patients)
    .where(
      query
        ? or(
            like(patients.name, `%${query}%`),
            like(patients.phone, `%${query}%`),
            like(patients.abhaId, `%${query}%`)
          )
        : undefined
    )
    .orderBy(desc(patients.createdAt));

  // Get prescription counts per patient
  const prescriptionCounts = await db
    .select({
      patientId: prescriptions.patientId,
      count: count(prescriptions.id),
    })
    .from(prescriptions)
    .groupBy(prescriptions.patientId);

  const countMap = new Map<number, number>();
  for (const item of prescriptionCounts) {
    countMap.set(item.patientId, item.count);
  }

  const typedPatients = patientList as Patient[];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Top Navbar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" title="Dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Users className="text-white w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Patients Directory</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/prescription/new">
              <Button size="sm" className="gap-1.5">
                <PlusCircle className="w-4 h-4" /> New Consultation
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">
                {query ? `Search Results for "${query}" (${typedPatients.length})` : `All Registered Patients (${typedPatients.length})`}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Browse patient health records, contact information, and prescription history.
              </p>
            </div>
            <DashboardSearch />
          </CardHeader>
          <CardContent>
            {typedPatients.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-base font-medium mb-1">
                  {query ? "No patients matching your search." : "No patients registered yet."}
                </p>
                <p className="text-sm text-slate-400 mb-4">
                  Patients are automatically registered when creating a new consultation.
                </p>
                <Link href="/prescription/new">
                  <Button size="sm">Register New Patient Consultation</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Age / Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>ABHA ID</TableHead>
                    <TableHead className="text-center">Consultations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedPatients.map((patient) => {
                    const totalVisits = countMap.get(patient.id) || 0;
                    return (
                      <TableRow key={patient.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-semibold text-slate-900">
                          <Link href={`/patient/${patient.id}`} className="text-blue-600 hover:underline">
                            {patient.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {patient.age}y / {patient.gender}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {patient.phone ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {patient.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {patient.abhaId ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                              {patient.abhaId}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {totalVisits} {totalVisits === 1 ? "visit" : "visits"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/patient/${patient.id}`}>
                              <Button variant="outline" size="sm" className="h-8">
                                History
                              </Button>
                            </Link>
                            <Link href={`/prescription/new?patientId=${patient.id}`}>
                              <Button size="sm" className="h-8 gap-1">
                                <PlusCircle className="w-3.5 h-3.5" /> Consult
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
