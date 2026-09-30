'use client'

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { IpdAdmissionWithPatient } from "@/types";
import { AdmitPatientModal } from "./AdmitPatientModal";
import { STANDARD_WARDS } from "@/lib/ipd-constants";
import {
  Bed,
  Search,
  PlusCircle,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Activity,
  HeartPulse,
  Building,
} from "lucide-react";

interface IpdDashboardProps {
  admissions: IpdAdmissionWithPatient[];
  stats: {
    totalAdmitted: number;
    totalDischarged: number;
    totalAdmissions: number;
    occupancyRate: number;
  };
  userRole?: string;
  initialQuery?: string;
  initialStatus?: string;
  initialWard?: string;
}

export function IpdDashboard({
  admissions,
  stats,
  initialQuery = "",
  initialStatus = "ADMITTED",
  initialWard = "All",
}: IpdDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedWard, setSelectedWard] = useState(initialWard);

  const handleFilterChange = (newStatus?: string, newWard?: string) => {
    const s = newStatus !== undefined ? newStatus : selectedStatus;
    const w = newWard !== undefined ? newWard : selectedWard;
    setSelectedStatus(s);
    setSelectedWard(w);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (s !== "ALL") params.set("status", s);
    if (w !== "All") params.set("ward", w);

    router.push(`/ipd?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedStatus !== "ALL") params.set("status", selectedStatus);
    if (selectedWard !== "All") params.set("ward", selectedWard);

    router.push(`/ipd?${params.toString()}`);
  };

  const calculateDays = (admissionDate: Date, dischargeDate?: Date | null) => {
    const start = new Date(admissionDate).getTime();
    const end = dischargeDate ? new Date(dischargeDate).getTime() : new Date().getTime();
    const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    return diff === 1 ? "Day 1 (Admitted today)" : `Day ${diff} of stay`;
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Inpatients</p>
              <h3 className="text-2xl font-bold text-purple-700 mt-0.5">{stats.totalAdmitted}</h3>
              <p className="text-[11px] text-purple-600 font-medium mt-0.5">Currently occupying beds</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Bed className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bed Occupancy</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.occupancyRate}%</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">40 total clinic beds</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discharged Patients</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.totalDischarged}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Completed clinical care</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">All-Time Admissions</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalAdmissions}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Total IPD registrations</p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <Building className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Inpatient Department (IPD) Census & Wards
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage patient admissions, bed allocations, daily doctor rounds, and discharge summaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/ipd/monitoring">
            <Button variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold shadow-2xs">
              <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
              ICU &amp; IPD Telemetry Station
            </Button>
          </Link>

          <AdmitPatientModal
            triggerButton={
              <Button className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-xs">
                <PlusCircle className="w-4 h-4" /> New Inpatient Admission
              </Button>
            }
          />
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Admission No, Patient Name, Reg No, Ward, Bed, or Diagnosis..."
                className="pl-9 h-10 text-xs"
              />
            </form>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleFilterChange("ADMITTED", selectedWard)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedStatus === "ADMITTED"
                    ? "bg-white text-purple-700 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Active Census ({stats.totalAdmitted})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("DISCHARGED", selectedWard)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedStatus === "DISCHARGED"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Discharged ({stats.totalDischarged})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("ALL", selectedWard)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedStatus === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({stats.totalAdmissions})
              </button>
            </div>
          </div>

          {/* Ward Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => handleFilterChange(selectedStatus, "All")}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                selectedWard === "All"
                  ? "bg-slate-900 text-white border-slate-900 font-semibold"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              All Wards
            </button>
            {STANDARD_WARDS.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => handleFilterChange(selectedStatus, w.name)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  selectedWard === w.name
                    ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inpatient Census Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {admissions.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Bed className="w-12 h-12 mx-auto mb-3 opacity-20 text-purple-600" />
              <p className="text-base font-medium">No inpatients found.</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                {selectedStatus === "ADMITTED"
                  ? "No patients are currently admitted in the selected ward."
                  : "No inpatient admission records match your filters."}
              </p>
              <AdmitPatientModal
                triggerButton={
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                    Admit Inpatient
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[130px]">IPD Reg No</TableHead>
                  <TableHead>Admitted On</TableHead>
                  <TableHead>Patient Details</TableHead>
                  <TableHead>Ward & Bed</TableHead>
                  <TableHead>Admitting Diagnosis</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admissions.map((adm) => {
                  const isAdmitted = adm.status === "ADMITTED";

                  return (
                    <TableRow key={adm.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        <Link href={`/ipd/${adm.id}`} className="hover:underline text-purple-700">
                          {adm.admissionNo}
                        </Link>
                      </TableCell>

                      <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(adm.admissionDate)}
                        </span>
                        <span className="text-[11px] text-purple-700 font-semibold block">
                          {calculateDays(adm.admissionDate, adm.dischargeDate)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Link href={`/patient/${adm.patientId}`} className="text-blue-600 hover:underline font-semibold text-xs">
                          {adm.patient.name}
                        </Link>
                        <div className="text-[11px] text-slate-500">
                          {adm.patient.age}y / {adm.patient.gender}
                          {adm.patient.regNo && ` • Reg: ${adm.patient.regNo}`}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                            {adm.bedNo}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-600 block mt-0.5">{adm.ward}</span>
                      </TableCell>

                      <TableCell className="max-w-[220px]">
                        <span className="text-xs font-medium text-slate-900 line-clamp-2">
                          {adm.admittingDiagnosis || "Under Clinical Evaluation"}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                        {adm.attendingDoctor || "On Duty Doctor"}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isAdmitted
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {isAdmitted ? (
                            <HeartPulse className="w-3 h-3 text-purple-600 animate-pulse" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                          )}
                          {adm.status}
                        </span>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/ipd/${adm.id}`}>
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                              <ExternalLink className="w-3.5 h-3.5" /> Case Sheet
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
    </div>
  );
}
