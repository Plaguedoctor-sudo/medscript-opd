'use client'

import { useState, useEffect } from "react";
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
import { Patient, LabResultParameter, LabReportStatus } from "@/types";
import {
  STANDARD_LAB_TEMPLATES,
  findLabTemplate,
  createDefaultParameters,
  evaluateLabValue,
} from "@/lib/lab-templates";
import { searchPatients, getPatientById } from "@/app/prescription/new/actions";
import { createLabReport } from "./actions";
import {
  FlaskConical,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  Loader2,
  User,
  Sparkles,
} from "lucide-react";

interface LabEntryModalProps {
  initialPatient?: Patient | null;
  initialPatientId?: number | null;
  prescriptionId?: number | null;
  ipdAdmissionId?: number | null;
  preselectedTestName?: string | null;
  triggerButton?: React.ReactElement;
  onSuccess?: (reportId: number) => void;
}

export function LabEntryModal({
  initialPatient,
  initialPatientId,
  prescriptionId,
  ipdAdmissionId,
  preselectedTestName,
  triggerButton,
  onSuccess,
}: LabEntryModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Patient selection state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [patientSearch, setPatientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Lab details
  const [testName, setTestName] = useState(preselectedTestName || "Complete Blood Count (CBC)");
  const [category, setCategory] = useState("Hematology");
  const [sampleType, setSampleType] = useState("Blood (EDTA)");
  const [status, setStatus] = useState<LabReportStatus>("COMPLETED");
  const [referredBy, setReferredBy] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [notes, setNotes] = useState("");

  // Parameters
  const [parameters, setParameters] = useState<LabResultParameter[]>(() =>
    createDefaultParameters(preselectedTestName || "Complete Blood Count (CBC)")
  );

  // Fetch initial patient if ID provided
  useEffect(() => {
    if (initialPatientId && !selectedPatient) {
      getPatientById(initialPatientId).then((p) => {
        if (p) setSelectedPatient(p);
      });
    }
  }, [initialPatientId, selectedPatient]);

  // Handle patient search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!patientSearch.trim() || selectedPatient) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await searchPatients(patientSearch);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearch, selectedPatient]);

  // Switch template when test name selected from quick presets
  const handleSelectTemplate = (templateName: string) => {
    const tmpl = findLabTemplate(templateName);
    setTestName(templateName);
    if (tmpl) {
      setCategory(tmpl.category);
      setSampleType(tmpl.sampleType);
    }
    setParameters(createDefaultParameters(templateName));
  };

  const handleParameterValueChange = (index: number, val: string) => {
    setParameters((prev) => {
      const next = [...prev];
      const param = { ...next[index], value: val };
      param.flag = evaluateLabValue(val, param.referenceRange);
      next[index] = param;
      return next;
    });
  };

  const handleAddCustomParam = () => {
    setParameters((prev) => [
      ...prev,
      {
        id: `param-${Date.now()}`,
        parameter: "",
        value: "",
        unit: "",
        referenceRange: "",
        flag: "NORMAL",
      },
    ]);
  };

  const handleRemoveParam = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.show({
        title: "Patient Required",
        description: "Please select or search a patient for this lab report.",
        type: "error",
      });
      return;
    }
    if (!testName.trim()) {
      toast.show({
        title: "Test Name Required",
        description: "Please enter or select an investigation name.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createLabReport({
        patientId: selectedPatient.id,
        prescriptionId: prescriptionId || null,
        ipdAdmissionId: ipdAdmissionId || null,
        testName: testName.trim(),
        category,
        sampleType,
        referredBy,
        technicianName,
        results: parameters,
        interpretation,
        notes,
        status,
      });

      if (res.success && res.reportId) {
        toast.show({
          title: "Lab Report Created",
          description: `Report ${res.reportNo} saved successfully.`,
          type: "success",
        });
        setOpen(false);
        if (onSuccess) {
          onSuccess(res.reportId);
        } else {
          router.push(`/labs/${res.reportId}`);
        }
      } else {
        toast.show({
          title: "Error",
          description: res.error || "Failed to create lab report.",
          type: "error",
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: "Submission Error",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
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
          triggerButton ? (
            triggerButton
          ) : (
            <Button size="sm" className="gap-1.5 shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white">
              <FlaskConical className="w-4 h-4" /> Record Lab Report
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle>Record Diagnostic Lab Report</DialogTitle>
                <DialogDescription>
                  Enter laboratory findings, reference ranges, and test interpretation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Patient Selector */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Patient Information *
              </Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{selectedPatient.name}</span>
                        {selectedPatient.regNo && (
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            {selectedPatient.regNo}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {selectedPatient.age}y / {selectedPatient.gender} • {selectedPatient.phone || "No phone"}
                      </div>
                    </div>
                  </div>
                  {!initialPatientId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatient(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Change
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient by name, phone, or Reg No..."
                    className="pl-9 bg-white"
                  />
                  {isSearching && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-slate-400" />
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearch("");
                            setSearchResults([]);
                          }}
                          className="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium text-xs text-slate-900">{p.name}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({p.age}y / {p.gender})
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">{p.regNo || p.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Test Template Buttons */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Select Standard Diagnostic Panel
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {STANDARD_LAB_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.testName}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.testName)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                      testName === tmpl.testName
                        ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                    }`}
                  >
                    {tmpl.testName}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Investigation / Test Name *</Label>
                <Input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC)"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Sample / Specimen Type</Label>
                <Input
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  placeholder="e.g. Blood (EDTA), Urine"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Report Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LabReportStatus)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-md bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="COMPLETED">Completed (Verified)</option>
                  <option value="SAMPLE_COLLECTED">Sample Collected (In Progress)</option>
                  <option value="PENDING">Order Placed (Sample Pending)</option>
                </select>
              </div>
            </div>

            {/* Parameter Results Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Test Parameters & Observed Values ({parameters.length})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomParam}
                  className="h-7 text-xs gap-1 border-dashed"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Parameter
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <div className="col-span-4">Parameter</div>
                  <div className="col-span-3">Observed Value</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Ref Range</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                {parameters.map((p, index) => {
                  const isHigh = p.flag === "HIGH";
                  const isLow = p.flag === "LOW";
                  const isAbnormal = isHigh || isLow || p.flag === "CRITICAL" || p.flag === "ABNORMAL";

                  return (
                    <div
                      key={p.id || index}
                      className={`grid grid-cols-12 gap-2 px-3 py-1.5 items-center transition-colors ${
                        isAbnormal ? "bg-amber-50/50" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="col-span-4">
                        <Input
                          value={p.parameter}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParameters((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], parameter: val };
                              return next;
                            });
                          }}
                          placeholder="Parameter"
                          className="h-7 text-xs font-medium"
                        />
                      </div>

                      <div className="col-span-3 flex items-center gap-1.5">
                        <Input
                          value={p.value}
                          onChange={(e) => handleParameterValueChange(index, e.target.value)}
                          placeholder="Value"
                          className={`h-7 text-xs font-semibold ${
                            isHigh
                              ? "border-red-400 bg-red-50 text-red-900"
                              : isLow
                              ? "border-blue-400 bg-blue-50 text-blue-900"
                              : ""
                          }`}
                        />
                        {isHigh && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded shrink-0">
                            HIGH
                          </span>
                        )}
                        {isLow && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded shrink-0">
                            LOW
                          </span>
                        )}
                      </div>

                      <div className="col-span-2">
                        <Input
                          value={p.unit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParameters((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], unit: val };
                              return next;
                            });
                          }}
                          placeholder="Unit"
                          className="h-7 text-xs font-mono text-slate-600"
                        />
                      </div>

                      <div className="col-span-2">
                        <Input
                          value={p.referenceRange}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParameters((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], referenceRange: val };
                              return next;
                            });
                          }}
                          placeholder="Ref Range"
                          className="h-7 text-[11px] font-mono text-slate-500"
                        />
                      </div>

                      <div className="col-span-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveParam(index)}
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Doctor Impression & Clinical Interpretation */}
            <div className="space-y-1">
              <Label className="text-xs">Clinical Impression & Pathologist Notes</Label>
              <textarea
                value={interpretation}
                onChange={(e) => setInterpretation(e.target.value)}
                placeholder="e.g. Mild microcytic hypochromic anemia, suggestive of iron deficiency. Advise clinical correlation."
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Referred By, Technician & Internal Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Referred By</Label>
                <Input
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  placeholder="e.g. Dr. Sharma"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lab Technician</Label>
                <Input
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Internal Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional remarks"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-2">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving Report...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Save Lab Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
