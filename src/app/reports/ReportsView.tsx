'use client'

import { useState, useTransition } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Users,
  FileText,
  Activity,
  Pill,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { ReportsDataResult, getReportsData, ReportFilterOptions } from "./actions";
import {
  downloadCsvFile,
  generateConsultationRegisterCsv,
  generatePatientDirectoryCsv,
  generateDiagnosisAuditCsv,
  generateMedicationAuditCsv,
} from "@/lib/csv-export";

interface ReportsViewProps {
  initialData: ReportsDataResult;
}

export default function ReportsView({ initialData }: ReportsViewProps) {
  const [data, setData] = useState<ReportsDataResult>(initialData);
  const [range, setRange] = useState<ReportFilterOptions["range"]>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [searchTableQuery, setSearchTableQuery] = useState("");

  const handleRangeChange = (newRange: ReportFilterOptions["range"]) => {
    setRange(newRange);
    if (newRange !== "custom") {
      startTransition(async () => {
        try {
          const fresh = await getReportsData({ range: newRange });
          setData(fresh);
        } catch {
          toast.show({
            title: "Failed to load report",
            description: "Could not fetch report data for the selected period.",
            type: "error",
          });
        }
      });
    }
  };

  const handleApplyCustomRange = () => {
    if (!startDate) {
      toast.show({
        title: "Start Date Required",
        description: "Please specify a start date for the custom report.",
        type: "error",
      });
      return;
    }
    startTransition(async () => {
      try {
        const fresh = await getReportsData({
          range: "custom",
          startDate,
          endDate: endDate || startDate,
        });
        setData(fresh);
        toast.show({
          title: "Custom Report Loaded",
          description: `Showing data from ${startDate} to ${endDate || startDate}.`,
          type: "success",
        });
      } catch {
        toast.show({
          title: "Error Loading Data",
          description: "Could not fetch custom range records.",
          type: "error",
        });
      }
    });
  };

  // CSV Export Handlers
  const handleExportConsultations = () => {
    if (data.consultations.length === 0) {
      toast.show({
        title: "No Consultations Found",
        description: "There are no consultation records in this selected time range to export.",
        type: "error",
      });
      return;
    }
    const csv = generateConsultationRegisterCsv(data.consultations);
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `medscript-opd-register-${range}-${dateStamp}.csv`;
    downloadCsvFile(filename, csv);
    toast.show({
      title: "Consultation Register Exported",
      description: `Downloaded ${data.consultations.length} consultation records as CSV.`,
      type: "success",
    });
  };

  const handleExportPatients = () => {
    if (data.patientsDirectory.length === 0) {
      toast.show({
        title: "No Patients Found",
        description: "There are no patient records in the directory to export.",
        type: "error",
      });
      return;
    }
    const csv = generatePatientDirectoryCsv(data.patientsDirectory);
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `medscript-patient-directory-${dateStamp}.csv`;
    downloadCsvFile(filename, csv);
    toast.show({
      title: "Patient Directory Exported",
      description: `Downloaded ${data.patientsDirectory.length} patient master records as CSV.`,
      type: "success",
    });
  };

  const handleExportDiagnosisAudit = () => {
    if (data.diagnoses.length === 0) {
      toast.show({
        title: "No Diagnoses Recorded",
        description: "No clinical diagnoses available in this period to export.",
        type: "error",
      });
      return;
    }
    const csv = generateDiagnosisAuditCsv(data.diagnoses);
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `medscript-diagnosis-morbidity-audit-${dateStamp}.csv`;
    downloadCsvFile(filename, csv);
    toast.show({
      title: "Diagnosis Audit Exported",
      description: "Downloaded morbidity and clinical diagnosis audit breakdown.",
      type: "success",
    });
  };

  const handleExportMedicationAudit = () => {
    if (data.medications.length === 0) {
      toast.show({
        title: "No Medications Prescribed",
        description: "No medication records found in this timeframe.",
        type: "error",
      });
      return;
    }
    const csv = generateMedicationAuditCsv(data.medications);
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `medscript-drug-utilization-audit-${dateStamp}.csv`;
    downloadCsvFile(filename, csv);
    toast.show({
      title: "Drug Utilization Exported",
      description: "Downloaded medication usage and scheduling statistics.",
      type: "success",
    });
  };

  // Filter consultations table by client search query
  const filteredConsultations = data.consultations.filter((c) => {
    if (!searchTableQuery.trim()) return true;
    const q = searchTableQuery.toLowerCase();
    return (
      c.patientName.toLowerCase().includes(q) ||
      (c.regNo && c.regNo.toLowerCase().includes(q)) ||
      (c.diagnosis && c.diagnosis.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      String(c.id).includes(q)
    );
  });

  const totalPatientsInRange = data.stats.uniquePatientsInRange;
  const totalConsultationsInRange = data.stats.totalConsultationsInRange;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            OPD Clinical Reports &amp; Data Export
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Clinical audits, morbidity trends, medication utilization, and 1-click CSV/Excel downloads.
          </p>
        </div>

        {/* Global Patient Master Directory Download */}
        <Button
          onClick={handleExportPatients}
          variant="outline"
          className="border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-800 text-xs font-semibold gap-1.5 shadow-2xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          Export Patient Directory ({data.stats.allTimePatients})
        </Button>
      </div>

      {/* Date Range Filter Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Timeframe:</span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "week", label: "Last 7 Days" },
                  { id: "month", label: "This Month (30d)" },
                  { id: "year", label: "Last 1 Year" },
                  { id: "all", label: "All Time" },
                  { id: "custom", label: "Custom Range" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRangeChange(tab.id)}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    range === tab.id
                      ? "bg-blue-600 text-white shadow-2xs font-semibold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs */}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs w-36"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs w-36"
                title="End Date"
              />
              <Button
                size="sm"
                onClick={handleApplyCustomRange}
                disabled={isPending}
                className="h-8 text-xs px-3 bg-blue-600 hover:bg-blue-700"
              >
                Apply
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4 High-Impact KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Consultations
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalConsultationsInRange}</div>
            <p className="text-xs text-slate-500 mt-1">
              {range === "all" ? "Total across all time" : `Out of ${data.stats.allTimeConsultations} total all-time`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Unique Patients
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalPatientsInRange}</div>
            <p className="text-xs text-slate-500 mt-1">
              Directory: {data.stats.allTimePatients} registered
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs hover:border-purple-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Leading Diagnosis
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-slate-900 truncate" title={data.stats.mostCommonDiagnosis}>
              {data.stats.mostCommonDiagnosis}
            </div>
            <p className="text-xs text-purple-700 font-medium mt-1">
              {data.diagnoses[0] ? `${data.diagnoses[0].count} cases (${data.diagnoses[0].percentage.toFixed(0)}%)` : "No cases"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs hover:border-amber-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Top Medication
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-slate-900 truncate" title={data.stats.mostCommonDrug}>
              {data.stats.mostCommonDrug}
            </div>
            <p className="text-xs text-amber-700 font-medium mt-1">
              {data.medications[0] ? `Prescribed in ${data.medications[0].count} visits` : "None"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 1-Click Export Center */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            1-Click OPD Clinical Data Exports (Excel / CSV)
          </CardTitle>
          <p className="text-xs text-slate-600">
            Instant downloads formatted with UTF-8 BOM encoding for seamless opening in Microsoft Excel and LibreOffice.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Export 1: Consultation Register */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Consultation Register</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Full OPD visit logs with patient vitals, complaints, diagnoses, drugs, and lab tests.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleExportConsultations}
              className="w-full text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 h-9"
            >
              <Download className="w-3.5 h-3.5" /> Download Register ({data.consultations.length})
            </Button>
          </div>

          {/* Export 2: Patient Master Directory */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Patient Directory</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                All registered patients with Reg Nos, ABHA IDs, contact phone, and total OPD visits.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPatients}
              className="w-full text-xs font-semibold gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-9"
            >
              <Download className="w-3.5 h-3.5" /> Download Directory ({data.patientsDirectory.length})
            </Button>
          </div>

          {/* Export 3: Diagnosis & Morbidity Audit */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-slate-900 text-sm">Morbidity / Diagnosis Audit</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Clinical diagnosis frequency breakdown and percentage share for epidemiological reporting.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportDiagnosisAudit}
              className="w-full text-xs font-semibold gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50 h-9"
            >
              <Download className="w-3.5 h-3.5" /> Download Diagnosis CSV
            </Button>
          </div>

          {/* Export 4: Drug Utilization Audit */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-slate-900 text-sm">Drug Utilization Audit</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Prescription frequencies by molecule and brand with common schedules.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportMedicationAudit}
              className="w-full text-xs font-semibold gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 h-9"
            >
              <Download className="w-3.5 h-3.5" /> Download Drug Usage CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Breakdown Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Diagnoses Breakdown */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Top Clinical Diagnoses ({data.diagnoses.length})
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Most common presenting conditions in selected period</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportDiagnosisAudit}
              className="text-xs text-blue-600 h-8 gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.diagnoses.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No diagnoses recorded for this timeframe.</p>
            ) : (
              data.diagnoses.slice(0, 7).map((d) => (
                <div key={d.diagnosis} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{d.diagnosis}</span>
                    <span className="text-slate-500 font-mono">
                      {d.count} {d.count === 1 ? "case" : "cases"} ({d.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(d.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Prescribed Medications Breakdown */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Top Prescribed Medications ({data.medications.length})
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Most frequently prescribed drugs and formulations</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportMedicationAudit}
              className="text-xs text-blue-600 h-8 gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.medications.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No medications prescribed in this timeframe.</p>
            ) : (
              data.medications.slice(0, 7).map((m, idx) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 block">{m.name}</span>
                      {m.commonDosages.length > 0 && (
                        <span className="text-[11px] text-slate-500">
                          Typical dose: {m.commonDosages.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                    {m.count} {m.count === 1 ? "Rx" : "Rxs"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient Demographics Overview */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-blue-600" />
            Patient Demographics Breakdown
          </CardTitle>
          <p className="text-xs text-slate-500">Gender and age distribution among consulted patients</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Gender Distribution</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Male</span>
                <span className="text-lg font-bold text-blue-700">{data.demographics.maleCount}</span>
                <span className="text-[10px] text-slate-400 block">
                  {totalConsultationsInRange > 0
                    ? `${((data.demographics.maleCount / totalConsultationsInRange) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Female</span>
                <span className="text-lg font-bold text-pink-700">{data.demographics.femaleCount}</span>
                <span className="text-[10px] text-slate-400 block">
                  {totalConsultationsInRange > 0
                    ? `${((data.demographics.femaleCount / totalConsultationsInRange) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Other</span>
                <span className="text-lg font-bold text-slate-700">{data.demographics.otherCount}</span>
                <span className="text-[10px] text-slate-400 block">
                  {totalConsultationsInRange > 0
                    ? `${((data.demographics.otherCount / totalConsultationsInRange) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>

          {/* Age Brackets */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Age Group Brackets</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Pediatric (&lt;18)</span>
                <span className="text-lg font-bold text-emerald-700">{data.demographics.pediatricCount}</span>
                <span className="text-[10px] text-slate-400 block">
                  {totalConsultationsInRange > 0
                    ? `${((data.demographics.pediatricCount / totalConsultationsInRange) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Adults (18-59)</span>
                <span className="text-lg font-bold text-indigo-700">{data.demographics.adultCount}</span>
                <span className="text-[10px] text-slate-400 block">
                  {totalConsultationsInRange > 0
                    ? `${((data.demographics.adultCount / totalConsultationsInRange) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Geriatric (60+)</span>
                <span className="text-lg font-bold text-amber-700">{data.demographics.seniorCount}</span>
                <span className="text-[10px] text-slate-400 block">
                  {totalConsultationsInRange > 0
                    ? `${((data.demographics.seniorCount / totalConsultationsInRange) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consultations Audit Register Table */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              OPD Consultation Audit Register ({filteredConsultations.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual consultation records for audit verification and clinical review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search audit table..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 focus:bg-white"
              />
            </div>
            <Button
              size="sm"
              onClick={handleExportConsultations}
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-3.5 h-3.5" /> Export Table
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-16 font-semibold text-xs">Rx #</TableHead>
                <TableHead className="font-semibold text-xs">Date &amp; Time</TableHead>
                <TableHead className="font-semibold text-xs">Patient Details</TableHead>
                <TableHead className="font-semibold text-xs">Vitals</TableHead>
                <TableHead className="font-semibold text-xs">Diagnosis</TableHead>
                <TableHead className="font-semibold text-xs">Investigations</TableHead>
                <TableHead className="text-right font-semibold text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConsultations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                    No consultations matching the filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredConsultations.map((item) => {
                  const d = item.createdAt ? new Date(item.createdAt) : null;
                  const dateStr = d
                    ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "N/A";
                  const timeStr = d
                    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "";

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/80 text-xs">
                      <TableCell className="font-mono font-bold text-blue-700">#{item.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{dateStr}</div>
                        <div className="text-[11px] text-slate-400">{timeStr}</div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/patient/${item.patientId}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1"
                        >
                          {item.patientName}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        <div className="text-[11px] text-slate-500">
                          {item.age}y / {item.gender}
                          {item.regNo && ` • ${item.regNo}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-[11px]">
                          {item.bp && (
                            <span className="font-medium text-slate-700">
                              BP: {item.bp} mmHg
                            </span>
                          )}
                          {item.weight && (
                            <span className="text-slate-500 block">
                              Wt: {item.weight} kg
                            </span>
                          )}
                          {!item.bp && !item.weight && (
                            <span className="text-slate-400 italic">No vitals</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-900 block max-w-xs truncate" title={item.diagnosis || ""}>
                          {item.diagnosis || "Under Evaluation"}
                        </span>
                        {item.chiefComplaints && (
                          <span className="text-[11px] text-slate-500 block truncate max-w-xs" title={item.chiefComplaints}>
                            {item.chiefComplaints}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.labTests ? (
                          <span className="text-[11px] text-slate-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded block max-w-xs truncate" title={item.labTests}>
                            {item.labTests}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">None ordered</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/prescription/${item.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:text-blue-700 gap-1 px-2">
                            View Rx <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
