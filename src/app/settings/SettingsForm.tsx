'use client';

import { saveSettings, seedDemoData } from "./actions";
import { updateSecuritySettings } from "@/app/login/actions";
import { createManualBackupSnapshot, BackupItem } from "./backup-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useState, useTransition } from "react";
import {
  Loader2,
  Building,
  Stethoscope,
  Save,
  Sparkles,
  Lock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Database,
  Download,
  Clock,
  HardDrive,
  CheckCircle2,
} from "lucide-react";
import { ClinicSettings } from "@/types";

interface SettingsFormProps {
  settings: ClinicSettings | null;
  securityConfig: {
    securityEnabled: boolean;
    pinConfigured: boolean;
    doctorName: string;
    clinicName: string;
  };
  initialBackups: BackupItem[];
}

export default function SettingsForm({
  settings,
  securityConfig,
  initialBackups,
}: SettingsFormProps) {
  // Clinic Profile State
  const [isPending, setIsPending] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Security State
  const [securityEnabled, setSecurityEnabled] = useState(securityConfig.securityEnabled);
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

  async function handleClinicSubmit(formData: FormData) {
    setIsPending(true);
    try {
      await saveSettings(formData);
      toast.show({
        title: "Settings Saved",
        description: "Your clinic and doctor details have been updated successfully.",
        type: "success",
      });
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
      const res = await updateSecuritySettings(securityEnabled, pin, confirmPin);
      if (res.success) {
        toast.show({
          title: "Security Settings Updated",
          description: res.message,
          type: "success",
        });
        setPin("");
        setConfirmPin("");
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
        </CardHeader>
        <CardContent>
          <form action={handleClinicSubmit} className="space-y-6">
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
                    defaultValue={settings?.doctorName || ""}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">Qualifications / Degree *</Label>
                  <Input
                    id="qualifications"
                    name="qualifications"
                    defaultValue={settings?.qualifications || ""}
                    placeholder="e.g. MBBS, MD (Medicine)"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regNumber">Medical Registration No. *</Label>
                  <Input
                    id="regNumber"
                    name="regNumber"
                    defaultValue={settings?.regNumber || ""}
                    placeholder="e.g. MCI-12345 / State Reg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Phone *</Label>
                  <Input
                    id="contact"
                    name="contact"
                    defaultValue={settings?.contact || ""}
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
                    defaultValue={settings?.clinicName || ""}
                    placeholder="e.g. Lifeline Family Clinic & OPD"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Clinic Full Address *</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={settings?.address || ""}
                    placeholder="e.g. Suite 104, Medicare Square, New Delhi"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Clinic Logo (Optional)</Label>
                  <div className="flex items-center gap-4">
                    {settings?.logoUrl && (
                      <div className="w-16 h-16 border rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={settings.logoUrl}
                          alt="Clinic Logo"
                          className="max-w-full max-h-full object-contain p-1"
                        />
                      </div>
                    )}
                    <Input
                      id="logo"
                      name="logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Recommended format: Square transparent PNG or JPG image (max 2MB).
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full gap-2 font-semibold" disabled={isPending || isSeeding}>
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
    </div>
  );
}
