'use client';

import { saveSettings, seedDemoData } from "./actions";
import { updateSecuritySettings, runDatabaseDiagnostics } from "@/app/login/actions";
import { createManualBackupSnapshot, BackupItem, exportAuditLogsCsvAction } from "./backup-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Loader2,
  Building,
  Stethoscope,
  Save,
  Sparkles,
  Lock,
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  History,
  Database,
  Download,
  Clock,
  HardDrive,
  CheckCircle2,
  Plus,
  Trash2,
  Activity,
  Users,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import { ClinicSettings } from "@/types";
import { AuditLogItem } from "@/lib/audit";
import { MfaSetupModal } from "@/components/MfaSetupModal";

interface SettingsFormProps {
  settings: ClinicSettings | null;
  securityConfig: {
    securityEnabled: boolean;
    pinConfigured: boolean;
    staffPinConfigured?: boolean;
    rbacEnabled?: boolean;
    mfaEnabled?: boolean;
    pinExpired?: boolean;
    daysSincePinUpdate?: number;
    rotationDays?: number;
    minPinLength?: number;
    enforceComplexity?: boolean;
    doctorName: string;
    clinicName: string;
    autoLockMinutes?: number;
  };
  initialBackups: BackupItem[];
  initialAuditLogs?: AuditLogItem[];
}

export default function SettingsForm({
  settings,
  securityConfig,
  initialBackups,
  initialAuditLogs = [],
}: SettingsFormProps) {
  const router = useRouter();

  // Controlled Profile State
  const [profile, setProfile] = useState({
    doctorName: settings?.doctorName || "",
    qualifications: settings?.qualifications || "",
    regNumber: settings?.regNumber || "",
    contact: settings?.contact || "",
    clinicName: settings?.clinicName || "",
    address: settings?.address || "",
    logoUrl: settings?.logoUrl || null,
  });

  const [isPending, setIsPending] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);

  // Logo Processing & Removal State
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.show({
        title: "Invalid File",
        description: "Please select an image file (PNG or JPEG).",
        type: "error",
      });
      return;
    }

    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          // Resize to max 300x300 for optimal PDF letterhead resolution & small file size (< 40KB)
          const MAX_DIM = 300;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Always export as clean standard PNG (supported 100% by @react-pdf/renderer)
            const cleanPng = canvas.toDataURL("image/png");
            setLogoDataUrl(cleanPng);
            setIsRemovingLogo(false);
            setProfile((p) => ({ ...p, logoUrl: cleanPng }));
            toast.show({
              title: "Logo Processed",
              description: `Logo optimized to ${width}x${height}px PNG for crisp, error-free PDF rendering.`,
              type: "info",
            });
          }
        } catch {
          toast.show({
            title: "Processing Failed",
            description: "Could not optimize image. Please try another PNG or JPEG file.",
            type: "error",
          });
        } finally {
          setIsProcessingImage(false);
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        toast.show({
          title: "Image Error",
          description: "Could not read image file.",
          type: "error",
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setIsRemovingLogo(true);
    setLogoDataUrl("");
    setProfile((p) => ({ ...p, logoUrl: null }));
    const fileInput = document.getElementById("logo") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    toast.show({
      title: "Logo Removed",
      description: "Clinic logo removed. Save settings to apply changes.",
      type: "info",
    });
  }

  // Security State
  const [securityEnabled, setSecurityEnabled] = useState(securityConfig.securityEnabled);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(securityConfig.autoLockMinutes ?? 15);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [rbacEnabled, setRbacEnabled] = useState(Boolean(securityConfig.rbacEnabled));
  const [staffPin, setStaffPin] = useState("");
  const [confirmStaffPin, setConfirmStaffPin] = useState("");
  const [rotationDays, setRotationDays] = useState<number>(securityConfig.rotationDays ?? 90);
  const [minPinLength, setMinPinLength] = useState<number>(securityConfig.minPinLength ?? 4);
  const [enforceComplexity, setEnforceComplexity] = useState<boolean>(Boolean(securityConfig.enforceComplexity));
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(Boolean(securityConfig.mfaEnabled));
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [isSavingSecurity, startSecurityTransition] = useTransition();

  // Diagnostics & Forensic Audit State
  const [diagResult, setDiagResult] = useState<{
    healthy: boolean;
    integrityResult: string;
    foreignKeyResult: string;
    journalMode: string;
    pageSize: number;
    pageCount: number;
    totalSizeBytes: number;
  } | null>(null);
  const [isRunningDiagnostics, startDiagnosticsTransition] = useTransition();
  const [isExportingAudit, startAuditExportTransition] = useTransition();

  // Backup State
  const [backups, setBackups] = useState<BackupItem[]>(initialBackups);
  const [isCreatingSnapshot, startBackupTransition] = useTransition();

  async function handleSeedDemo() {
    setIsSeeding(true);
    try {
      await seedDemoData();
      toast.show({
        title: "Sample Data Loaded",
        description: "Clinic settings, sample patients, and prescriptions have been loaded.",
        type: "success",
      });
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sample data.";
      toast.show({
        title: "Error",
        description: message,
        type: "error",
      });
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleClinicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      const updated = await saveSettings(formData);
      if (updated) {
        setProfile({
          doctorName: updated.doctorName,
          qualifications: updated.qualifications,
          regNumber: updated.regNumber,
          contact: updated.contact,
          clinicName: updated.clinicName,
          address: updated.address,
          logoUrl: updated.logoUrl || null,
        });
      }
      toast.show({
        title: "Settings Saved",
        description: `Doctor profile updated for ${updated?.doctorName || profile.doctorName}. Changes will reflect on all prescriptions.`,
        type: "success",
      });
      setSavedRecently(true);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings. Please try again.";
      toast.show({
        title: "Error",
        description: message,
        type: "error",
      });
    } finally {
      setIsPending(false);
    }
  }

  function handleSaveSecurity(e: React.FormEvent) {
    e.preventDefault();
    startSecurityTransition(async () => {
      const res = await updateSecuritySettings(
        securityEnabled,
        pin,
        confirmPin,
        autoLockMinutes,
        staffPin,
        confirmStaffPin,
        rbacEnabled,
        rotationDays,
        minPinLength,
        enforceComplexity
      );
      if (res.success) {
        toast.show({
          title: "Security Settings Updated",
          description: res.message,
          type: "success",
        });
        setPin("");
        setConfirmPin("");
        setStaffPin("");
        setConfirmStaffPin("");
        router.refresh();
      } else {
        toast.show({
          title: "Security Update Failed",
          description: res.message,
          type: "error",
        });
      }
    });
  }

  function handleRunDiagnostics() {
    startDiagnosticsTransition(async () => {
      const result = await runDatabaseDiagnostics();
      setDiagResult(result);
      if (result.healthy) {
        toast.show({
          title: "Integrity Verified",
          description: `SQLite DB is 100% healthy. Integrity: ${result.integrityResult}, FK: ${result.foreignKeyResult}`,
          type: "success",
        });
      } else {
        toast.show({
          title: "Diagnostic Alert",
          description: `Integrity check reported issues: ${result.integrityResult}`,
          type: "error",
        });
      }
    });
  }

  function handleExportAuditLogs() {
    startAuditExportTransition(async () => {
      const res = await exportAuditLogsCsvAction();
      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `medscript-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.show({
          title: "Audit Trail Exported",
          description: "Clinical audit log downloaded as CSV.",
          type: "success",
        });
      } else {
        toast.show({
          title: "Export Failed",
          description: res.error || "Could not export audit log.",
          type: "error",
        });
      }
    });
  }

  function handleCreateSnapshot() {
    startBackupTransition(async () => {
      const res = await createManualBackupSnapshot();
      if (res.success) {
        toast.show({
          title: "Database Backup Created",
          description: res.message,
          type: "success",
        });
        // Optimistically add to list
        const now = new Date();
        setBackups((prev) => [
          {
            filename: res.message.replace('Snapshot created: ', ''),
            sizeKb: '20.0',
            createdAt: now.toLocaleString(),
          },
          ...prev,
        ]);
      } else {
        toast.show({
          title: "Backup Failed",
          description: res.message,
          type: "error",
        });
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 1. CLINIC & DOCTOR PROFILE */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Clinic & Doctor Profile</CardTitle>
                <CardDescription className="text-xs">
                  These details appear on your printed and digital prescription letterheads.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                Active: {profile.doctorName || "Not Set"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleClinicSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b text-sm font-semibold text-slate-700">
                <Stethoscope className="w-4 h-4 text-blue-600" /> Doctor Details
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctorName">Doctor Name *</Label>
                  <Input
                    id="doctorName"
                    name="doctorName"
                    value={profile.doctorName}
                    onChange={(e) => setProfile((p) => ({ ...p, doctorName: e.target.value }))}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">Qualifications / Degree *</Label>
                  <Input
                    id="qualifications"
                    name="qualifications"
                    value={profile.qualifications}
                    onChange={(e) => setProfile((p) => ({ ...p, qualifications: e.target.value }))}
                    placeholder="e.g. MBBS, MD (Medicine)"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regNumber">Medical Registration No. *</Label>
                  <Input
                    id="regNumber"
                    name="regNumber"
                    value={profile.regNumber}
                    onChange={(e) => setProfile((p) => ({ ...p, regNumber: e.target.value }))}
                    placeholder="e.g. MCI-12345 / State Reg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Phone *</Label>
                  <Input
                    id="contact"
                    name="contact"
                    value={profile.contact}
                    onChange={(e) => setProfile((p) => ({ ...p, contact: e.target.value }))}
                    placeholder="e.g. +91 98101 23456"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b text-sm font-semibold text-slate-700">
                <Building className="w-4 h-4 text-blue-600" /> Clinic Details
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Clinic / Hospital Name *</Label>
                  <Input
                    id="clinicName"
                    name="clinicName"
                    value={profile.clinicName}
                    onChange={(e) => setProfile((p) => ({ ...p, clinicName: e.target.value }))}
                    placeholder="e.g. Lifeline Family Clinic & OPD"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Clinic Full Address *</Label>
                  <Input
                    id="address"
                    name="address"
                    value={profile.address}
                    onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                    placeholder="e.g. Suite 104, Medicare Square, New Delhi"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Clinic Logo (Optional)</Label>
                  <input type="hidden" name="logoDataUrl" value={logoDataUrl || ""} />
                  <input type="hidden" name="removeLogo" value={isRemovingLogo ? "true" : "false"} />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {profile.logoUrl && !isRemovingLogo ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 border rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 shrink-0 shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profile.logoUrl}
                            alt="Clinic Logo"
                            className="max-w-full max-h-full object-contain p-1"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveLogo}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5 h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex-1">
                      <Input
                        id="logo"
                        name="logo"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleLogoFileChange}
                        className="flex-1"
                        disabled={isProcessingImage}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    PNG or JPG image. Logos are automatically scaled down and converted to standard PNG for error-free PDF letterheads without network errors.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Letterhead Preview */}
            <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50/50 via-white to-slate-50 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-900 border-b border-blue-100 pb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  Live Letterhead Preview (as shown on New Prescriptions & Printouts)
                </span>
                <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">Auto-updates as you type</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {profile.logoUrl ? (
                    <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profile.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <Building className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      {profile.clinicName || "Clinic / Hospital Name"}
                    </h3>
                    <p className="text-xs text-slate-500">{profile.address || "Clinic Address"}</p>
                    <p className="text-xs text-slate-500">Contact: {profile.contact || "+91 Contact Number"}</p>
                  </div>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                  <p className="font-bold text-blue-700 text-sm sm:text-base">{profile.doctorName || "Dr. Name"}</p>
                  <p className="text-xs font-medium text-slate-700">{profile.qualifications || "Degrees / Qualifications"}</p>
                  <p className="text-[11px] text-slate-500 font-mono">Reg: {profile.regNumber || "REG-PENDING"}</p>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full gap-2 font-semibold shadow-xs" disabled={isPending || isSeeding}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving Settings...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Clinic Settings
                </>
              )}
            </Button>

            {savedRecently && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in slide-in-from-top-1 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-950">Letterhead Profile Saved Successfully!</p>
                    <p className="text-[11px] text-emerald-800">
                      Active: {profile.doctorName} • {profile.clinicName}. Your new letterhead is active on all new prescriptions.
                    </p>
                  </div>
                </div>
                <Link href="/prescription/new">
                  <Button size="sm" type="button" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0 shadow-2xs">
                    <Plus className="w-3.5 h-3.5" /> Open New Prescription Desk
                  </Button>
                </Link>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSeedDemo}
                disabled={isSeeding || isPending}
                className="text-xs text-slate-700 hover:text-blue-600 gap-1.5"
              >
                {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                Load Sample Clinic Profile & Demo Patients
              </Button>
              <p className="text-[11px] text-slate-400 text-center">
                Quickly populates sample doctor details, sample patients, and multi-visit prescriptions to test OPD workflows & charts.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. SECURITY & CONSULTATION DESK PIN LOCK */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Consultation Desk Security & Governance</CardTitle>
                <CardDescription className="text-xs">
                  Protect patient records, restrict clinical rights, enforce MFA, and govern password rotation.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {mfaEnabled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-600" /> 2FA Active
                </span>
              )}
              {securityConfig.pinExpired && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> PIN Expired
                </span>
              )}
              {securityConfig.securityEnabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> Desk Protected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <ShieldAlert className="w-3.5 h-3.5" /> Direct Access
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSecurity} className="space-y-5">
            {securityConfig.pinExpired && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-950">Mandatory PIN Rotation Due</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Doctor Master PIN has reached the {rotationDays}-day mandatory rotation threshold ({securityConfig.daysSincePinUpdate ?? 0} days active). Please set a new PIN below to remain compliant.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-900">
                  Enable PIN Protection
                </div>
                <div className="text-xs text-slate-500">
                  Requires entering your secret PIN to access dashboard, patients, and prescriptions.
                </div>
              </div>
              <input
                type="checkbox"
                id="securityToggle"
                checked={securityEnabled}
                onChange={(e) => setSecurityEnabled(e.target.checked)}
                className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
              />
            </div>

            {securityConfig.pinConfigured && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Doctor PIN is active. Enter a new PIN below only if you wish to change or rotate it.</span>
                </div>
                <span className="text-[11px] text-emerald-800 font-mono shrink-0">
                  Rotated {securityConfig.daysSincePinUpdate ?? 0}d ago
                </span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                <span>Doctor Master PIN (Full Clinical Prescribing Authority)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pin" className="text-xs font-medium">
                    {securityConfig.pinConfigured
                      ? `Change Doctor PIN (${minPinLength} to 8 digits)`
                      : `Set Doctor PIN (${minPinLength} to 8 digits) *`}
                  </Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder={securityConfig.pinConfigured ? "Leave blank to keep current PIN" : `e.g. ${'123456'.slice(0, minPinLength)}`}
                    className="font-mono text-center tracking-widest"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPin" className="text-xs font-medium">
                    Confirm Doctor PIN
                  </Label>
                  <Input
                    id="confirmPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Repeat Doctor PIN"
                    className="font-mono text-center tracking-widest"
                  />
                </div>
              </div>
            </div>

            {/* Multi-Factor Authentication (MFA / 2FA) */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    Multi-Factor Authentication (RFC 6238 TOTP 2FA)
                  </div>
                  <div className="text-xs text-slate-500">
                    Two-step verification requiring your Doctor PIN plus a 6-digit Authenticator App code (or offline emergency backup codes).
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    type="button"
                    variant={mfaEnabled ? "outline" : "default"}
                    size="sm"
                    onClick={() => setIsMfaModalOpen(true)}
                    className={mfaEnabled ? "text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50" : "text-xs bg-indigo-600 hover:bg-indigo-700 text-white"}
                  >
                    {mfaEnabled ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Manage 2FA / Emergency Codes
                      </>
                    ) : (
                      <>
                        <Shield className="w-3.5 h-3.5" /> Set Up Two-Factor (2FA)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Credential Governance & Password Policies */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Password & Credential Governance Policies</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rotationDays" className="text-xs font-medium flex items-center justify-between">
                    <span>Mandatory PIN Rotation Interval</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Last rotated {securityConfig.daysSincePinUpdate ?? 0}d ago
                    </span>
                  </Label>
                  <select
                    id="rotationDays"
                    value={rotationDays}
                    onChange={(e) => setRotationDays(Number(e.target.value))}
                    className="w-full h-9 px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={60}>Mandatory rotation every 60 days</option>
                    <option value={90}>Mandatory rotation every 90 days (Healthcare EMR Standard)</option>
                    <option value={180}>Mandatory rotation every 180 days (6 Months)</option>
                    <option value={365}>Mandatory rotation every 365 days (1 Year)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="minPinLength" className="text-xs font-medium">
                    Enforced Minimum PIN Length
                  </Label>
                  <select
                    id="minPinLength"
                    value={minPinLength}
                    onChange={(e) => setMinPinLength(Number(e.target.value))}
                    className="w-full h-9 px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={4}>Minimum 4 digits (Standard)</option>
                    <option value={6}>Minimum 6 digits (Enhanced Security Recommended)</option>
                    <option value={8}>Minimum 8 digits (Maximum Security)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <input
                  type="checkbox"
                  id="complexityToggle"
                  checked={enforceComplexity}
                  onChange={(e) => setEnforceComplexity(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer rounded"
                />
                <label htmlFor="complexityToggle" className="cursor-pointer text-slate-700">
                  <span className="font-semibold text-slate-900">Enforce PIN Character Complexity</span>: Disallows predictable sequential patterns (e.g. 1234, 4321) and repetitive digits (e.g. 1111, 0000).
                </label>
              </div>
            </div>

            {/* Multi-Role Staff Access Control (RBAC) */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    Role-Based Access Control (Front Desk / Receptionist PIN)
                  </div>
                  <div className="text-xs text-slate-500">
                    Enables a dedicated PIN for front desk staff to register patients and search demographics without clinical prescribing rights.
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="rbacToggle"
                  checked={rbacEnabled}
                  onChange={(e) => setRbacEnabled(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
                />
              </div>

              {rbacEnabled && (
                <div className="space-y-3 p-4 rounded-xl border border-amber-200 bg-amber-50/40 animate-in fade-in">
                  {securityConfig.staffPinConfigured && (
                    <div className="text-xs text-amber-900 bg-amber-100/70 border border-amber-300/80 rounded-lg p-2.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>A Staff PIN is currently configured. Enter a new PIN below only if you wish to change it.</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="staffPin" className="text-xs font-medium">
                        {securityConfig.staffPinConfigured ? `Change Staff PIN (${minPinLength} to 8 digits)` : `Set Staff PIN (${minPinLength} to 8 digits) *`}
                      </Label>
                      <Input
                        id="staffPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={staffPin}
                        onChange={(e) => setStaffPin(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder={securityConfig.staffPinConfigured ? "Leave blank to keep" : `e.g. ${'567890'.slice(0, minPinLength)}`}
                        className="font-mono text-center tracking-widest bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmStaffPin" className="text-xs font-medium">
                        Confirm Staff PIN
                      </Label>
                      <Input
                        id="confirmStaffPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={confirmStaffPin}
                        onChange={(e) => setConfirmStaffPin(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="Repeat Staff PIN"
                        className="font-mono text-center tracking-widest bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Front desk staff logging in with this PIN can register new patients and search records, but are strictly blocked from creating prescriptions or altering clinic settings.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="autoLockMinutes" className="text-xs font-medium flex items-center justify-between">
                <span>Inactivity Screen Auto-Lock</span>
                <span className="text-[11px] text-slate-500 font-normal">Locks desk if no keyboard or mouse activity</span>
              </Label>
              <select
                id="autoLockMinutes"
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full h-10 px-3 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>5 minutes (High Security / Fast Auto-Lock)</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Standard Clinical OPD Practice)</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={0}>Disabled (Manual Lock Desk button only)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Prevents patients or visitors from viewing confidential charts and vitals when you step away from your desk.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSavingSecurity}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 shadow-xs"
            >
              {isSavingSecurity ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Security Settings...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" /> Save Security Settings
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. DATABASE BACKUP & DISASTER RECOVERY */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Database Backup & Disaster Recovery</CardTitle>
              <CardDescription className="text-xs">
                All patient profiles, vitals trends, and prescriptions reside safely in <code className="font-mono text-slate-700">sqlite.db</code>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href="/api/backup/download"
              download
              className="inline-flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-800 font-semibold text-sm transition-all shadow-sm"
            >
              <Download className="w-5 h-5 text-emerald-600" />
              Download Live Database (.db)
            </a>

            <Button
              type="button"
              variant="outline"
              onClick={handleCreateSnapshot}
              disabled={isCreatingSnapshot}
              className="h-auto p-4 rounded-xl border border-slate-300 hover:border-slate-400 font-semibold text-sm flex items-center justify-center gap-2"
            >
              {isCreatingSnapshot ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Creating Local Snapshot...
                </>
              ) : (
                <>
                  <HardDrive className="w-5 h-5 text-slate-600" /> Create Local Snapshot Now
                </>
              )}
            </Button>
          </div>

          {/* Forensic Database Diagnostics */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  SQLite Forensic Health & Integrity Diagnostics
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Run live cryptographic PRAGMA checks to verify B-tree structure, foreign key relations, and WAL journaling.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="text-xs gap-1.5 h-8 bg-white shrink-0 font-medium border-slate-300 hover:border-slate-400"
              >
                {isRunningDiagnostics ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Run Integrity Diagnostic
              </Button>
            </div>

            {diagResult && (
              <div className={`p-3 rounded-lg border text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in ${
                diagResult.healthy ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'
              }`}>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Integrity</p>
                  <p className="font-mono font-bold text-emerald-700">{diagResult.integrityResult}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Foreign Keys</p>
                  <p className="font-mono font-bold text-slate-800">{diagResult.foreignKeyResult}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Journal Mode</p>
                  <p className="font-mono font-bold text-indigo-700">{diagResult.journalMode}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Pages & Size</p>
                  <p className="font-mono font-bold text-slate-800">
                    {diagResult.pageCount} pages ({(diagResult.totalSizeBytes / 1024).toFixed(1)} KB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Local Snapshots History */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1 border-b">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Recent Local Snapshots ({backups.length})
              </span>
              <span className="text-slate-400 font-normal">Saved in ./backups</span>
            </div>

            {backups.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No local snapshots created yet. Click &quot;Create Local Snapshot Now&quot; above.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {backups.map((b) => (
                  <div
                    key={b.filename}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-mono text-slate-700 truncate">{b.filename}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-slate-500">
                      <span>{b.sizeKb} KB</span>
                      <span>{b.createdAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automated Daily Backup Guide */}
          <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-2">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              💡 Automated Daily Scheduled Backups (Recommended)
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              To automatically backup patient records every evening at 9 PM without manual intervention, run:
            </p>
            <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto">
              npm run db:backup
            </div>
            <p className="text-[10px] text-slate-400">
              On Linux: Add to crontab: <code className="text-slate-200">0 21 * * * cd /path/to/medscript-opd &amp;&amp; npm run db:backup</code>
              <br />
              On Windows: Schedule a daily task in Windows Task Scheduler pointing to <code className="text-slate-200">backup-task.bat</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. CLINICAL DATA SECURITY & AUDIT TRAIL */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Medical Data Security & Clinical Audit Trail</CardTitle>
                <CardDescription className="text-xs">
                  Defense-in-depth protection and forensic traceability for outpatient electronic health records (EHR/PHI).
                </CardDescription>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5" /> Healthcare Standards Active
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Security Safeguards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-indigo-600" />
                Anti-Brute Force Rate Limiting
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Consultation desk PIN is protected by intelligent rate limiting. Max 5 failed attempts trigger an automatic 5-minute lockout to block dictionary attacks.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Inactivity Screen Auto-Lock
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Automatically obscures and locks the screen after {autoLockMinutes > 0 ? `${autoLockMinutes} minutes` : 'configured duration'} of idle time to prevent shoulder surfing in unattended consultation rooms.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                HTTP Security Headers & Anti-Sniffing
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Enforces <code className="font-mono text-slate-700">X-Frame-Options: DENY</code>, Content Security Policy (CSP), anti-MIME sniffing, and strict referrer policies to stop clickjacking and cross-origin leakage.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-600" />
                POSIX File Security & Anti-Caching
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Restricted file permissions (<code className="font-mono text-slate-700">chmod 600</code>) on SQLite databases and snapshots prevent unauthorized OS users from reading patient tables. Anti-cache headers prevent disk residue.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1 md:col-span-2">
              <div className="font-semibold text-rose-950 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Autonomous Threat Sentinel & Doctor Notification Engine
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed">
                Continuously analyzes internal audit logs in real-time. Automatically flags brute-force lockouts, off-hours bulk exports, emergency break-glass triage access, and prescription HMAC-SHA256 seal tampering. Alerts the doctor through the persistent navigation alert bell and dashboard emergency banners.
              </p>
            </div>
          </div>

          {/* Real-time Audit Trail Log */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold text-slate-700 pb-2 border-b gap-2">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Recent Clinical Access & Security Events ({initialAuditLogs.length})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-normal text-[11px] hidden sm:inline">Immutable local audit trail</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportAuditLogs}
                  disabled={isExportingAudit}
                  className="h-7 text-[11px] gap-1.5 border-slate-300 hover:border-slate-400 text-slate-700"
                >
                  {isExportingAudit ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3 text-blue-600" />
                  )}
                  Export Audit Trail CSV
                </Button>
              </div>
            </div>

            {initialAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No security audit events recorded yet. Authentication and patient data actions will appear here automatically.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {initialAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs gap-2"
                  >
                    <div className="flex items-start sm:items-center gap-2 min-w-0">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'WARNING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.action}
                      </span>
                      {log.actorRole && (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                            log.actorRole === 'DOCTOR'
                              ? 'bg-indigo-100 text-indigo-800'
                              : log.actorRole === 'RECEPTIONIST'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.actorRole}
                        </span>
                      )}
                      <span className="text-slate-700 truncate">{log.details || 'Event logged'}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px] self-end sm:self-auto font-mono">
                      <span>{log.ipAddress || 'local'}</span>
                      <span>
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RFC 6238 Multi-Factor Authentication (2FA) Modal */}
      <MfaSetupModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        mfaEnabled={mfaEnabled}
        onStatusChange={(newStatus) => {
          setMfaEnabled(newStatus);
          router.refresh();
        }}
      />
    </div>
  );
}
