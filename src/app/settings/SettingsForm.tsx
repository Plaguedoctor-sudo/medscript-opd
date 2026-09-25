'use client';

import { saveSettings, seedDemoData } from "./actions";
import { updateSecuritySettings } from "@/app/login/actions";
import { createManualBackupSnapshot, BackupItem } from "./backup-actions";
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
} from "lucide-react";
import { ClinicSettings } from "@/types";
import { AuditLogItem } from "@/lib/audit";

interface SettingsFormProps {
  settings: ClinicSettings | null;
  securityConfig: {
    securityEnabled: boolean;
    pinConfigured: boolean;
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
  const [isSavingSecurity, startSecurityTransition] = useTransition();

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
      const res = await updateSecuritySettings(securityEnabled, pin, confirmPin, autoLockMinutes);
      if (res.success) {
        toast.show({
          title: "Security Settings Updated",
          description: res.message,
          type: "success",
        });
        setPin("");
        setConfirmPin("");
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Consultation Desk PIN Lock</CardTitle>
                <CardDescription className="text-xs">
                  Protect patient records and prescription history when stepping away from the clinic PC.
                </CardDescription>
              </div>
            </div>
            <div>
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
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>A PIN is currently configured for this clinic. Enter a new PIN below only if you wish to change it.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pin" className="text-xs font-medium">
                  {securityConfig.pinConfigured ? "Change PIN (4 to 8 digits)" : "Set New PIN (4 to 8 digits) *"}
                </Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={securityConfig.pinConfigured ? "Leave blank to keep current PIN" : "e.g. 1234"}
                  className="font-mono text-center tracking-widest"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPin" className="text-xs font-medium">
                  Confirm PIN
                </Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Repeat PIN"
                  className="font-mono text-center tracking-widest"
                />
              </div>
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2"
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
          </div>

          {/* Real-time Audit Trail Log */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1 border-b">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Recent Clinical Access & Security Events ({initialAuditLogs.length})
              </span>
              <span className="text-slate-400 font-normal">Immutable local audit log</span>
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
    </div>
  );
}
