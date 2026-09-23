'use client'

import { saveSettings, seedDemoData } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useState } from "react";
import { Loader2, Building, Stethoscope, Save, Sparkles } from "lucide-react";
import { ClinicSettings } from "@/types";

export default function SettingsForm({ settings }: { settings: ClinicSettings | null }) {
  const [isPending, setIsPending] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

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

  async function handleSubmit(formData: FormData) {
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

  return (
    <Card className="max-w-2xl mx-auto border-slate-200 shadow-sm">
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
        <form action={handleSubmit} className="space-y-6">
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
                  placeholder="e.g. Dr. John Doe"
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
                  placeholder="e.g. +91 9876543210"
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
                  placeholder="e.g. Apollo Family Care Clinic"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Clinic Full Address *</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={settings?.address || ""}
                  placeholder="e.g. 102, Medical Enclave, MG Road, New Delhi"
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
              Quickly populates sample doctor details, sample patients, and prescriptions to test OPD workflows & PDF generation.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
