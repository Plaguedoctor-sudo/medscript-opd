'use client'

/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Exclusive Lab Technician Diagnostic Results Editor.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { LabReportWithPatient, LabResultParameter, LabReportStatus, LabResultFlag } from "@/types";
import { updateLabReport } from "./actions";
import { evaluateLabValue } from "@/lib/lab-templates";
import {
  FlaskConical,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  Sparkles,
  Edit,
  ShieldCheck,
} from "lucide-react";

interface LabResultEditorModalProps {
  report: LabReportWithPatient;
  triggerButton?: React.ReactElement;
  currentStaffName?: string;
  onSuccess?: () => void;
}

export function LabResultEditorModal({
  report,
  triggerButton,
  currentStaffName,
  onSuccess,
}: LabResultEditorModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  let initialParameters: LabResultParameter[] = [];
  try {
    initialParameters = JSON.parse(report.results || "[]");
  } catch {
    initialParameters = [];
  }

  const [parameters, setParameters] = useState<LabResultParameter[]>(initialParameters);
  const [status, setStatus] = useState<LabReportStatus>(report.status);
  const [technicianName, setTechnicianName] = useState(
    report.technicianName || currentStaffName || "Medical Laboratory Technologist"
  );
  const [interpretation, setInterpretation] = useState(report.interpretation || "");
  const [notes, setNotes] = useState(report.notes || "");

  const handleParameterChange = (index: number, field: keyof LabResultParameter, val: string) => {
    setParameters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };

      if (field === "value" && next[index].referenceRange) {
        const autoFlag = evaluateLabValue(val, next[index].referenceRange);
        if (autoFlag) {
          next[index].flag = autoFlag;
        }
      }
      return next;
    });
  };

  const handleAddParameter = () => {
    setParameters((prev) => [
      ...prev,
      {
        parameter: "",
        value: "",
        unit: "",
        referenceRange: "",
        flag: "NORMAL",
      },
    ]);
  };

  const handleRemoveParameter = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAutoEvaluateAll = () => {
    let changed = 0;
    const evaluated = parameters.map((p) => {
      if (p.value && p.referenceRange) {
        const autoFlag = evaluateLabValue(p.value, p.referenceRange);
        if (autoFlag && autoFlag !== p.flag) {
          changed++;
          return { ...p, flag: autoFlag };
        }
      }
      return p;
    });
    setParameters(evaluated);
    toast.show({
      title: "Auto-Evaluation Complete",
      description: `Evaluated ${parameters.length} parameters (${changed} flag updates).`,
      type: "info",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await updateLabReport(report.id, {
        results: parameters,
        status,
        technicianName,
        interpretation,
        notes,
      });

      if (res.success) {
        toast.show({
          title: "Lab Results Saved",
          description: `Diagnostic test data for ${report.testName} updated successfully.`,
          type: "success",
        });
        setOpen(false);
        if (onSuccess) onSuccess();
        router.refresh();
      } else {
        toast.show({
          title: "Update Failed",
          description: res.error || "Failed to update lab data.",
          type: "error",
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          triggerButton || (
            <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              <Edit className="w-3.5 h-3.5" /> Edit Lab Data (Technician Only)
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Edit Lab Data & Diagnostic Results
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Technician Exclusive: Calibrate results, values, reference flags, and impression for {report.testName} ({report.reportNo}).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Header info badge */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Patient Name:</span>
                <span className="font-bold text-slate-900">{report.patient.name}</span>
                <span className="text-slate-500 ml-1.5">({report.patient.age}y / {report.patient.gender})</span>
              </div>
              <div>
                <span className="text-slate-500 block">Report Number:</span>
                <span className="font-mono font-bold text-indigo-950">{report.reportNo}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Referred By:</span>
                <span className="font-medium text-slate-800">{report.referredBy || "Attending Physician"}</span>
              </div>
            </div>

            {/* Status and Technician Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Verification & Completion Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LabReportStatus)}
                  className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                >
                  <option value="PENDING">PENDING - Awaiting Sample / Processing</option>
                  <option value="SAMPLE_COLLECTED">SAMPLE_COLLECTED - In Laboratory Analysis</option>
                  <option value="COMPLETED">COMPLETED - Results Verified & Signed Off</option>
                  <option value="CANCELLED">CANCELLED - Specimen Hemolyzed / Rejected</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Attending Lab Technician Name *</Label>
                <Input
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="Technician Full Name & Degree"
                  required
                  className="h-8 text-xs font-medium"
                />
              </div>
            </div>

            {/* Parameters Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Diagnostic Parameter Results ({parameters.length})
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoEvaluateAll}
                    className="h-7 text-[11px] gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-600" /> Auto-Flag Normals
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddParameter}
                    className="h-7 text-[11px] gap-1 bg-slate-900 text-white hover:bg-black"
                  >
                    <Plus className="w-3 h-3" /> Add Parameter
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b text-slate-500 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2 w-1/3">Parameter Name</th>
                      <th className="px-2 py-2 w-28">Result Value</th>
                      <th className="px-2 py-2 w-20">Unit</th>
                      <th className="px-2 py-2 w-28">Ref Range</th>
                      <th className="px-2 py-2 w-24">Flag</th>
                      <th className="px-2 py-2 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parameters.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-1.5">
                          <Input
                            value={p.parameter}
                            onChange={(e) => handleParameterChange(idx, "parameter", e.target.value)}
                            placeholder="e.g. Hemoglobin"
                            className="h-7 text-xs bg-slate-50 font-medium"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            value={p.value}
                            onChange={(e) => handleParameterChange(idx, "value", e.target.value)}
                            placeholder="e.g. 14.2"
                            className="h-7 text-xs font-bold text-slate-900"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            value={p.unit}
                            onChange={(e) => handleParameterChange(idx, "unit", e.target.value)}
                            placeholder="g/dL"
                            className="h-7 text-[11px] text-slate-600"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            value={p.referenceRange}
                            onChange={(e) => handleParameterChange(idx, "referenceRange", e.target.value)}
                            placeholder="13.0 - 17.0"
                            className="h-7 text-[11px] text-slate-500 font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            value={p.flag || "NORMAL"}
                            onChange={(e) => handleParameterChange(idx, "flag", e.target.value as LabResultFlag)}
                            className={`w-full h-7 px-1.5 border rounded text-[11px] font-bold ${
                              p.flag === "HIGH" || p.flag === "CRITICAL"
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : p.flag === "LOW"
                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                : "bg-white text-slate-700 border-slate-300"
                            }`}
                          >
                            <option value="NORMAL">NORMAL</option>
                            <option value="HIGH">HIGH ↑</option>
                            <option value="LOW">LOW ↓</option>
                            <option value="CRITICAL">CRITICAL ⚠</option>
                            <option value="ABNORMAL">ABNORMAL</option>
                          </select>
                        </td>
                        <td className="p-1.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveParameter(idx)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Clinical Interpretation & Notes */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Laboratory Diagnostic Impression / Interpretation</Label>
                <textarea
                  value={interpretation}
                  onChange={(e) => setInterpretation(e.target.value)}
                  placeholder="e.g. Normocytic normochromic blood picture. Mild neutrophilic leukocytosis. Platelet count adequate."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Technician Technical Remarks / Quality Control Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Repeated and verified on automated 5-part hematology analyzer."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Lab Technician exclusive editing verified</span>
            </div>
            <div className="flex items-center gap-2">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save Lab Results
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
