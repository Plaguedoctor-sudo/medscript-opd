'use client'

import { useState } from "react";
import Link from "next/link";
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
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  IpdAdmissionWithPatient,
  IpdRound,
  IpdVitals,
  LabReportWithPatient,
  IpdDischargeCondition,
  ClinicSettings,
  LabResultParameter,
  EmarRecord,
  ClinicalConsent,
  IpdDeposit,
  FluidBalanceRecord,
} from "@/types";
import { addIpdRound, deleteIpdRound, dischargeIpdPatient } from "../actions";
import { LabEntryModal } from "@/app/labs/LabEntryModal";
import {
  Bed,
  ArrowLeft,
  Clock,
  PlusCircle,
  Printer,
  Receipt,
  FlaskConical,
  CheckCircle2,
  Stethoscope,
  Trash2,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Droplets,
  FileText,
} from "lucide-react";
import { NurseEmarSection } from "@/components/ipd/NurseEmarSection";
import { ClinicalConsentsSection } from "@/components/ipd/ClinicalConsentsSection";
import { IpdDepositsSection } from "@/components/ipd/IpdDepositsSection";
import { InputOutputChartSection } from "@/components/ipd/InputOutputChartSection";
import { IpdDischargeModal } from "@/components/ipd/IpdDischargeModal";
import { IpdNursingNotesSection } from "@/components/ipd/IpdNursingNotesSection";
import { IpdNursingServicesSection } from "@/components/ipd/IpdNursingServicesSection";
import { IpdHandoverSection } from "@/components/ipd/IpdHandoverSection";
import { IpdBillingSection } from "@/components/ipd/IpdBillingSection";
import { IpdDischarge, IpdNursingNote, IpdHandover, IpdClinicalService, Invoice } from "@/types";

interface IpdCaseSheetProps {
  admission: IpdAdmissionWithPatient;
  rounds: IpdRound[];
  labReportsList: LabReportWithPatient[];
  emarRecords?: EmarRecord[];
  consents?: ClinicalConsent[];
  deposits?: IpdDeposit[];
  fluidBalanceRecords?: FluidBalanceRecord[];
  handovers?: IpdHandover[];
  clinicalServices?: IpdClinicalService[];
  settings: ClinicSettings | null;
  userRole?: string;
  currentStaffName?: string;
  existingDischarge?: IpdDischarge | null;
  nursingNotes?: IpdNursingNote[];
  existingInvoice?: Invoice | null;
}

export function IpdCaseSheet({
  admission,
  rounds,
  labReportsList,
  emarRecords = [],
  consents = [],
  deposits = [],
  fluidBalanceRecords = [],
  handovers = [],
  clinicalServices = [],
  settings,
  userRole,
  currentStaffName,
  existingDischarge,
  nursingNotes = [],
  existingInvoice,
}: IpdCaseSheetProps) {
  const router = useRouter();

  // Round modal state
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [isAddingRound, setIsAddingRound] = useState(false);
  const [roundNotes, setRoundNotes] = useState("");
  const [treatmentOrders, setTreatmentOrders] = useState("");
  const [roundDoctor, setRoundDoctor] = useState(settings?.doctorName || "");
  const [roundRole, setRoundRole] = useState<"DOCTOR" | "NURSE">("DOCTOR");
  const [roundDateTime, setRoundDateTime] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [roundVitals, setRoundVitals] = useState<IpdVitals>({
    bp: "",
    pulse: "",
    temp: "",
    spo2: "",
    weight: "",
    rbs: "",
  });

  // Discharge modal state
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [dischargeCondition, setDischargeCondition] = useState<IpdDischargeCondition>("Recovered");
  const [dischargeSummary, setDischargeSummary] = useState(
    `Patient responded well to inpatient medical management. Vitals stable. Tolerating oral diet. Discharged in stable condition.`
  );
  const [dischargeAdvice, setDischargeAdvice] = useState(
    "1. Continue prescribed oral medications.\n2. Review in OPD after 5 days or SOS in case of emergency.\n3. Adequate hydration & light diet."
  );

  let initialVitals: IpdVitals = {};
  try {
    initialVitals = JSON.parse(admission.admissionVitals || "{}");
  } catch {
    initialVitals = {};
  }

  const isAdmitted = admission.status === "ADMITTED";

  // Role-derived capability flags (client-side UI gating)
  const isDoctor = userRole === 'admin_doctor' || userRole === 'doctor';
  const isNurseOrAbove = isDoctor || userRole === 'nurse';
  const canDischarge = isDoctor; // Only doctors can discharge
  const canOrderLab = isDoctor; // Only doctors can order labs (nurses cannot order labs)
  const canAddClinicalRound = isNurseOrAbove; // Nurses add nursing notes; doctors add rounds
  const canViewBilling = isDoctor || userRole === 'receptionist';

  const calculateDays = (admissionDate: Date, dischargeDate?: Date | null) => {
    const start = new Date(admissionDate).getTime();
    const end = dischargeDate ? new Date(dischargeDate).getTime() : new Date().getTime();
    const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    return diff;
  };

  const daysAdmitted = calculateDays(admission.admissionDate, admission.dischargeDate);

  const handleAddRoundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundNotes.trim()) {
      toast.show({
        title: "Notes Required",
        description: "Please enter clinical observations.",
        type: "error",
      });
      return;
    }

    setIsAddingRound(true);
    try {
      const res = await addIpdRound(admission.id, {
        roundDate: roundDateTime ? new Date(roundDateTime) : new Date(),
        notes: roundNotes,
        treatmentOrders,
        doctorOrStaff: roundDoctor,
        role: roundRole,
        vitals: roundVitals,
      });

      if (res.success) {
        toast.show({
          title: "Round Recorded",
          description: "Clinical progress note has been added.",
          type: "success",
        });
        setRoundModalOpen(false);
        setRoundNotes("");
        setTreatmentOrders("");
        router.refresh();
      } else {
        toast.show({
          title: "Error",
          description: res.error || "Failed to record round.",
          type: "error",
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add round.",
        type: "error",
      });
    } finally {
      setIsAddingRound(false);
    }
  };

  const handleDeleteRound = async (roundId: number) => {
    if (!confirm("Are you sure you want to delete this clinical progress note?")) return;
    try {
      const res = await deleteIpdRound(roundId);
      if (res.success) {
        toast.show({ title: "Round Removed", description: "Progress note deleted.", type: "info" });
        router.refresh();
      }
    } catch {
      // ignore
    }
  };

  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDischarging(true);
    try {
      const res = await dischargeIpdPatient(admission.id, {
        dischargeCondition,
        dischargeSummary,
        dischargeAdvice,
      });

      if (res.success) {
        toast.show({
          title: "Patient Discharged",
          description: `Discharge summary generated for ${admission.patient.name}.`,
          type: "success",
        });
        setDischargeModalOpen(false);
        router.refresh();
      } else {
        toast.show({
          title: "Error",
          description: res.error || "Could not complete discharge.",
          type: "error",
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to discharge.",
        type: "error",
      });
    } finally {
      setIsDischarging(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar (hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <Link href="/ipd">
            <Button variant="ghost" size="sm" className="gap-1 text-slate-600">
              <ArrowLeft className="w-4 h-4" /> IPD Census
            </Button>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href={`/patient/${admission.patientId}`}>
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800">
              Patient Profile
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Order Lab Investigation Modal — doctor and above only (nurses cannot order labs) */}
          {canOrderLab && (
            <LabEntryModal
              initialPatient={admission.patient}
              initialPatientId={admission.patientId}
              ipdAdmissionId={admission.id}
              triggerButton={
                <Button variant="outline" size="sm" className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <FlaskConical className="w-4 h-4 text-indigo-600" /> Order Lab Test
                </Button>
              }
            />
          )}

          {/* Record Clinical Round Button — nurse and above */}
          {isAdmitted && canAddClinicalRound && (
            <Dialog open={roundModalOpen} onOpenChange={setRoundModalOpen}>
              <DialogTrigger render={<Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" />}>
                <PlusCircle className="w-4 h-4" /> Doctor Round / Note
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleAddRoundSubmit}>
                  <DialogHeader>
                    <DialogTitle>Add Clinical Round / Progress Note</DialogTitle>
                    <DialogDescription>
                      Record daily clinical assessment, vitals, and inpatient treatment orders.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Clinician / Observer</Label>
                        <Input
                          value={roundDoctor}
                          onChange={(e) => setRoundDoctor(e.target.value)}
                          placeholder="Dr. Name or Nurse"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Role</Label>
                        <select
                          value={roundRole}
                          onChange={(e) => setRoundRole(e.target.value as "DOCTOR" | "NURSE")}
                          className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs"
                        >
                          <option value="DOCTOR">Doctor (Consultant Round)</option>
                          <option value="NURSE">Staff Nurse (Ward Note)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" /> Date & Exact Time of Assessment *
                      </Label>
                      <Input
                        type="datetime-local"
                        value={roundDateTime}
                        onChange={(e) => setRoundDateTime(e.target.value)}
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Clinical Findings / Progress Note *</Label>
                      <textarea
                        value={roundNotes}
                        onChange={(e) => setRoundNotes(e.target.value)}
                        placeholder="e.g. Patient afebrile today. Pain decreased. Chest clear, abdomen soft, bowel sounds present."
                        rows={3}
                        required
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Treatment & Medication Orders</Label>
                      <textarea
                        value={treatmentOrders}
                        onChange={(e) => setTreatmentOrders(e.target.value)}
                        placeholder="e.g. Continue IV Ceftriaxone 1g BD, Tab Paracetamol 650mg SOS, IV fluids RL @ 75ml/hr."
                        rows={2}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Vitals in Round */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-slate-700 block uppercase">
                        Current Vitals during Round
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block">BP</span>
                          <Input
                            value={roundVitals.bp}
                            onChange={(e) => setRoundVitals({ ...roundVitals, bp: e.target.value })}
                            placeholder="120/80"
                            className="h-7 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Pulse</span>
                          <Input
                            value={roundVitals.pulse}
                            onChange={(e) => setRoundVitals({ ...roundVitals, pulse: e.target.value })}
                            placeholder="74"
                            className="h-7 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Temp</span>
                          <Input
                            value={roundVitals.temp}
                            onChange={(e) => setRoundVitals({ ...roundVitals, temp: e.target.value })}
                            placeholder="37.0"
                            className="h-7 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">SpO2</span>
                          <Input
                            value={roundVitals.spo2}
                            onChange={(e) => setRoundVitals({ ...roundVitals, spo2: e.target.value })}
                            placeholder="99%"
                            className="h-7 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Weight</span>
                          <Input
                            value={roundVitals.weight}
                            onChange={(e) => setRoundVitals({ ...roundVitals, weight: e.target.value })}
                            placeholder="kg"
                            className="h-7 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">RBS</span>
                          <Input
                            value={roundVitals.rbs}
                            onChange={(e) => setRoundVitals({ ...roundVitals, rbs: e.target.value })}
                            placeholder="mg/dL"
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
                      disabled={isAddingRound}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isAddingRound ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Round Note"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Discharge Patient — Doctors only */}
          {canDischarge && (isAdmitted ? (
            <Dialog open={dischargeModalOpen} onOpenChange={setDischargeModalOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50" />}>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Discharge Patient
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleDischargeSubmit}>
                  <DialogHeader>
                    <DialogTitle>Discharge Inpatient & Generate Summary</DialogTitle>
                    <DialogDescription>
                      Record patient discharge condition, hospital course summary, and take-home advice.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Condition at Discharge *</Label>
                      <select
                        value={dischargeCondition}
                        onChange={(e) => setDischargeCondition(e.target.value as IpdDischargeCondition)}
                        className="w-full h-9 px-2.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-900"
                      >
                        <option value="Recovered">Recovered / Clinically Improved</option>
                        <option value="Stable">Stable</option>
                        <option value="Referred">Referred to Higher Center</option>
                        <option value="LAMA">LAMA (Left Against Medical Advice)</option>
                        <option value="Deceased">Deceased</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Hospital Course & Clinical Summary *</Label>
                      <textarea
                        value={dischargeSummary}
                        onChange={(e) => setDischargeSummary(e.target.value)}
                        rows={4}
                        required
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Discharge Advice & Follow-up Instructions *</Label>
                      <textarea
                        value={dischargeAdvice}
                        onChange={(e) => setDischargeAdvice(e.target.value)}
                        rows={3}
                        required
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <DialogFooter className="flex items-center justify-between gap-2 pt-2">
                    <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                      Cancel
                    </DialogClose>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isDischarging}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      {isDischarging ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Discharge"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md border border-slate-200">
              Discharged on {admission.dischargeDate ? formatDate(admission.dischargeDate) : "N/A"}
            </span>
          ))}

          {/* Formal Discharge Summary Modal — doctors only */}
          {canDischarge && (
            <IpdDischargeModal
              admission={admission}
              existingDischarge={existingDischarge}
              settings={settings}
            />
          )}

          {/* 1-Click Bill IPD Stay — doctors + receptionist */}
          {canViewBilling && (
            existingInvoice ? (
              <Link href={`/billing/${existingInvoice.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold">
                  <Receipt className="w-4 h-4 text-emerald-600" /> View Bill ({existingInvoice.invoiceNo})
                </Button>
              </Link>
            ) : (
              <Link href={`/billing?patientId=${admission.patientId}&admissionId=${admission.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 font-medium">
                  <Receipt className="w-4 h-4 text-blue-600" /> Bill Inpatient Stay
                </Button>
              </Link>
            )
          )}

          {/* Print Button */}
          <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-slate-900 hover:bg-black text-white shadow-xs">
            <Printer className="w-4 h-4" /> Print Case Sheet
          </Button>
        </div>
      </div>

      {/* Main Printable Inpatient Case Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 text-slate-800">
        {/* Hospital Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
              <Bed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {settings?.clinicName || "MEDSCRIPT HOSPITAL & CLINICAL CARE"}
              </h1>
              <p className="text-xs font-semibold text-purple-700 mt-0.5">
                Inpatient Department (IPD) • Case Sheet & Clinical Chart
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {settings?.address || "Clinical Care Center"} • Contact: {settings?.contact || "N/A"}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="font-mono text-xs font-bold text-purple-900 bg-purple-50 border border-purple-200 px-3 py-1 rounded-md inline-block">
              {admission.admissionNo}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-semibold">
              Ward: <span className="text-slate-900">{admission.ward}</span>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              Bed: <span className="text-purple-700 font-bold">{admission.bedNo}</span>
            </div>
          </div>
        </div>

        {/* Patient Demographics & Admission Summary */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-400 block font-medium">PATIENT NAME</span>
            <span className="font-bold text-slate-900 text-sm">{admission.patient.name}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">AGE / GENDER</span>
            <span className="font-semibold text-slate-800">
              {admission.patient.age} Years / {admission.patient.gender}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">REG / PATIENT ID</span>
            <span className="font-mono font-semibold text-slate-800">
              {admission.patient.regNo || `#${admission.patient.id}`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">ATTENDING PHYSICIAN</span>
            <span className="font-semibold text-slate-800">
              {admission.attendingDoctor || settings?.doctorName || "Dr. Medical Officer"}
            </span>
          </div>

          {admission.patient.allergies && (
            <div className="col-span-2 sm:col-span-4 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Documented Patient Allergies: {admission.patient.allergies}</span>
              {admission.patient.bloodGroup && (
                <span className="ml-auto px-2 py-0.5 rounded bg-rose-200 text-rose-900 text-[10px] font-black">
                  Blood Group: {admission.patient.bloodGroup}
                </span>
              )}
            </div>
          )}

          <div>
            <span className="text-slate-400 block font-medium">ADMISSION DATE & TIME</span>
            <span className="font-semibold text-slate-800">{formatDateTime(admission.admissionDate)}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">LENGTH OF STAY</span>
            <span className="font-bold text-purple-800">{daysAdmitted} Days</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">DISCHARGE DATE & TIME</span>
            <span className="font-semibold text-slate-800">
              {admission.dischargeDate ? formatDateTime(admission.dischargeDate) : "Currently Admitted"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">STATUS</span>
            <span
              className={`font-bold ${
                isAdmitted ? "text-purple-700" : "text-emerald-700"
              }`}
            >
              {admission.status} {admission.dischargeCondition ? `(${admission.dischargeCondition})` : ""}
            </span>
          </div>
        </div>

        {/* Admitting Diagnosis & Presentation */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 space-y-3 bg-white">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Admitting Provisional Diagnosis
            </span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {admission.admittingDiagnosis || "Under Clinical Evaluation"}
            </p>
          </div>

          {admission.chiefComplaints && (
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Chief Complaints on Admission
              </span>
              <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">
                {admission.chiefComplaints}
              </p>
            </div>
          )}

          {/* Baseline Vitals */}
          {admission.admissionVitals && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Baseline Admission Vitals
              </span>
              <div className="flex flex-wrap gap-3 text-xs">
                {initialVitals.bp && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                    BP: <strong className="text-slate-900">{initialVitals.bp}</strong> mmHg
                  </span>
                )}
                {initialVitals.pulse && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                    Pulse: <strong className="text-slate-900">{initialVitals.pulse}</strong> bpm
                  </span>
                )}
                {initialVitals.temp && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                    Temp: <strong className="text-slate-900">{initialVitals.temp}</strong> °C
                  </span>
                )}
                {initialVitals.spo2 && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                    SpO2: <strong className="text-slate-900">{initialVitals.spo2}</strong> %
                  </span>
                )}
                {initialVitals.weight && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                    Weight: <strong className="text-slate-900">{initialVitals.weight}</strong> kg
                  </span>
                )}
                {initialVitals.rbs && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                    RBS: <strong className="text-slate-900">{initialVitals.rbs}</strong> mg/dL
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 1: Daily Doctor Rounds & Clinical Progress Notes */}
        <div className="mb-8">
          <div className="flex items-center justify-between border-b-2 border-purple-200 pb-2 mb-4">
            <h2 className="text-sm font-bold text-purple-950 uppercase tracking-wider flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-purple-600" /> Daily Clinical Progress Notes & Doctor Rounds ({rounds.length})
            </h2>
          </div>

          {rounds.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              No daily clinical rounds recorded yet. Use the &quot;Doctor Round / Note&quot; button above to add observations.
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => {
                let rVitals: IpdVitals = {};
                try {
                  rVitals = JSON.parse(round.vitals || "{}");
                } catch {
                  rVitals = {};
                }

                return (
                  <div
                    key={round.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{round.doctorOrStaff}</span>
                        <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          {round.role}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-purple-500" />
                          {round.roundDate ? formatDateTime(round.roundDate) : "N/A"}
                        </span>
                      </div>

                      {(userRole === "admin_doctor" || userRole === "doctor") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRound(round.id)}
                          className="h-6 w-6 text-slate-400 hover:text-red-600 print:hidden"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {round.notes}
                    </p>

                    {round.treatmentOrders && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">Treatment Orders: </span>
                        {round.treatmentOrders}
                      </div>
                    )}

                    {round.vitals && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                        {rVitals.bp && <span>BP: <strong>{rVitals.bp}</strong></span>}
                        {rVitals.pulse && <span>Pulse: <strong>{rVitals.pulse}</strong></span>}
                        {rVitals.temp && <span>Temp: <strong>{rVitals.temp}°C</strong></span>}
                        {rVitals.spo2 && <span>SpO2: <strong>{rVitals.spo2}%</strong></span>}
                        {rVitals.rbs && <span>RBS: <strong>{rVitals.rbs}</strong></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: Diagnostic Investigations & Linked Lab Reports */}
        <div className="mb-8">
          <div className="flex items-center justify-between border-b-2 border-indigo-200 pb-2 mb-4">
            <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-indigo-600" /> Inpatient Lab Investigations ({labReportsList.length})
            </h2>
          </div>

          {labReportsList.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              No laboratory reports ordered during this admission yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {labReportsList.map((lab) => {
                let params: LabResultParameter[] = [];
                try {
                  params = JSON.parse(lab.results || "[]");
                } catch {
                  params = [];
                }
                const abnormals = params.filter(
                  (p) => p.flag === "HIGH" || p.flag === "LOW" || p.flag === "CRITICAL" || p.flag === "ABNORMAL"
                );

                return (
                  <div key={lab.id} className="p-3.5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/labs/${lab.id}`} className="font-semibold text-xs text-indigo-700 hover:underline">
                          {lab.testName}
                        </Link>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {lab.reportNo}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            lab.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {lab.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {lab.sampleType || "Blood"} • {lab.reportedAt ? formatDate(lab.reportedAt) : formatDate(lab.createdAt || new Date())}
                      </div>
                      {abnormals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {abnormals.map((ab, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1 rounded font-semibold"
                            >
                              {ab.parameter}: {ab.value} ({ab.flag})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Link href={`/labs/${lab.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <ExternalLink className="w-3 h-3" /> View Report
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: Nurse eMAR (Bedside Medication Administration Record) */}
        <NurseEmarSection
          admissionId={admission.id}
          initialRecords={emarRecords}
          userRole={userRole}
          currentStaffName={currentStaffName}
          attendingDoctorName={admission.attendingDoctor || settings?.doctorName}
        />

        {/* SECTION 4: Inpatient Fluid Balance & Input / Output (I/O) Chart */}
        <InputOutputChartSection
          admissionId={admission.id}
          initialRecords={fluidBalanceRecords}
          userRole={userRole}
          defaultNurseName={currentStaffName || (userRole === 'nurse' ? 'Staff Nurse' : settings?.doctorName || 'Attending Staff')}
        />

        {/* SECTION 5: Inpatient Nursing Procedures & Clinical Services (Oxygen, Suction, Drainage, etc.) */}
        <IpdNursingServicesSection
          admissionId={admission.id}
          patientId={admission.patient.id}
          initialServices={clinicalServices}
          userRole={userRole}
          currentStaffName={currentStaffName}
          attendingDoctorName={admission.attendingDoctor || settings?.doctorName}
        />

        {/* SECTION 6: Inpatient Clinical & Nursing Shift Handover System (Rounds & Nurses) */}
        <IpdHandoverSection
          admissionId={admission.id}
          patientId={admission.patient.id}
          patientName={admission.patient.name}
          initialHandovers={handovers}
          userRole={userRole}
          currentStaffName={currentStaffName}
          attendingDoctorName={admission.attendingDoctor || settings?.doctorName}
        />

        {/* SECTION 7: Clinical Consent Forms & Touch Signature Pad */}
        <ClinicalConsentsSection
          admissionId={admission.id}
          patientId={admission.patient.id}
          patientName={admission.patient.name}
          initialConsents={consents}
          userRole={userRole}
        />

        {/* SECTION 8: Inpatient Advance Deposits & Financial Ledger */}
        <IpdDepositsSection
          admissionId={admission.id}
          patientId={admission.patient.id}
          initialDeposits={deposits}
          userRole={userRole}
        />

        {/* SECTION 9: Inpatient Billing, Tariffs & Final Settlement */}
        <IpdBillingSection
          admission={admission}
          rounds={rounds}
          clinicalServices={clinicalServices}
          labReportsList={labReportsList}
          deposits={deposits}
          userRole={userRole}
          settings={settings}
          existingInvoice={existingInvoice}
        />

        {/* SECTION 9: Shift-to-Shift Nursing Handover Notes */}
        <IpdNursingNotesSection
          admission={admission}
          notes={nursingNotes}
          currentStaffName={currentStaffName}
          userRole={userRole}
        />

        {/* SECTION 8: Discharge Summary (if discharged) */}
        {!isAdmitted && (
          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50/30 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hospital Discharge Summary
              </h2>
              <IpdDischargeModal
                admission={admission}
                existingDischarge={existingDischarge}
                settings={settings}
                triggerButton={
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-400 text-emerald-800 hover:bg-emerald-100 gap-1.5 font-semibold">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" /> Open Formal Discharge Certificate
                  </Button>
                }
              />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-700 block">Condition on Discharge:</span>
                <span className="text-emerald-800 font-semibold">{admission.dischargeCondition || "Stable / Recovered"}</span>
              </div>

              {admission.dischargeSummary && (
                <div>
                  <span className="font-bold text-slate-700 block">Clinical Course & Summary:</span>
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-0.5">
                    {admission.dischargeSummary}
                  </p>
                </div>
              )}

              {admission.dischargeAdvice && (
                <div>
                  <span className="font-bold text-slate-700 block">Discharge Advice & Take-home Care:</span>
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-0.5">
                    {admission.dischargeAdvice}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Doctor Signature Block */}
        <div className="border-t-2 border-slate-200 pt-8 mt-12 grid grid-cols-2 gap-8 items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Certified Inpatient Medical Record</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              IPD Admission Seal: {admission.admissionNo}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block border-b-2 border-slate-900 pb-1 px-6 mb-1 text-sm font-serif italic text-slate-900">
              {admission.attendingDoctor || settings?.doctorName || "Dr. Medical Officer"}
            </div>
            <p className="text-xs font-bold text-slate-900">
              {admission.attendingDoctor || settings?.doctorName || "Attending Physician"}
            </p>
            <p className="text-[11px] text-slate-500">
              {settings?.qualifications || "MBBS, MD"} (Reg: {settings?.regNumber || "N/A"})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
