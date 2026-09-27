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
import { Patient, IpdVitals } from "@/types";
import { searchPatients, getPatientById } from "@/app/prescription/new/actions";
import { createIpdAdmission } from "./actions";
import { STANDARD_WARDS } from "@/lib/ipd-constants";
import {
  Bed,
  Search,
  User,
  Activity,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface AdmitPatientModalProps {
  initialPatient?: Patient | null;
  initialPatientId?: number | null;
  triggerButton?: React.ReactElement;
  onSuccess?: (admissionId: number) => void;
}

export function AdmitPatientModal({
  initialPatient,
  initialPatientId,
  triggerButton,
  onSuccess,
}: AdmitPatientModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Patient Selection
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [patientSearch, setPatientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Admission Info
  const [ward, setWard] = useState<string>("General Male Ward");
  const [bedNo, setBedNo] = useState("Bed-01");
  const [roomType, setRoomType] = useState("General");
  const [attendingDoctor, setAttendingDoctor] = useState("");
  const [admittingDiagnosis, setAdmittingDiagnosis] = useState("");
  const [chiefComplaints, setChiefComplaints] = useState("");

  // Initial Vitals
  const [vitals, setVitals] = useState<IpdVitals>({
    bp: "120/80",
    pulse: "76",
    temp: "37.0",
    spo2: "99",
    weight: "",
    rbs: "",
  });

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

  const handleWardChange = (wardName: string) => {
    setWard(wardName);
    const found = STANDARD_WARDS.find((w) => w.name === wardName);
    if (found) {
      setRoomType(found.type);
      setBedNo(`${found.type === "ICU" ? "ICU" : "Bed"}-01`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.show({
        title: "Patient Required",
        description: "Please select a patient to admit.",
        type: "error",
      });
      return;
    }
    if (!bedNo.trim()) {
      toast.show({
        title: "Bed Number Required",
        description: "Please assign a bed or room number.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createIpdAdmission({
        patientId: selectedPatient.id,
        ward,
        bedNo: bedNo.trim(),
        roomType,
        attendingDoctor,
        admittingDiagnosis,
        chiefComplaints,
        admissionVitals: vitals,
      });

      if (res.success && res.admissionId) {
        toast.show({
          title: "Patient Admitted",
          description: `IPD Admission ${res.admissionNo} registered in ${ward} (${bedNo}).`,
          type: "success",
        });
        setOpen(false);
        if (onSuccess) {
          onSuccess(res.admissionId);
        } else {
          router.push(`/ipd/${res.admissionId}`);
        }
      } else {
        toast.show({
          title: "Admission Failed",
          description: res.error || "Could not register admission.",
          type: "error",
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: "Error",
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
            <Button size="sm" className="gap-1.5 shadow-xs bg-purple-600 hover:bg-purple-700 text-white">
              <Bed className="w-4 h-4" /> Inpatient Admission
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                <Bed className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle>New Inpatient Department (IPD) Admission</DialogTitle>
                <DialogDescription>
                  Register bed assignment, admitting diagnosis, and admission vitals.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Patient Selector */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Patient Selection *
              </Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
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

            {/* Ward & Bed Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ward / Department *</Label>
                <select
                  value={ward}
                  onChange={(e) => handleWardChange(e.target.value)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-md bg-white text-slate-900 text-xs focus:ring-2 focus:ring-purple-500"
                  required
                >
                  {STANDARD_WARDS.map((w) => (
                    <option key={w.name} value={w.name}>
                      {w.name} ({w.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Bed / Room No. *</Label>
                <Input
                  value={bedNo}
                  onChange={(e) => setBedNo(e.target.value)}
                  placeholder="e.g. Bed-03, ICU-2"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Attending Physician</Label>
                <Input
                  value={attendingDoctor}
                  onChange={(e) => setAttendingDoctor(e.target.value)}
                  placeholder="Dr. In Charge (Default: Clinic Doctor)"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Clinical Admission Info */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Provisional / Admitting Diagnosis *</Label>
                <Input
                  value={admittingDiagnosis}
                  onChange={(e) => setAdmittingDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Gastroenteritis with Moderate Dehydration, Dengue with Thrombocytopenia"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Chief Complaints & Clinical Presentation</Label>
                <textarea
                  value={chiefComplaints}
                  onChange={(e) => setChiefComplaints(e.target.value)}
                  placeholder="e.g. High grade fever with vomiting x 3 days, severe abdominal pain, weakness."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Admission Vitals */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-purple-600" /> Baseline Admission Vitals
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">BP (mmHg)</span>
                  <Input
                    value={vitals.bp}
                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                    placeholder="120/80"
                    className="h-7 text-xs bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Pulse (bpm)</span>
                  <Input
                    value={vitals.pulse}
                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                    placeholder="72"
                    className="h-7 text-xs bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Temp (°C)</span>
                  <Input
                    value={vitals.temp}
                    onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                    placeholder="37.0"
                    className="h-7 text-xs bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">SpO2 (%)</span>
                  <Input
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                    placeholder="99"
                    className="h-7 text-xs bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Weight (kg)</span>
                  <Input
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                    placeholder="65"
                    className="h-7 text-xs bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">RBS (mg/dL)</span>
                  <Input
                    value={vitals.rbs}
                    onChange={(e) => setVitals({ ...vitals, rbs: e.target.value })}
                    placeholder="110"
                    className="h-7 text-xs bg-white"
                  />
                </div>
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
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Registering Admission...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Confirm Admission
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
