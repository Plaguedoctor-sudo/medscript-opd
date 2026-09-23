import { getSettings } from "./actions";
import SettingsForm from "./SettingsForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { requireAuth, getSecurityConfig } from "@/lib/auth";
import { getLocalBackupSnapshots } from "./backup-actions";
import { LockDeskButton } from "@/components/LockDeskButton";

export default async function SettingsPage() {
  await requireAuth('/settings');
  const [settings, securityConfig, backupSnapshots] = await Promise.all([
    getSettings(),
    getSecurityConfig(),
    getLocalBackupSnapshots(),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" title="Dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <Settings className="text-white w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Clinic & Doctor Settings</span>
            </div>
          </div>
          {securityConfig.securityEnabled && <LockDeskButton />}
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <SettingsForm
          settings={settings}
          securityConfig={securityConfig}
          initialBackups={backupSnapshots}
        />
      </main>
    </div>
  );
}
