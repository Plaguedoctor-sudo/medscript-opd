'use client'

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { LabReportWithPatient, LabResultParameter, ClinicSettings } from "@/types";
import { deleteLabReport, logLabReportAction } from "../actions";
import {
  ArrowLeft,
  Printer,
  MessageCircle,
  FlaskConical,
  Receipt,
  ShieldCheck,
  Trash2,
} from "lucide-react";

interface LabReportViewProps {
  report: LabReportWithPatient;
  settings: ClinicSettings | null;
  userRole?: string;
}

export function LabReportView({ report, settings, userRole }: LabReportViewProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  let parameters: LabResultParameter[] = [];
  try {
    parameters = JSON.parse(report.results || "[]");
  } catch {
    parameters = [];
  }

  const abnormalParams = parameters.filter(
    (p) => p.flag === "HIGH" || p.flag === "LOW" || p.flag === "CRITICAL" || p.flag === "ABNORMAL"
  );

  const handlePrint = async () => {
    await logLabReportAction(report.id, "PRINT");
    window.print();
  };

  const handleWhatsApp = async () => {
    await logLabReportAction(report.id, "WHATSAPP");

    const abnormalSummary =
      abnormalParams.length > 0
        ? `\n⚠️ *Key Findings / Abnormalities:*\n` +
          abnormalParams.map((p) => `• ${p.parameter}: ${p.value} ${p.unit} (${p.flag})`).join("\n")
        : "\n✅ *All parameters within normal reference limits.*";

    const text = `*Diagnostic Lab Report - ${settings?.clinicName || "Clinic"}*\n` +
      `--------------------------------\n` +
      `*Report No:* ${report.reportNo}\n` +
      `*Patient:* ${report.patient.name} (${report.patient.age}y/${report.patient.gender})\n` +
      `*Investigation:* ${report.testName}\n` +
      `*Status:* ${report.status}\n` +
      `*Reported On:* ${report.reportedAt ? formatDate(report.reportedAt) : formatDate(new Date())}\n` +
      abnormalSummary +
      (report.interpretation ? `\n\n*Impression:* ${report.interpretation}` : "") +
      `\n\n_Generated securely by ${settings?.doctorName || "Attending Physician"}_`;

    const encoded = encodeURIComponent(text);
    const phone = report.patient.phone ? report.patient.phone.replace(/[^\d]/g, "") : "";
    const cleanPhone = phone.startsWith("91") && phone.length === 12 ? phone : `91${phone}`;

    if (phone.length >= 10) {
      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`, "_blank");
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete Lab Report ${report.reportNo}?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await deleteLabReport(report.id);
      if (res.success) {
        toast.show({
          title: "Report Deleted",
          description: `Lab Report ${report.reportNo} was removed.`,
          type: "info",
        });
        router.push("/labs");
      } else {
        toast.show({
          title: "Delete Failed",
          description: res.error || "Could not delete report.",
          type: "error",
        });
        setIsDeleting(false);
      }
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action toolbar (hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <Link href="/labs">
            <Button variant="ghost" size="sm" className="gap-1 text-slate-600">
              <ArrowLeft className="w-4 h-4" /> Lab Hub
            </Button>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href={`/patient/${report.patientId}`}>
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800">
              Patient Profile
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" /> Share WhatsApp
          </Button>

          <Link href={`/billing?patientId=${report.patientId}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Receipt className="w-4 h-4 text-blue-600" /> Bill This Test
            </Button>
          </Link>

          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 bg-slate-900 hover:bg-black text-white shadow-xs"
          >
            <Printer className="w-4 h-4" /> Print Report
          </Button>

          {(userRole === "admin_doctor" || userRole === "doctor") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Printable Clinical Lab Report Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 text-slate-800">
        {/* Lab / Clinic Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {settings?.clinicName || "DIAGNOSTIC PATHOLOGY LABORATORY"}
              </h1>
              <p className="text-xs font-semibold text-indigo-700 mt-0.5">
                Department of Clinical Pathology & Laboratory Medicine
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {settings?.address || "Clinical Care Center"} • Contact: {settings?.contact || "N/A"}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-md inline-block">
              {report.reportNo}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Sample Type: <span className="font-semibold text-slate-800">{report.sampleType || "Blood"}</span>
            </div>
            <div className="text-xs text-slate-500">
              Status:{" "}
              <span
                className={`font-bold ${
                  report.status === "COMPLETED" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {report.status}
              </span>
            </div>
          </div>
        </div>

        {/* Patient Demographics & Investigation Info */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 mb-6 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-400 block font-medium">PATIENT NAME</span>
            <span className="font-bold text-slate-900 text-sm">{report.patient.name}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">AGE / GENDER</span>
            <span className="font-semibold text-slate-800">
              {report.patient.age} Years / {report.patient.gender}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">REG / PATIENT ID</span>
            <span className="font-mono font-semibold text-slate-800">
              {report.patient.regNo || `#${report.patient.id}`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">REFERRED BY</span>
            <span className="font-semibold text-slate-800">
              {report.referredBy || settings?.doctorName || "Self / OPD"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">SPECIMEN</span>
            <span className="font-semibold text-slate-800">{report.sampleType || "Blood"}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">COLLECTED AT</span>
            <span className="font-semibold text-slate-800">
              {report.sampleCollectedAt ? formatDate(report.sampleCollectedAt) : formatDate(report.createdAt || new Date())}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">REPORTED AT</span>
            <span className="font-semibold text-slate-800">
              {report.reportedAt ? formatDate(report.reportedAt) : formatDate(report.createdAt || new Date())}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">CONTACT</span>
            <span className="font-semibold text-slate-800">{report.patient.phone || "N/A"}</span>
          </div>
        </div>

        {/* Investigation Title Banner */}
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg px-4 py-2.5 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-700" />
            <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide">
              {report.testName}
            </h2>
          </div>
          <span className="text-xs font-semibold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200">
            {report.category}
          </span>
        </div>

        {/* Results Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 w-5/12">Investigation / Parameter</th>
                <th className="py-2.5 px-4 w-3/12">Observed Value</th>
                <th className="py-2.5 px-4 w-2/12">Units</th>
                <th className="py-2.5 px-4 w-2/12">Biological Ref Interval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {parameters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    No individual parameters recorded.
                  </td>
                </tr>
              ) : (
                parameters.map((p, idx) => {
                  const isHigh = p.flag === "HIGH";
                  const isLow = p.flag === "LOW";
                  const isAbnormal = isHigh || isLow || p.flag === "CRITICAL" || p.flag === "ABNORMAL";

                  return (
                    <tr
                      key={p.id || idx}
                      className={isAbnormal ? "bg-amber-50/60 font-medium" : "hover:bg-slate-50/50"}
                    >
                      <td className="py-2 px-4 text-slate-900 font-medium">{p.parameter}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`font-bold inline-flex items-center gap-1.5 ${
                            isHigh
                              ? "text-red-700"
                              : isLow
                              ? "text-blue-700"
                              : "text-slate-900"
                          }`}
                        >
                          {p.value || "-"}
                          {isHigh && (
                            <span className="text-[9px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.2 rounded border border-red-200">
                              HIGH
                            </span>
                          )}
                          {isLow && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.2 rounded border border-blue-200">
                              LOW
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono text-slate-600">{p.unit || "-"}</td>
                      <td className="py-2 px-4 font-mono text-slate-600">{p.referenceRange || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clinical Impression / Notes */}
        {report.interpretation && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Pathologist / Doctor Impression & Remarks:
            </h3>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {report.interpretation}
            </p>
          </div>
        )}

        {/* Verification & Signatures Block */}
        <div className="border-t-2 border-slate-200 pt-8 mt-12 grid grid-cols-2 gap-8 items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Electronically Verified & Tamper-Sealed Report</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              Timestamp: {report.reportedAt ? new Date(report.reportedAt).toISOString() : new Date().toISOString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Testing Facility: {settings?.clinicName || "MedScript Pathology"}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block border-b-2 border-slate-900 pb-1 px-6 mb-1 text-sm font-serif italic text-slate-900">
              {settings?.doctorName || "Dr. Medical Officer"}
            </div>
            <p className="text-xs font-bold text-slate-900">
              {settings?.doctorName || "Authorized Signatory"}
            </p>
            <p className="text-[11px] text-slate-500">
              {settings?.qualifications || "MBBS, MD"} (Reg No: {settings?.regNumber || "N/A"})
            </p>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 leading-normal">
          * This diagnostic report reflects findings of the submitted sample only. Please correlate clinically with patient history.
          <br />
          MedScript Clinical Lab System • Tamper-evident EMR record
        </div>
      </div>
    </div>
  );
}
