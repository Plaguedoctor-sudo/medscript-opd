'use client'

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { LabReportWithPatient, LabResultParameter } from "@/types";
import { LabEntryModal } from "./LabEntryModal";
import { LAB_CATEGORIES } from "@/lib/lab-library";
import {
  FlaskConical,
  Search,
  PlusCircle,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface LabDashboardProps {
  reports: LabReportWithPatient[];
  stats: {
    totalReports: number;
    pendingCount: number;
    completedCount: number;
    abnormalCount: number;
  };
  userRole?: string;
  initialQuery?: string;
  initialStatus?: string;
  initialCategory?: string;
}

export function LabDashboard({
  reports,
  stats,
  initialQuery = "",
  initialStatus = "ALL",
  initialCategory = "All",
}: LabDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const handleFilterChange = (newStatus?: string, newCategory?: string) => {
    const s = newStatus !== undefined ? newStatus : selectedStatus;
    const c = newCategory !== undefined ? newCategory : selectedCategory;
    setSelectedStatus(s);
    setSelectedCategory(c);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (s !== "ALL") params.set("status", s);
    if (c !== "All") params.set("category", c);

    router.push(`/labs?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedStatus !== "ALL") params.set("status", selectedStatus);
    if (selectedCategory !== "All") params.set("category", selectedCategory);

    router.push(`/labs?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reports</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalReports}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">All diagnostic orders</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FlaskConical className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.completedCount}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Results verified</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress / Pending</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingCount}</h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Awaiting sample / result</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Abnormal Findings</p>
              <h3 className="text-2xl font-bold text-rose-600 mt-0.5">{stats.abnormalCount}</h3>
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">Out of range results</p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Diagnostic & Pathology Lab Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage laboratory investigations, enter parameter results, and print diagnostic reports.
          </p>
        </div>

        <LabEntryModal
          triggerButton={
            <Button className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
              <PlusCircle className="w-4 h-4" /> New Lab Order / Report
            </Button>
          }
        />
      </div>

      {/* Search & Filter Controls */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Report No, Patient Name, Reg No, or Test Name..."
                className="pl-9 h-10 text-xs"
              />
            </form>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleFilterChange("ALL", selectedCategory)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedStatus === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({stats.totalReports})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("COMPLETED", selectedCategory)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedStatus === "COMPLETED" ? "bg-white text-emerald-700 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Completed ({stats.completedCount})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("PENDING", selectedCategory)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedStatus === "PENDING" ? "bg-white text-amber-700 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pending ({stats.pendingCount})
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {LAB_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleFilterChange(selectedStatus, cat)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  selectedCategory === cat
                    ? "bg-slate-900 text-white border-slate-900 font-semibold"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-20 text-indigo-600" />
              <p className="text-base font-medium">No lab reports found.</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Record your first diagnostic test or select a patient to generate a report.
              </p>
              <LabEntryModal
                triggerButton={
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Record First Lab Report
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[120px]">Report No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient Details</TableHead>
                  <TableHead>Test / Investigation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => {
                  let params: LabResultParameter[] = [];
                  try {
                    params = JSON.parse(r.results || "[]");
                  } catch {
                    params = [];
                  }

                  const abnormals = params.filter(
                    (p) => p.flag === "HIGH" || p.flag === "LOW" || p.flag === "CRITICAL" || p.flag === "ABNORMAL"
                  );

                  return (
                    <TableRow key={r.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        <Link href={`/labs/${r.id}`} className="hover:underline text-indigo-700">
                          {r.reportNo}
                        </Link>
                      </TableCell>

                      <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {r.createdAt ? formatDate(r.createdAt) : "N/A"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Link href={`/patient/${r.patientId}`} className="text-blue-600 hover:underline font-semibold text-xs">
                          {r.patient.name}
                        </Link>
                        <div className="text-[11px] text-slate-500">
                          {r.patient.age}y / {r.patient.gender}
                          {r.patient.regNo && ` • Reg: ${r.patient.regNo}`}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-semibold text-slate-800">{r.testName}</div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {r.category}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            r.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {r.status === "COMPLETED" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {r.status}
                        </span>
                      </TableCell>

                      <TableCell className="max-w-[200px]">
                        {abnormals.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {abnormals.slice(0, 2).map((ab, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-semibold truncate max-w-[150px]"
                                title={`${ab.parameter}: ${ab.value} ${ab.unit}`}
                              >
                                {ab.parameter}: {ab.flag}
                              </span>
                            ))}
                            {abnormals.length > 2 && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                +{abnormals.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : params.length > 0 ? (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            Normal Limits
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No values entered</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/labs/${r.id}`}>
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
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
    </div>
  );
}
