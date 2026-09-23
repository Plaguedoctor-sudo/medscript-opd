'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPrescription, updatePrescription, searchPatients, getPatientById } from "./actions";
import { Plus, Trash2, Search, User, X, Save, Loader2, Pill } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Medication, Patient, Prescription } from "@/types";

interface FormProps {
  initialPatientId?: string;
  initialData?: (Prescription & { patient?: Patient }) | null;
}

const COMMON_DOSAGES = ["1-0-1", "1-1-1", "1-0-0", "0-0-1", "0-1-0", "1-0-1-1", "SOS"];
const COMMON_TIMINGS = ["After food", "Before food", "With food", "At bedtime", "Empty stomach"];
const COMMON_DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month"];

export default function NewPrescriptionForm({ initialPatientId, initialData }: FormProps) {
  const router = useRouter();

  const [medications, setMedications] = useState<Medication[]>(() => {
    if (initialData?.medications) {
      try {
        const parsed = JSON.parse(initialData.medications);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return [{ name: "", strength: "", dosage: "1-0-1", timing: "After food", duration: "5 days" }];
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialData?.patient || null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const addMedication = () => {
    setMedications([
      ...medications,
      { name: "", strength: "", dosage: "1-0-1", timing: "After food", duration: "5 days" },
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
        weight: formData.get("weight") as string,
        bp: formData.get("bp") as string,
        pulse: formData.get("pulse") as string,
        temp: formData.get("temp") as string,
        spo2: formData.get("spo2") as string,
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

  const isEditMode = !!initialData?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditMode ? "Edit Prescription" : "New Consultation"}
          </h1>
          <p className="text-sm text-slate-500">
            {isEditMode
              ? "Modify clinical notes, vitals, or prescribed medications."
              : "Record patient complaints, vitals, and issue a digital prescription."}
          </p>
        </div>
        {isEditMode && (
          <div className="text-sm text-slate-600 bg-slate-100 border px-3 py-1.5 rounded-full font-medium">
            Prescription ID: #{initialData.id}
          </div>
        )}
      </div>

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
                      <div className="font-semibold text-slate-900">{p.name}</div>
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
                <div className="font-bold text-slate-900">Patient: {selectedPatient.name}</div>
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

      {/* Vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vital Signs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Weight (kg)</Label>
            <Input name="weight" placeholder="e.g. 68" defaultValue={initialData?.weight || ""} />
          </div>
          <div className="space-y-2">
            <Label>BP (mmHg)</Label>
            <Input name="bp" placeholder="e.g. 120/80" defaultValue={initialData?.bp || ""} />
          </div>
          <div className="space-y-2">
            <Label>Pulse (bpm)</Label>
            <Input name="pulse" placeholder="e.g. 76" defaultValue={initialData?.pulse || ""} />
          </div>
          <div className="space-y-2">
            <Label>Temp (°F)</Label>
            <Input name="temp" placeholder="e.g. 98.6" defaultValue={initialData?.temp || ""} />
          </div>
          <div className="space-y-2">
            <Label>SPO2 (%)</Label>
            <Input name="spo2" placeholder="e.g. 99" defaultValue={initialData?.spo2 || ""} />
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

      {/* Medications */}
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pill className="w-5 h-5 text-blue-600" /> Medications (Rx)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Add generic medicines, strength, dosage frequency, and duration.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addMedication}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Medicine
          </Button>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {medications.map((med, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Generic Drug / Brand *</Label>
                  <Input
                    value={med.name}
                    onChange={(e) => updateMedicationField(index, "name", e.target.value)}
                    required
                    placeholder="e.g. Paracetamol"
                    list="generic-drugs"
                    className="bg-white"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Strength</Label>
                  <Input
                    value={med.strength}
                    onChange={(e) => updateMedicationField(index, "strength", e.target.value)}
                    placeholder="e.g. 650mg"
                    className="bg-white"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Dosage</Label>
                  <Input
                    value={med.dosage}
                    onChange={(e) => updateMedicationField(index, "dosage", e.target.value)}
                    placeholder="e.g. 1-0-1"
                    className="bg-white"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Timing</Label>
                  <Input
                    value={med.timing}
                    onChange={(e) => updateMedicationField(index, "timing", e.target.value)}
                    placeholder="e.g. After food"
                    list="timing-list"
                    className="bg-white"
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Duration</Label>
                  <Input
                    value={med.duration}
                    onChange={(e) => updateMedicationField(index, "duration", e.target.value)}
                    placeholder="e.g. 5 days"
                    className="bg-white"
                  />
                </div>
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

              {/* Quick shortcut chips for dosage, timing, duration */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1 border-t border-slate-200">
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="font-medium">Dosage:</span>
                  {COMMON_DOSAGES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => updateMedicationField(index, "dosage", d)}
                      className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                        med.dosage === d ? "bg-blue-600 text-white font-medium" : "bg-white border text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="font-medium">Timing:</span>
                  {COMMON_TIMINGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateMedicationField(index, "timing", t)}
                      className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                        med.timing === t ? "bg-emerald-600 text-white font-medium" : "bg-white border text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="font-medium">Duration:</span>
                  {COMMON_DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => updateMedicationField(index, "duration", dur)}
                      className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                        med.duration === dur ? "bg-purple-600 text-white font-medium" : "bg-white border text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Advice & Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advice, Investigations & Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="advice">Dietary Advice / Precautions</Label>
            <Input
              id="advice"
              name="advice"
              placeholder="e.g. Drink plenty of fluids, avoid cold foods"
              defaultValue={initialData?.advice || ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="labTests">Lab Tests / Investigations</Label>
            <Input
              id="labTests"
              name="labTests"
              placeholder="e.g. Complete Blood Count (CBC), Urine Routine"
              defaultValue={initialData?.labTests || ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <Input
              id="followUpDate"
              name="followUpDate"
              type="date"
              defaultValue={initialData?.followUpDate || ""}
            />
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

      {/* Datalists for autocompletion */}
      <datalist id="generic-drugs">
        <option value="Paracetamol" />
        <option value="Amoxicillin" />
        <option value="Amoxicillin + Clavulanic Acid" />
        <option value="Metformin" />
        <option value="Atorvastatin" />
        <option value="Amlodipine" />
        <option value="Azithromycin" />
        <option value="Cetirizine" />
        <option value="Levocetirizine" />
        <option value="Montelukast" />
        <option value="Pantoprazole" />
        <option value="Omeprazole" />
        <option value="Rabeprazole" />
        <option value="Diclofenac" />
        <option value="Ibuprofen" />
        <option value="Aceclofenac + Paracetamol" />
        <option value="Ciprofloxacin" />
        <option value="Ofloxacin" />
        <option value="Telmisartan" />
        <option value="Glimepiride" />
        <option value="Salbutamol" />
        <option value="Dextromethorphan" />
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
