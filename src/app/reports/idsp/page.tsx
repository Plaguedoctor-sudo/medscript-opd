'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Download,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileSpreadsheet,
  Stethoscope,
  Building,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  getIdspSurveillanceData,
  exportIdspFormPCsvAction,
  getCurrentEpidemiologicalWeek,
  IdspWeeklyReport,
} from './actions';
import { formatDate } from '@/lib/utils';

export default function IdspSurveillancePage() {
  const [year, setYear] = useState(2026);
  const [week, setWeek] = useState(39);
  const [report, setReport] = useState<IdspWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize with current epidemiological week
  useEffect(() => {
    getCurrentEpidemiologicalWeek().then(({ year: y, week: w }) => {
      setYear(y);
      setWeek(w);
    });
  }, []);

  const loadData = async (y: number, w: number) => {
    setLoading(true);
    try {
      const data = await getIdspSurveillanceData(y, w);
      setReport(data);
    } catch (err: unknown) {
      toast.show({
        title: 'Error loading surveillance data',
        description: err instanceof Error ? err.message : 'Please try again',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (year && week) {
      loadData(year, week);
    }
  }, [year, week]);

  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await exportIdspFormPCsvAction(year, week);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IDSP_Form_P_Week_${week}_${year}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.show({
        title: 'CSV Exported',
        description: `Official IDSP Form P for Week ${week} downloaded.`,
        type: 'success',
      });
    } catch (err: unknown) {
      toast.show({
        title: 'Export Error',
        description: err instanceof Error ? err.message : 'Failed to export CSV',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalSyndromicCases = report?.categories.reduce((acc, c) => acc + c.totalCases, 0) ?? 0;
  const alertCount = report?.categories.filter((c) => c.isAlertTriggered).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 print:bg-white print:p-0">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 print:hidden shadow-2xs">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <ArrowLeft className="w-4 h-4" /> Back to Reports
              </Button>
            </Link>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
                IDSP
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block leading-none">
                  Weekly Disease Surveillance
                </span>
                <span className="text-[11px] text-slate-500">IDSP Form P • Presumptive Syndromic Return</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadCsv}
              disabled={isExporting || loading}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Download Form P CSV
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" /> Print Surveillance Return
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {/* Week Selector Bar (Hidden when printing) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-700">Epidemiological Week:</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
              >
                {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>

            {report && (
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                {report.startDate} to {report.endDate}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadData(year, week)}
            disabled={loading}
            className="text-xs text-slate-600 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
          </Button>
        </div>

        {/* Epidemic Alerts Banner */}
        {alertCount > 0 && (
          <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start gap-3 text-red-950 animate-in fade-in print:border-red-500">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-red-900">
                Epidemic Early Warning Alert Triggered ({alertCount} Disease Categories Exceeding Threshold)
              </h3>
              <p className="text-xs text-red-800 leading-relaxed">
                The surveillance engine has detected a cluster of infectious syndromes exceeding the baseline epidemic threshold for this week. Notify the District Surveillance Unit (DSU / IDSP Cell) immediately.
              </p>
            </div>
          </div>
        )}

        {/* Summary Metric Cards (Hidden when printing) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:hidden">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Consultations</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {(report?.totalOpdCases ?? 0) + (report?.totalIpdCases ?? 0)}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {report?.totalOpdCases ?? 0} OPD • {report?.totalIpdCases ?? 0} IPD
            </span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Syndromic Infectious Cases</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{totalSyndromicCases}</div>
            <span className="text-[11px] text-slate-500">Communicable Disease Burden</span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Epidemic Alerts</span>
            <div className={`text-2xl font-black mt-1 ${alertCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {alertCount}
            </div>
            <span className="text-[11px] text-slate-500">
              {alertCount > 0 ? 'Exceeds Baseline Threshold' : 'All Syndromes within Normal Limit'}
            </span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Statutory Compliance</span>
            <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 mt-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              NCDC IDSP Standard
            </div>
            <span className="text-[11px] text-slate-500">Weekly Return Form P Ready</span>
          </div>
        </div>

        {/* Printable Official IDSP Surveillance Return Document */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 print:border-none print:shadow-none print:p-0">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center space-y-1">
            <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded font-mono text-[10px] uppercase tracking-widest mb-1">
              Government of India • Ministry of Health & Family Welfare
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
              Integrated Disease Surveillance Programme (IDSP)
            </h1>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Form P (Weekly Syndromic Disease Surveillance Return)
            </h2>
            <div className="text-xs text-slate-600 pt-1 flex flex-wrap items-center justify-center gap-4">
              <span><strong>Facility:</strong> {report?.clinic.name}</span>
              <span><strong>Reporting Officer:</strong> Dr. {report?.clinic.doctor} ({report?.clinic.regNumber})</span>
              <span>
                <strong>Period:</strong> Week {week} ({report?.startDate} to {report?.endDate}, {year})
              </span>
            </div>
          </div>

          {/* Form P Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th rowSpan={2} className="py-2 px-2.5 w-10 text-center border-r border-slate-200">#</th>
                  <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">Diseases / Syndromic Conditions</th>
                  <th rowSpan={2} className="py-2 px-2.5 text-center w-20 border-r border-slate-200">Code</th>
                  <th colSpan={2} className="py-1 px-2 text-center border-b border-r border-slate-200 bg-blue-50/60">&lt; 5 Yrs</th>
                  <th colSpan={2} className="py-1 px-2 text-center border-b border-r border-slate-200 bg-indigo-50/60">5 - 14 Yrs</th>
                  <th colSpan={2} className="py-1 px-2 text-center border-b border-r border-slate-200 bg-purple-50/60">&gt;= 15 Yrs</th>
                  <th rowSpan={2} className="py-2 px-2.5 text-center w-16 border-r border-slate-200 bg-slate-200/70">Total</th>
                  <th rowSpan={2} className="py-2 px-2.5 text-center w-16 border-r border-slate-200">IPD</th>
                  <th rowSpan={2} className="py-2 px-3 text-center w-28">Alert Status</th>
                </tr>
                <tr className="text-[10px] text-slate-500 font-mono">
                  <th className="py-1 px-1.5 text-center border-r border-slate-200">M</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-200">F</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-200">M</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-200">F</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-200">M</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-200">F</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {report?.categories.map((c, idx) => (
                  <tr key={c.id} className={c.isAlertTriggered ? 'bg-red-50/70 font-semibold' : ''}>
                    <td className="py-2 px-2.5 text-center text-slate-500 border-r border-slate-200">{idx + 1}</td>
                    <td className="py-2 px-3 font-sans font-medium text-slate-900 border-r border-slate-200">
                      {c.name}
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-600 border-r border-slate-200 text-[11px]">
                      {c.syndromeCode}
                    </td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 text-slate-700">{c.under5Male}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 text-slate-700">{c.under5Female}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 text-slate-700">{c.age5to14Male}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 text-slate-700">{c.age5to14Female}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 text-slate-700">{c.over15Male}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 text-slate-700">{c.over15Female}</td>
                    <td className="py-2 px-2.5 text-center font-bold text-slate-900 border-r border-slate-200 bg-slate-50">
                      {c.totalCases}
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-700 border-r border-slate-200">
                      {c.totalAdmissions}
                    </td>
                    <td className="py-2 px-3 text-center text-[10px] font-sans">
                      {c.isAlertTriggered ? (
                        <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold">
                          ALERT TRIGGERED
                        </span>
                      ) : (
                        <span className="text-slate-400">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures & Submission Footer */}
          <div className="pt-10 mt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div className="space-y-1">
              <p className="font-semibold text-slate-700">Official Weekly IDSP Presumptive Surveillance Return</p>
              <p className="text-[10px]">
                Certified true and verified by Medical Officer in charge • Generated automatically from MedScript EMR
              </p>
            </div>

            <div className="text-right">
              <div className="w-48 border-b border-slate-400 mb-1.5"></div>
              <div className="font-bold text-slate-900">Dr. {report?.clinic.doctor}</div>
              <div className="text-[10px] text-slate-500">
                Medical Officer / Superintendent • Reg: {report?.clinic.regNumber}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
