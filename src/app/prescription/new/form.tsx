'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPrescription, updatePrescription, searchPatients, getPatientById } from "./actions";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Search,
  User,
  X,
  Save,
  Loader2,
  Pill,
  Copy,
  Stethoscope,
  Activity,
  Sparkles,
  RotateCcw,
  Building,
  MapPin,
  Phone,
  Settings,
  AlertCircle,
  ExternalLink,
  FlaskConical,
  TestTube,
  TestTubes,
  Check,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Medication, Patient, Prescription, ClinicSettings } from "@/types";
import {
  DRUG_LIBRARY,
  DRUG_CATEGORIES,
  DrugItem,
  searchDrugs,
  FORM_PREFIX_MAP,
  MEDICATION_PREFIXES,
} from "@/lib/drug-library";
import {
  LAB_CATEGORIES,
  INDIVIDUAL_LAB_TESTS,
  searchLabLibrary,
  appendLabTests,
  LabPanel,
} from "@/lib/lab-library";

interface FormProps {
  initialPatientId?: string;
  initialData?: (Prescription & { patient?: Patient }) | null;
  cloneFromId?: number;
  doctorSettings?: ClinicSettings;
}

const DOSAGE_OPTIONS = [
  { value: "1-0-1", label: "1-0-1 (Morning & Night)" },
  { value: "1-0-0", label: "1-0-0 (Morning only)" },
  { value: "0-0-1", label: "0-0-1 (Night only)" },
  { value: "0-1-0", label: "0-1-0 (Afternoon only)" },
  { value: "1-1-1", label: "1-1-1 (Thrice daily - TDS)" },
  { value: "1-1-1-1", label: "1-1-1-1 (Four times daily - QID)" },
  { value: "1-0-1-0", label: "1-0-1-0 (Morning & Evening)" },
  { value: "0.5-0-0.5", label: "0.5-0-0.5 (Half tab twice)" },
  { value: "0.5-0-0", label: "0.5-0-0 (Half tab morning)" },
  { value: "0-0-0.5", label: "0-0-0.5 (Half tab night)" },
  { value: "SOS", label: "SOS (When required)" },
  { value: "1 Stat", label: "1 Stat (Single dose immediately)" },
  { value: "Alternate days", label: "Alternate days (QOD)" },
  { value: "Weekly once", label: "Weekly once" },
];

const DURATION_OPTIONS = [
  { value: "1 day", label: "1 day" },
  { value: "2 days", label: "2 days" },
  { value: "3 days", label: "3 days" },
  { value: "5 days", label: "5 days" },
  { value: "7 days", label: "7 days (1 week)" },
  { value: "10 days", label: "10 days" },
  { value: "14 days", label: "14 days (2 weeks)" },
  { value: "15 days", label: "15 days" },
  { value: "21 days", label: "21 days (3 weeks)" },
  { value: "1 month", label: "1 month (30 days)" },
  { value: "2 months", label: "2 months (60 days)" },
  { value: "3 months", label: "3 months (90 days)" },
  { value: "SOS", label: "SOS (When needed)" },
  { value: "Continuous", label: "Continuous / Chronic" },
];

const TIMING_OPTIONS = [
  { value: "After food", label: "After food (PC)" },
  { value: "Before food", label: "Before food (AC)" },
  { value: "With food", label: "With food" },
  { value: "At bedtime", label: "At bedtime (HS)" },
  { value: "Empty stomach", label: "Empty stomach" },
  { value: "As needed (SOS)", label: "As needed (SOS)" },
];

const COMMON_DOSAGES = ["1-0-1", "1-1-1", "1-0-0", "0-0-1", "0-1-0", "SOS"];
const COMMON_TIMINGS = ["After food", "Before food", "With food", "At bedtime", "Empty stomach"];
const COMMON_DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month"];

const DEFAULT_STANDARD_VITALS = {
  weight: "",
  bp: "120/80",
  pulse: "72",
  temp: "37.0",
  spo2: "99",
};

export default function NewPrescriptionForm({
  initialPatientId,
  initialData,
  cloneFromId,
  doctorSettings,
}: FormProps) {
  const router = useRouter();
  const isEditMode = !!initialData?.id;

  const [medications, setMedications] = useState<Medication[]>(() => {
    if (initialData?.medications) {
      try {
        const parsed = JSON.parse(initialData.medications);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return [
      {
        prefix: "Tab.",
        name: "",
        genericName: "",
        strength: "",
        dosage: "1-0-1",
        timing: "After food",
        duration: "5 days",
        instruction: "",
      },
    ];
  });

  // Focus ref management for pressing Enter in drug name box
  const drugNameInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (pendingFocusIndex.current !== null) {
      const el = drugNameInputRefs.current[pendingFocusIndex.current];
      if (el) {
        el.focus();
      }
      pendingFocusIndex.current = null;
    }
  }, [medications]);

  // Standard data prefilled in vitals (can be modified by doctor as required)
  const [vitals, setVitals] = useState({
    weight: initialData?.weight || "",
    bp: initialData?.bp !== undefined && initialData?.bp !== null && initialData?.bp !== ""
      ? initialData.bp
      : isEditMode ? "" : DEFAULT_STANDARD_VITALS.bp,
    pulse: initialData?.pulse !== undefined && initialData?.pulse !== null && initialData?.pulse !== ""
      ? initialData.pulse
      : isEditMode ? "" : DEFAULT_STANDARD_VITALS.pulse,
    temp: initialData?.temp !== undefined && initialData?.temp !== null && initialData?.temp !== ""
      ? (parseFloat(initialData.temp) > 50
          ? ((parseFloat(initialData.temp) - 32) * 5 / 9).toFixed(1)
          : initialData.temp)
      : isEditMode ? "" : DEFAULT_STANDARD_VITALS.temp,
    spo2: initialData?.spo2 !== undefined && initialData?.spo2 !== null && initialData?.spo2 !== ""
      ? initialData.spo2
      : isEditMode ? "" : DEFAULT_STANDARD_VITALS.spo2,
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialData?.patient || null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drug Library Search & Formulary State
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Lab Tests & Diagnostic Packages State
  const [labTests, setLabTests] = useState<string>(initialData?.labTests || "");
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState("");
  const [selectedLabCategory, setSelectedLabCategory] = useState<string>("All");

  const handleAddLabPanel = (panel: LabPanel) => {
    const updated = appendLabTests(labTests, panel.tests);
    setLabTests(updated);
    toast.show({
      title: `${panel.name} Added`,
      description: `Added ${panel.tests.length} tests to investigations.`,
      type: "success",
    });
  };

  const handleAddLabTest = (testName: string) => {
    const updated = appendLabTests(labTests, [testName]);
    setLabTests(updated);
    toast.show({
      title: "Test Added",
      description: `Added ${testName} to investigations.`,
      type: "success",
    });
  };

  const handleRemoveLabTest = (testToRemove: string) => {
    const current = labTests
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.toLowerCase() !== testToRemove.toLowerCase());
    setLabTests(current.join(", "));
  };

  const parsedCurrentTests = labTests
    .split(/,|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const currentTestsSet = new Set(parsedCurrentTests.map((t) => t.toLowerCase()));

  useEffect(() => {
    if (initialPatientId && !selectedPatient) {
      getPatientById(parseInt(initialPatientId, 10)).then((patient) => {
        if (patient) setSelectedPatient(patient);
      });
    }
  }, [initialPatientId, selectedPatient]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientSearch.length >= 2) {
        setIsSearching(true);
        const results = await searchPatients(patientSearch);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const prefillNormalVitals = () => {
    setVitals((prev) => ({
      ...prev,
      bp: DEFAULT_STANDARD_VITALS.bp,
      pulse: DEFAULT_STANDARD_VITALS.pulse,
      temp: DEFAULT_STANDARD_VITALS.temp,
      spo2: DEFAULT_STANDARD_VITALS.spo2,
    }));
    toast.show({
      title: "Standard Vitals Prefilled",
      description: "BP 120/80, Pulse 72, Temp 37.0°C, and SpO2 99% have been set. You can edit any value.",
      type: "info",
    });
  };

  const clearVitals = () => {
    setVitals({
      weight: "",
      bp: "",
      pulse: "",
      temp: "",
      spo2: "",
    });
  };

  const addMedication = () => {
    pendingFocusIndex.current = medications.length;
    setMedications([
      ...medications,
      {
        prefix: "Tab.",
        name: "",
        genericName: "",
        strength: "",
        dosage: "1-0-1",
        timing: "After food",
        duration: "5 days",
        instruction: "",
      },
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedicationField = (index: number, field: keyof Medication, value: string) => {
    const newMedications = [...medications];
    newMedications[index] = { ...newMedications[index], [field]: value };
    setMedications(newMedications);
  };

  const selectDrugForMedication = (index: number, drug: DrugItem, chosenBrandName?: string) => {
    const updated = [...medications];
    const prefix = FORM_PREFIX_MAP[drug.form] || "Tab.";
    const brandName = chosenBrandName || (drug.brandNames.length > 0 ? drug.brandNames[0] : drug.name);
    updated[index] = {
      ...updated[index],
      prefix,
      name: brandName,
      genericName: drug.genericName || drug.name,
      strength: drug.defaultStrength,
      dosage: drug.defaultDosage,
      timing: drug.defaultTiming,
      duration: drug.defaultDuration,
      instruction: drug.defaultInstruction,
    };
    setMedications(updated);
    setActiveSearchIndex(null);
    toast.show({
      title: "Drug Auto-Filled",
      description: `${prefix} ${brandName} (${drug.genericName}) added with schedule ${drug.defaultDosage}.`,
      type: "success",
    });
  };

  const addDrugFromLibrary = (drug: DrugItem, chosenBrandName?: string) => {
    const last = medications[medications.length - 1];
    const prefix = FORM_PREFIX_MAP[drug.form] || "Tab.";
    const brandName = chosenBrandName || (drug.brandNames.length > 0 ? drug.brandNames[0] : drug.name);
    const newEntry: Medication = {
      prefix,
      name: brandName,
      genericName: drug.genericName || drug.name,
      strength: drug.defaultStrength,
      dosage: drug.defaultDosage,
      timing: drug.defaultTiming,
      duration: drug.defaultDuration,
      instruction: drug.defaultInstruction,
    };

    if (medications.length === 1 && !last.name.trim()) {
      setMedications([newEntry]);
    } else {
      setMedications([...medications, newEntry]);
    }

    toast.show({
      title: "Added to Prescription",
      description: `${prefix} ${brandName} (${drug.genericName}) added with schedule ${drug.defaultDosage}.`,
      type: "success",
    });
  };

  const isKnownDosage = (val: string) => DOSAGE_OPTIONS.some((o) => o.value === val);
  const isKnownDuration = (val: string) => DURATION_OPTIONS.some((o) => o.value === val);
  const isKnownTiming = (val: string) => TIMING_OPTIONS.some((o) => o.value === val);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        patientId: selectedPatient ? selectedPatient.id : undefined,
        patientName: formData.get("patientName") as string,
        patientAge: formData.get("patientAge") as string,
        patientGender: formData.get("patientGender") as string,
        patientPhone: formData.get("patientPhone") as string,
        abhaId: formData.get("abhaId") as string,
        weight: vitals.weight,
        bp: vitals.bp,
        pulse: vitals.pulse,
        temp: vitals.temp,
        spo2: vitals.spo2,
        chiefComplaints: formData.get("chiefComplaints") as string,
        clinicalHistory: formData.get("clinicalHistory") as string,
        diagnosis: formData.get("diagnosis") as string,
        medications: medications.filter((m) => m.name.trim().length > 0),
        advice: formData.get("advice") as string,
        labTests: formData.get("labTests") as string,
        followUpDate: formData.get("followUpDate") as string,
      };

      if (initialData?.id) {
        const res = await updatePrescription(initialData.id, data);
        toast.show({
          title: "Prescription Updated",
          description: "Changes have been saved successfully.",
          type: "success",
        });
        router.push(`/prescription/${res.prescriptionId}`);
      } else {
        const res = await createPrescription(data);
        toast.show({
          title: "Prescription Created",
          description: "A new prescription has been generated.",
          type: "success",
        });
        router.push(`/prescription/${res.prescriptionId}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred while saving. Please try again.";
      toast.show({
        title: "Error",
        description: errorMsg,
        type: "error",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header with Title and Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Stethoscope className="w-7 h-7 text-blue-600" />
            {isEditMode ? "Edit Prescription" : "New Consultation Desk"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEditMode
              ? "Modify clinical notes, vitals, or prescribed medications."
              : "Record patient complaints, vitals, and issue a digital prescription."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditMode && (
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full font-semibold">
              Rx #{initialData.id}
            </div>
          )}
          <Link href="/settings">
            <Button variant="outline" size="sm" type="button" className="text-xs gap-1.5 text-slate-700 hover:text-blue-600">
              <Settings className="w-3.5 h-3.5" /> Clinic Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Clinic & Doctor Letterhead Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Active Prescription Letterhead</span>
            {doctorSettings?.clinicName && (
              <span className="text-slate-400 font-normal hidden sm:inline">| {doctorSettings.clinicName}</span>
            )}
          </div>
          <Link
            href="/settings"
            className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium transition-colors"
          >
            <span>Change Doctor / Clinic Profile</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-linear-to-r from-blue-50/30 via-white to-slate-50/40">
          {/* Clinic Details */}
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            {doctorSettings?.logoUrl ? (
              <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doctorSettings.logoUrl}
                  alt={doctorSettings.clinicName || "Clinic Logo"}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-blue-100/70 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
                <Building className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                {doctorSettings?.clinicName || "Clinic OPD"}
              </h2>
              {doctorSettings?.address && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{doctorSettings.address}</span>
                </div>
              )}
              {doctorSettings?.contact && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Tel / Contact: <strong className="text-slate-800 font-semibold">{doctorSettings.contact}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Doctor Details */}
          <div className="md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-200/80 shrink-0">
            <div className="text-base sm:text-lg font-bold text-blue-800 flex md:justify-end items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-blue-600 shrink-0 md:order-last" />
              <span>{doctorSettings?.doctorName || "Doctor Name Not Configured"}</span>
            </div>
            {doctorSettings?.qualifications && (
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                {doctorSettings.qualifications}
              </div>
            )}
            <div className="flex md:justify-end items-center gap-2 mt-1">
              {doctorSettings?.regNumber && (
                <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  Reg. No: {doctorSettings.regNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Missing Profile Warning */}
        {(!doctorSettings?.doctorName || !doctorSettings?.clinicName) && (
          <div className="bg-amber-50 px-4 py-2.5 border-t border-amber-200 flex flex-wrap items-center justify-between gap-3 text-amber-900 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Clinic or Doctor details are incomplete. Update your profile in Settings so correct letterhead appears on printouts.
              </span>
            </div>
            <Link href="/settings">
              <Button size="sm" variant="outline" type="button" className="h-6 text-[11px] bg-white border-amber-300 text-amber-900 hover:bg-amber-100">
                Setup Profile
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Clone Notice Banner */}
      {cloneFromId && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-900">
          <Copy className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Repeat Consultation:</strong> Medications and diagnosis have been copied from Prescription #{cloneFromId}. Record today&apos;s vitals and review prescribed drugs.
          </span>
        </div>
      )}

      {/* Patient Selection / Search */}
      {!selectedPatient && !isEditMode ? (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-900">
              <Search className="w-4 h-4 text-blue-600" /> Search Existing Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <Input
              placeholder="Start typing patient name or phone number..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="bg-white"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 left-6 right-6 mt-1 bg-white border rounded-md shadow-lg overflow-hidden">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0 flex items-center justify-between transition-colors"
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearchResults([]);
                      setPatientSearch("");
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        {p.regNo && (
                          <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                            Reg: {p.regNo}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {p.age}y / {p.gender} {p.phone ? `• ${p.phone}` : ""} {p.abhaId ? `• ABHA: ${p.abhaId}` : ""}
                      </div>
                    </div>
                    <User className="w-4 h-4 text-blue-500" />
                  </button>
                ))}
              </div>
            )}
            {isSearching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-slate-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Searching...
              </div>
            )}
          </CardContent>
        </Card>
      ) : selectedPatient ? (
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>Patient: {selectedPatient.name}</span>
                  {selectedPatient.regNo && (
                    <span className="font-mono text-xs font-bold bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full">
                      Reg No: {selectedPatient.regNo}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  {selectedPatient.age}y / {selectedPatient.gender} {selectedPatient.phone ? `• ${selectedPatient.phone}` : ""} {selectedPatient.abhaId ? `• ABHA: ${selectedPatient.abhaId}` : ""}
                </div>
              </div>
            </div>
            {!isEditMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPatient(null)}
                className="text-slate-500 hover:text-red-600"
              >
                <X className="w-4 h-4 mr-1" /> Change
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Patient Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Patient Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="patientRegNo">Patient Reg. No.</Label>
              <span className="text-[10px] text-blue-600 font-medium">YYYYMMDD-N</span>
            </div>
            <Input
              id="patientRegNo"
              value={selectedPatient?.regNo || (isEditMode ? initialData?.patient?.regNo || "" : "Auto-generated on save (YYYYMMDD-N)")}
              readOnly
              className="bg-slate-50 text-slate-600 font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientName">Full Name *</Label>
            <Input
              id="patientName"
              name="patientName"
              required
              defaultValue={selectedPatient?.name || ""}
              readOnly={!!selectedPatient || isEditMode}
              className={selectedPatient || isEditMode ? "bg-slate-50 text-slate-700" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientAge">Age (Years) *</Label>
            <Input
              id="patientAge"
              name="patientAge"
              type="number"
              min="0"
              max="150"
              required
              defaultValue={selectedPatient?.age ?? ""}
              readOnly={!!selectedPatient || isEditMode}
              className={selectedPatient || isEditMode ? "bg-slate-50 text-slate-700" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientGender">Gender *</Label>
            {selectedPatient || isEditMode ? (
              <Input
                value={selectedPatient?.gender || ""}
                readOnly
                className="bg-slate-50 text-slate-700"
              />
            ) : (
              <select
                id="patientGender"
                name="patientGender"
                className="w-full h-10 px-3 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            )}
            {(selectedPatient || isEditMode) && (
              <input type="hidden" name="patientGender" value={selectedPatient?.gender || ""} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientPhone">Contact Phone</Label>
            <Input
              id="patientPhone"
              name="patientPhone"
              placeholder="+91 9876543210"
              defaultValue={selectedPatient?.phone || ""}
              readOnly={!!selectedPatient || isEditMode}
              className={selectedPatient || isEditMode ? "bg-slate-50 text-slate-700" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abhaId">ABHA ID (Ayushman Bharat)</Label>
            <Input
              id="abhaId"
              name="abhaId"
              placeholder="14-digit ABHA number"
              defaultValue={selectedPatient?.abhaId || ""}
              readOnly={!!selectedPatient || isEditMode}
              className={selectedPatient || isEditMode ? "bg-slate-50 text-slate-700" : ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vital Signs (Standard values prefilled, fully editable as doctor requires) */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Vital Signs
                <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Standard Data Prefilled • Editable
                </span>
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={prefillNormalVitals}
              className="text-xs h-8 text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
              title="Reset all vitals to standard normal clinical adult values"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" /> Prefill Standard Normals
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearVitals}
              className="text-xs h-8 text-slate-500 hover:text-slate-800"
              title="Clear all vital values"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vital-weight" className="text-xs font-semibold text-slate-700">Weight (kg)</Label>
                <span className="text-[10px] text-slate-400">Optional</span>
              </div>
              <Input
                id="vital-weight"
                name="weight"
                placeholder="e.g. 68"
                value={vitals.weight}
                onChange={(e) => setVitals((v) => ({ ...v, weight: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vital-bp" className="text-xs font-semibold text-slate-700">BP (mmHg)</Label>
                <span className="text-[10px] text-emerald-600 font-medium">Std: 120/80</span>
              </div>
              <Input
                id="vital-bp"
                name="bp"
                placeholder="120/80"
                value={vitals.bp}
                onChange={(e) => setVitals((v) => ({ ...v, bp: e.target.value }))}
                className="bg-white"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {["120/80", "110/70", "130/85", "140/90"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVitals((v) => ({ ...v, bp: val }))}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      vitals.bp === val ? "bg-blue-600 text-white border-blue-600 font-medium" : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vital-pulse" className="text-xs font-semibold text-slate-700">Pulse (bpm)</Label>
                <span className="text-[10px] text-emerald-600 font-medium">Std: 72</span>
              </div>
              <Input
                id="vital-pulse"
                name="pulse"
                placeholder="72"
                value={vitals.pulse}
                onChange={(e) => setVitals((v) => ({ ...v, pulse: e.target.value }))}
                className="bg-white"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {["72", "76", "84", "96"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVitals((v) => ({ ...v, pulse: val }))}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      vitals.pulse === val ? "bg-blue-600 text-white border-blue-600 font-medium" : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vital-temp" className="text-xs font-semibold text-slate-700">Temp (°C)</Label>
                <span className="text-[10px] text-emerald-600 font-medium">Std: 37.0</span>
              </div>
              <Input
                id="vital-temp"
                name="temp"
                placeholder="37.0"
                value={vitals.temp}
                onChange={(e) => setVitals((v) => ({ ...v, temp: e.target.value }))}
                className="bg-white"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {["36.5", "37.0", "37.5", "38.0", "38.5"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVitals((v) => ({ ...v, temp: val }))}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      vitals.temp === val ? "bg-blue-600 text-white border-blue-600 font-medium" : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {val}°C
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vital-spo2" className="text-xs font-semibold text-slate-700">SPO2 (%)</Label>
                <span className="text-[10px] text-emerald-600 font-medium">Std: 99</span>
              </div>
              <Input
                id="vital-spo2"
                name="spo2"
                placeholder="99"
                value={vitals.spo2}
                onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))}
                className="bg-white"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {["99", "98", "97", "95"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVitals((v) => ({ ...v, spo2: val }))}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      vitals.spo2 === val ? "bg-blue-600 text-white border-blue-600 font-medium" : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clinical Findings & Diagnosis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chiefComplaints">Chief Complaints</Label>
            <Input
              id="chiefComplaints"
              name="chiefComplaints"
              placeholder="e.g. Fever, persistent cough x 3 days"
              defaultValue={initialData?.chiefComplaints || ""}
              list="complaints-list"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicalHistory">Clinical / Medical History</Label>
            <Input
              id="clinicalHistory"
              name="clinicalHistory"
              placeholder="e.g. Type 2 Diabetes, Hypertension, No known drug allergies"
              defaultValue={initialData?.clinicalHistory || ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input
              id="diagnosis"
              name="diagnosis"
              placeholder="e.g. Acute Upper Respiratory Tract Infection (URTI)"
              defaultValue={initialData?.diagnosis || ""}
              list="diagnosis-list"
            />
          </div>
        </CardContent>
      </Card>

      {/* Medications (Schedule and Duration / No. of Days dropdowns) */}
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pill className="w-5 h-5 text-blue-600" /> Medications (Rx)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Search drug library for 1-click auto-filling of strength, schedule, timing, and clinical instructions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLibraryModalOpen(true)}
              className="gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 bg-white shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Browse Drug Library
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addMedication} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Medicine
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {medications.map((med, index) => {
            const hasCustomDosage = !isKnownDosage(med.dosage);
            const hasCustomTiming = !isKnownTiming(med.timing);
            const hasCustomDuration = !isKnownDuration(med.duration);

            return (
              <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Drug Name: Prefix + Brand in bold + Generic below */}
                  <div className="md:col-span-4 space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800">Brand Name (in bold) *</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setLibrarySearchQuery(med.name || "");
                          setIsLibraryModalOpen(true);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 font-medium"
                      >
                        <Search className="w-2.5 h-2.5" /> Library
                      </button>
                    </div>

                    {/* Prefix selector + Brand Name in bold */}
                    <div className="flex rounded-md shadow-2xs">
                      <select
                        value={med.prefix || "Tab."}
                        onChange={(e) => updateMedicationField(index, "prefix", e.target.value)}
                        className="h-9 px-2 text-xs font-bold bg-slate-100 text-slate-800 border border-r-0 border-slate-300 rounded-l-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0 cursor-pointer"
                        title="Dosage Form Prefix (Tab., Cap., Inj., Syr., etc.)"
                      >
                        {MEDICATION_PREFIXES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      <Input
                        ref={(el) => {
                          drugNameInputRefs.current[index] = el;
                        }}
                        value={med.name}
                        onChange={(e) => {
                          updateMedicationField(index, "name", e.target.value);
                          setActiveSearchIndex(index);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setActiveSearchIndex(null);
                            if (index === medications.length - 1) {
                              pendingFocusIndex.current = medications.length;
                              setMedications((prev) => [
                                ...prev,
                                {
                                  prefix: "Tab.",
                                  name: "",
                                  genericName: "",
                                  strength: "",
                                  dosage: "1-0-1",
                                  timing: "After food",
                                  duration: "5 days",
                                  instruction: "",
                                },
                              ]);
                            } else {
                              drugNameInputRefs.current[index + 1]?.focus();
                            }
                          }
                        }}
                        onFocus={() => {
                          if (med.name.trim().length > 0) {
                            setActiveSearchIndex(index);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveSearchIndex((curr) => (curr === index ? null : curr));
                          }, 250);
                        }}
                        required
                        placeholder="Brand Name (e.g. Dolo 650, Augmentin 625)"
                        list="generic-drugs"
                        className="rounded-l-none font-bold text-slate-900 bg-white text-xs h-9 focus:z-10"
                      />
                    </div>

                    {/* Generic Name / Composition input directly below Brand Name */}
                    <div>
                      <Input
                        value={med.genericName || ""}
                        onChange={(e) => updateMedicationField(index, "genericName", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (index === medications.length - 1) {
                              pendingFocusIndex.current = medications.length;
                              setMedications((prev) => [
                                ...prev,
                                {
                                  prefix: "Tab.",
                                  name: "",
                                  genericName: "",
                                  strength: "",
                                  dosage: "1-0-1",
                                  timing: "After food",
                                  duration: "5 days",
                                  instruction: "",
                                },
                              ]);
                            } else {
                              drugNameInputRefs.current[index + 1]?.focus();
                            }
                          }
                        }}
                        placeholder="Generic composition (e.g. Paracetamol, Amoxicillin + Clavulanic Acid)"
                        className="text-[11px] text-slate-600 italic bg-white/80 border-slate-200 h-7"
                      />
                    </div>

                    {/* Real-time Drug Library Autocomplete Dropdown */}
                    {activeSearchIndex === index && med.name.trim().length >= 1 && (
                      <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-blue-200 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                        <div className="px-2.5 py-1 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-[10px] font-semibold text-blue-900">
                          <span>Formulary Matches</span>
                          <span className="text-blue-600 font-normal">Click to auto-fill</span>
                        </div>
                        {searchDrugs(med.name).slice(0, 8).map((drug) => (
                          <div
                            key={drug.id}
                            className="p-2 border-b border-slate-100 last:border-0 hover:bg-blue-50/80 cursor-pointer transition-colors"
                          >
                            <div
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectDrugForMedication(index, drug);
                              }}
                              className="flex items-center justify-between gap-1"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                                  {FORM_PREFIX_MAP[drug.form] || "Tab."}
                                </span>
                                <span className="text-xs font-bold text-slate-900">{drug.name}</span>
                              </div>
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                {drug.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Generic: <span className="text-slate-700 font-medium italic">{drug.genericName}</span>
                            </p>
                            {drug.brandNames.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px]">
                                <span className="text-slate-400 text-[10px] font-medium">Brands:</span>
                                {drug.brandNames.map((b) => (
                                  <button
                                    key={b}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectDrugForMedication(index, drug, b);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px] border border-blue-200 transition-colors"
                                  >
                                    {b}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium mt-1">
                              <span>Default: {drug.defaultStrength}</span>
                              <span>•</span>
                              <span>{drug.defaultDosage}</span>
                              <span>•</span>
                              <span>{drug.defaultTiming}</span>
                              <span>•</span>
                              <span>{drug.defaultDuration}</span>
                            </div>
                          </div>
                        ))}
                        {searchDrugs(med.name).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No exact formulary match. Custom entry will be saved.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Strength */}
                  <div className="md:col-span-1 space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Strength</Label>
                    <Input
                      value={med.strength}
                      onChange={(e) => updateMedicationField(index, "strength", e.target.value)}
                      placeholder="e.g. 650mg"
                      className="bg-white text-xs h-9"
                    />
                  </div>

                  {/* Schedule / Dosage Dropdown */}
                  <div className="md:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">Schedule (Dosage)</Label>
                      {hasCustomDosage && (
                        <span className="text-[10px] text-amber-600 font-medium">Custom</span>
                      )}
                    </div>
                    <select
                      value={hasCustomDosage ? "custom" : med.dosage}
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          updateMedicationField(index, "dosage", "");
                        } else {
                          updateMedicationField(index, "dosage", e.target.value);
                        }
                      }}
                      className="w-full h-9 px-2 text-xs border border-slate-300 rounded-md bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DOSAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="custom">✏️ Custom Schedule...</option>
                    </select>

                    {hasCustomDosage && (
                      <Input
                        value={med.dosage}
                        onChange={(e) => updateMedicationField(index, "dosage", e.target.value)}
                        placeholder="e.g. 2 tabs twice daily"
                        className="mt-1 text-xs h-8 bg-white border-amber-300 focus:border-blue-500"
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Timing Dropdown */}
                  <div className="md:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">Timing</Label>
                      {hasCustomTiming && (
                        <span className="text-[10px] text-amber-600 font-medium">Custom</span>
                      )}
                    </div>
                    <select
                      value={hasCustomTiming ? "custom" : med.timing}
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          updateMedicationField(index, "timing", "");
                        } else {
                          updateMedicationField(index, "timing", e.target.value);
                        }
                      }}
                      className="w-full h-9 px-2 text-xs border border-slate-300 rounded-md bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TIMING_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="custom">✏️ Custom Timing...</option>
                    </select>

                    {hasCustomTiming && (
                      <Input
                        value={med.timing}
                        onChange={(e) => updateMedicationField(index, "timing", e.target.value)}
                        placeholder="e.g. 30 mins before food"
                        className="mt-1 text-xs h-8 bg-white border-amber-300 focus:border-blue-500"
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Duration (No. of days) Dropdown */}
                  <div className="md:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">No. of Days</Label>
                      {hasCustomDuration && (
                        <span className="text-[10px] text-amber-600 font-medium">Custom</span>
                      )}
                    </div>
                    <select
                      value={hasCustomDuration ? "custom" : med.duration}
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          updateMedicationField(index, "duration", "");
                        } else {
                          updateMedicationField(index, "duration", e.target.value);
                        }
                      }}
                      className="w-full h-9 px-2 text-xs border border-slate-300 rounded-md bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="custom">✏️ Custom Days...</option>
                    </select>

                    {hasCustomDuration && (
                      <Input
                        value={med.duration}
                        onChange={(e) => updateMedicationField(index, "duration", e.target.value)}
                        placeholder="e.g. 4 days / 6 weeks"
                        className="mt-1 text-xs h-8 bg-white border-amber-300 focus:border-blue-500"
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Delete Button */}
                  <div className="md:col-span-1 flex items-end justify-center pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMedication(index)}
                      disabled={medications.length <= 1}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                      title="Remove medicine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <Input
                    value={med.instruction || ""}
                    onChange={(e) => updateMedicationField(index, "instruction", e.target.value)}
                    placeholder="Special instructions (optional: e.g. With warm water, SOS only if fever > 100°F)"
                    className="bg-white text-xs h-8 text-slate-700"
                  />
                </div>

                {/* Quick 1-Click Shortcut Chips */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="font-medium text-[11px]">Schedule:</span>
                    {COMMON_DOSAGES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateMedicationField(index, "dosage", d)}
                        className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                          med.dosage === d
                            ? "bg-blue-600 text-white font-medium shadow-xs"
                            : "bg-white border text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="font-medium text-[11px]">Timing:</span>
                    {COMMON_TIMINGS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateMedicationField(index, "timing", t)}
                        className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                          med.timing === t
                            ? "bg-emerald-600 text-white font-medium shadow-xs"
                            : "bg-white border text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="font-medium text-[11px]">Days:</span>
                    {COMMON_DURATIONS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => updateMedicationField(index, "duration", dur)}
                        className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                          med.duration === dur
                            ? "bg-purple-600 text-white font-medium shadow-xs"
                            : "bg-white border text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Clinical Advice, Investigations & Follow-up */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-blue-600" />
              Investigations &amp; Clinical Follow-up
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Order diagnostic blood tests, imaging panels, dietary advice, and review date.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLabModalOpen(true)}
            className="gap-1.5 text-xs text-blue-700 bg-blue-50/80 hover:bg-blue-100 border-blue-200 font-medium"
          >
            <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
            Browse Diagnostic Library
          </Button>
        </CardHeader>

        <CardContent className="pt-4 space-y-5">
          {/* Lab Tests & Diagnostic Ordering Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="labTests" className="text-sm font-semibold text-slate-900">
                  Recommended Investigations / Lab Tests
                </Label>
                {parsedCurrentTests.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {parsedCurrentTests.length} ordered
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {labTests && (
                  <button
                    type="button"
                    onClick={() => setLabTests("")}
                    className="text-xs text-rose-600 hover:text-rose-800 underline font-medium"
                  >
                    Clear tests
                  </button>
                )}
              </div>
            </div>

            {/* Quick 1-Click Popular Panels & Bundles */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Quick Diagnostic Bundles (1-Click Add):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "Diabetic Panel", tests: ["Fasting Blood Sugar (FBS)", "Post-Prandial Blood Sugar (PPBS)", "HbA1c (Glycated Hemoglobin)", "Serum Creatinine"], icon: "🧪" },
                  { name: "Acute Fever Workup", tests: ["Complete Blood Count (CBC) with Platelets", "Malarial Parasite (Smear / Rapid Card)", "Dengue NS1 Antigen & IgM", "Widal Slide Agglutination Test", "Urine Routine & Microscopy"], icon: "🌡️" },
                  { name: "Hypertension Workup", tests: ["Fasting Lipid Profile", "Serum Creatinine", "Serum Electrolytes (Na+, K+, Cl-)", "12-Lead Electrocardiogram (ECG)"], icon: "🩺" },
                  { name: "CBC with Platelets", tests: ["Complete Blood Count (CBC) with Platelets"], icon: "🩸" },
                  { name: "Lipid Profile (Full)", tests: ["Lipid Profile (Full)"], icon: "🫀" },
                  { name: "Thyroid Profile (T3, T4, TSH)", tests: ["Thyroid Profile (T3, T4, TSH)"], icon: "🦋" },
                  { name: "Liver Function (LFT)", tests: ["Liver Function Tests (LFT Complete)"], icon: "🔬" },
                  { name: "Kidney Function (KFT)", tests: ["Kidney Function Tests (KFT / RFT)"], icon: "🫘" },
                  { name: "Urine Routine & Microscopy", tests: ["Urine Routine & Microscopy"], icon: "🧪" },
                  { name: "Chest X-Ray (PA View)", tests: ["Chest X-Ray (PA View)"], icon: "🩻" },
                ].map((quick) => {
                  const isAllAdded = quick.tests.every((t) => currentTestsSet.has(t.toLowerCase()));
                  return (
                    <button
                      key={quick.name}
                      type="button"
                      onClick={() => {
                        if (isAllAdded) {
                          const testsToRemove = new Set(quick.tests.map((t) => t.toLowerCase()));
                          const remaining = parsedCurrentTests.filter((t) => !testsToRemove.has(t.toLowerCase()));
                          setLabTests(remaining.join(", "));
                        } else {
                          const updated = appendLabTests(labTests, quick.tests);
                          setLabTests(updated);
                          toast.show({
                            title: `${quick.name} Added`,
                            description: `Added ${quick.tests.length} tests to prescription.`,
                            type: "success",
                          });
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        isAllAdded
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-semibold"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                      }`}
                    >
                      <span>{quick.icon}</span>
                      <span>{quick.name}</span>
                      {isAllAdded ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="text-slate-400 text-[10px]">+</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Ordered Tests Chips */}
            {parsedCurrentTests.length > 0 && (
              <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-lg space-y-1.5">
                <span className="text-[11px] font-semibold text-blue-900 block">
                  Prescribed Investigations ({parsedCurrentTests.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {parsedCurrentTests.map((testName, i) => (
                    <span
                      key={`${testName}-${i}`}
                      className="inline-flex items-center gap-1.5 bg-white border border-blue-200 text-blue-950 px-2.5 py-1 rounded-md text-xs shadow-2xs group"
                    >
                      <TestTube className="w-3 h-3 text-blue-500" />
                      <span className="font-medium">{testName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLabTest(testName)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors ml-0.5"
                        title={`Remove ${testName}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Input / Manual Editor */}
            <div>
              <Input
                id="labTests"
                name="labTests"
                value={labTests}
                onChange={(e) => setLabTests(e.target.value)}
                placeholder="Type or edit comma-separated test names (e.g. Complete Blood Count, Urine Routine, HbA1c)..."
                className="text-sm font-mono text-slate-800"
                list="lab-tests-list"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Tip: Click quick bundles above or browse the diagnostic library to auto-fill; you can also type custom tests directly separated by commas.
              </p>
            </div>
          </div>

          {/* Advice & Follow-up in 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div className="space-y-2">
              <Label htmlFor="advice" className="text-sm font-semibold text-slate-900">
                Dietary Advice / Precautions
              </Label>
              <Input
                id="advice"
                name="advice"
                placeholder="e.g. Low salt diet, plenty of fluids, avoid cold drinks"
                defaultValue={initialData?.advice || ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="followUpDate" className="text-sm font-semibold text-slate-900">
                  Follow-up Review Date
                </Label>
                <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                  {[
                    { label: "+3d", days: 3 },
                    { label: "+5d", days: 5 },
                    { label: "+7d", days: 7 },
                    { label: "+15d", days: 15 },
                    { label: "+1mo", days: 30 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const target = new Date();
                        target.setDate(target.getDate() + preset.days);
                        const yyyy = target.getFullYear();
                        const mm = String(target.getMonth() + 1).padStart(2, "0");
                        const dd = String(target.getDate()).padStart(2, "0");
                        const dateStr = `${yyyy}-${mm}-${dd}`;
                        const input = document.getElementById("followUpDate") as HTMLInputElement;
                        if (input) input.value = dateStr;
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 transition-colors"
                      title={`Set follow-up in ${preset.days} days`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                id="followUpDate"
                name="followUpDate"
                type="date"
                defaultValue={initialData?.followUpDate || ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full h-12 text-base font-semibold" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {isEditMode ? "Updating Prescription..." : "Generating Prescription..."}
          </>
        ) : isEditMode ? (
          <>
            <Save className="w-5 h-5 mr-2" /> Save Changes
          </>
        ) : (
          "Save & Generate Prescription"
        )}
      </Button>

      {/* Searchable Clinical Drug Library Modal */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">OPD Clinical Drug Library & Formulary</h3>
                  <p className="text-xs text-slate-500">
                    Search by generic or brand name. 1-click &quot;+ Add to Prescription&quot; to auto-fill schedules.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsLibraryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Search Input & Category Pills */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Search medications (e.g. Paracetamol, Dolo, Augmentin, Pantocid, Telma, Metformin)..."
                  className="pl-9 h-10 text-sm bg-slate-50 focus:bg-white"
                  autoFocus
                />
                {librarySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLibrarySearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {DRUG_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors font-medium ${
                      selectedCategory === cat
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Drug Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 space-y-3">
              {(() => {
                const results = searchDrugs(librarySearchQuery, selectedCategory);
                if (results.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-sm">No drugs found matching &ldquo;{librarySearchQuery}&rdquo;</p>
                      <p className="text-xs mt-1">Try another search term or browse different categories above.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {results.map((drug) => (
                      <div
                        key={drug.id}
                        className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{drug.name}</h4>
                              <p className="text-xs text-slate-500 font-medium">{drug.genericName}</p>
                            </div>
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200 shrink-0">
                              {drug.category}
                            </span>
                          </div>

                          {drug.brandNames.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 text-[11px]">
                              <span className="font-medium text-slate-500">Brands:</span>
                              {drug.brandNames.map((b) => (
                                <button
                                  key={b}
                                  type="button"
                                  onClick={() => {
                                    addDrugFromLibrary(drug, b);
                                    setIsLibraryModalOpen(false);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px] border border-blue-200 transition-colors"
                                  title={`Add as ${b}`}
                                >
                                  + {b}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1 text-[11px] pt-1">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                              Strength: {drug.defaultStrength}
                            </span>
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                              Schedule: {drug.defaultDosage}
                            </span>
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {drug.defaultTiming}
                            </span>
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {drug.defaultDuration}
                            </span>
                          </div>

                          {drug.defaultInstruction && (
                            <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-2">
                              &ldquo;{drug.defaultInstruction}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {FORM_PREFIX_MAP[drug.form] || "Tab."} {drug.form}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              addDrugFromLibrary(drug);
                              setIsLibraryModalOpen(false);
                            }}
                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1 shadow-2xs font-semibold"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add to Rx
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
              <span>{searchDrugs(librarySearchQuery, selectedCategory).length} formulary drugs found</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsLibraryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Diagnostic & Lab Investigation Library Modal */}
      {isLabModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">OPD Diagnostic &amp; Laboratory Library</h3>
                  <p className="text-xs text-slate-500">
                    Search evidence-based panels, profiles, and individual tests. 1-click &quot;+ Add to Prescription&quot; to include.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsLabModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Search Input & Category Pills */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={labSearchQuery}
                  onChange={(e) => setLabSearchQuery(e.target.value)}
                  placeholder="Search tests or panels (e.g. CBC, HbA1c, LFT, Creatinine, Dengue, Thyroid, X-Ray, Lipid)..."
                  className="pl-9 h-10 text-sm bg-slate-50 focus:bg-white"
                  autoFocus
                />
                {labSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLabSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {LAB_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedLabCategory(cat)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors font-medium ${
                      selectedLabCategory === cat
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 space-y-6">
              {(() => {
                const results = searchLabLibrary(labSearchQuery, selectedLabCategory);
                const hasPanels = results.panels.length > 0;
                const hasTests = results.tests.length > 0;

                if (!hasPanels && !hasTests) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-sm">No investigations found matching &ldquo;{labSearchQuery}&rdquo;</p>
                      <p className="text-xs mt-1">Try another search term or browse the category filters above.</p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Section 1: Pre-configured Diagnostic Panels & Bundles */}
                    {hasPanels && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <TestTubes className="w-4 h-4 text-blue-600" />
                            Diagnostic Panels &amp; Workup Bundles ({results.panels.length})
                          </h4>
                          <span className="text-[11px] text-slate-400">Includes complete test panel</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {results.panels.map((panel) => {
                            const isAllIn = panel.tests.every((t) => currentTestsSet.has(t.toLowerCase()));
                            const someIn = !isAllIn && panel.tests.some((t) => currentTestsSet.has(t.toLowerCase()));

                            return (
                              <div
                                key={panel.id}
                                className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between gap-3"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h5 className="font-bold text-slate-900 text-sm">{panel.name}</h5>
                                      <p className="text-xs text-slate-500 mt-0.5">{panel.description}</p>
                                    </div>
                                    {panel.badge && (
                                      <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200 shrink-0">
                                        {panel.badge}
                                      </span>
                                    )}
                                  </div>

                                  {/* List of included tests */}
                                  <div className="space-y-1 pt-1 border-t border-slate-100">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                      Included tests ({panel.tests.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {panel.tests.map((testName) => {
                                        const isSingleAdded = currentTestsSet.has(testName.toLowerCase());
                                        return (
                                          <button
                                            key={testName}
                                            type="button"
                                            onClick={() => {
                                              if (isSingleAdded) {
                                                handleRemoveLabTest(testName);
                                              } else {
                                                handleAddLabTest(testName);
                                              }
                                            }}
                                            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                              isSingleAdded
                                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-medium"
                                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                                            }`}
                                            title={isSingleAdded ? "Click to remove this test" : "Click to add this test individually"}
                                          >
                                            {isSingleAdded && "✓ "}
                                            {testName}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {panel.category}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isAllIn ? "outline" : "default"}
                                    onClick={() => {
                                      if (isAllIn) {
                                        const toRemove = new Set(panel.tests.map((t) => t.toLowerCase()));
                                        const remaining = parsedCurrentTests.filter((t) => !toRemove.has(t.toLowerCase()));
                                        setLabTests(remaining.join(", "));
                                      } else {
                                        handleAddLabPanel(panel);
                                      }
                                    }}
                                    className={`h-7 px-3 text-xs gap-1.5 ${
                                      isAllIn
                                        ? "text-emerald-700 border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                    }`}
                                  >
                                    {isAllIn ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Entire Panel Added
                                      </>
                                    ) : someIn ? (
                                      <>
                                        <Plus className="w-3.5 h-3.5" /> Add Remaining ({panel.tests.filter((t) => !currentTestsSet.has(t.toLowerCase())).length})
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" /> Add Entire Panel
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 2: Individual Tests & Diagnostic Investigations */}
                    {hasTests && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <TestTube className="w-4 h-4 text-emerald-600" />
                            Individual Diagnostic Tests ({results.tests.length})
                          </h4>
                          <span className="text-[11px] text-slate-400">Single parameter tests</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {results.tests.map((test) => {
                            const isAdded = currentTestsSet.has(test.name.toLowerCase());
                            return (
                              <div
                                key={test.id}
                                className={`bg-white border rounded-lg p-3 shadow-2xs transition-all flex flex-col justify-between gap-2.5 ${
                                  isAdded ? "border-emerald-300 bg-emerald-50/20" : "border-slate-200 hover:border-blue-300"
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <h6 className="font-semibold text-slate-900 text-xs leading-snug">{test.name}</h6>
                                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                                      {test.category}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                                    {test.sampleType && (
                                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                        {test.sampleType}
                                      </span>
                                    )}
                                    {test.fastingRequired && (
                                      <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                        Fasting Req.
                                      </span>
                                    )}
                                  </div>
                                  {test.commonIndications && (
                                    <p className="text-[10px] text-slate-400 line-clamp-1 italic">
                                      {test.commonIndications}
                                    </p>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isAdded ? "outline" : "ghost"}
                                    onClick={() => {
                                      if (isAdded) {
                                        handleRemoveLabTest(test.name);
                                      } else {
                                        handleAddLabTest(test.name);
                                      }
                                    }}
                                    className={`h-6 px-2.5 text-[11px] gap-1 ${
                                      isAdded
                                        ? "text-emerald-700 border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-medium"
                                        : "text-blue-700 hover:bg-blue-50 font-medium"
                                    }`}
                                  >
                                    {isAdded ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600" /> Added
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3 h-3" /> Add Test
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>
                  Currently prescribed: <strong>{parsedCurrentTests.length} investigations</strong>
                </span>
                {parsedCurrentTests.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLabTests("")}
                    className="text-rose-600 hover:underline font-medium ml-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <Button type="button" size="sm" onClick={() => setIsLabModalOpen(false)}>
                Done / Return to Form
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Datalists for autocompletion */}
      <datalist id="generic-drugs">
        {DRUG_LIBRARY.map((d) => (
          <option key={d.id} value={d.name} label={`${d.category} (${d.brandNames.join(", ")})`} />
        ))}
      </datalist>

      <datalist id="lab-tests-list">
        {INDIVIDUAL_LAB_TESTS.map((t) => (
          <option key={t.id} value={t.name} label={t.category} />
        ))}
      </datalist>

      <datalist id="timing-list">
        <option value="After food" />
        <option value="Before food" />
        <option value="With food" />
        <option value="At bedtime" />
        <option value="Empty stomach" />
        <option value="As needed (SOS)" />
      </datalist>

      <datalist id="complaints-list">
        <option value="Fever and chills" />
        <option value="Dry cough and sore throat" />
        <option value="Productive cough" />
        <option value="Abdominal pain and nausea" />
        <option value="Headache and dizziness" />
        <option value="Joint pain and swelling" />
        <option value="Weakness and fatigue" />
        <option value="Shortness of breath" />
      </datalist>

      <datalist id="diagnosis-list">
        <option value="Upper Respiratory Tract Infection (URTI)" />
        <option value="Acute Gastroenteritis" />
        <option value="Essential Hypertension" />
        <option value="Type 2 Diabetes Mellitus" />
        <option value="Allergic Rhinitis" />
        <option value="Migraine" />
        <option value="Viral Pyrexia" />
        <option value="Urinary Tract Infection (UTI)" />
        <option value="Osteoarthritis" />
      </datalist>
    </form>
  );
}
