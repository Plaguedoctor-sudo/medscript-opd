import { getSettings } from "./actions";
import SettingsForm from "./SettingsForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, BarChart3, Bed, FlaskConical, CalendarCheck, Pill, Users } from "lucide-react";
import { requirePermission, getSecurityConfig, getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { getLocalBackupSnapshots } from "./backup-actions";
import { LockDeskButton } from "@/components/LockDeskButton";
import { getRecentAuditLogs } from "@/lib/audit";
import { PrivacyShield } from "@/components/PrivacyShield";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";
import { StaffManagementSection } from "./StaffManagementSection";
import { getStaffUsers } from "@/app/login/actions";
import { getGoogleDriveConfigAction } from "./actions";
import { GoogleDriveBackupCard } from "@/components/GoogleDriveBackupCard";
import { MilitarySecurityCommandCenter } from "@/components/MilitarySecurityCommandCenter";
import { getMilitarySecurityDataAction } from "./military-actions";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requirePermission('settings:clinic', '/settings');
  const [settings, securityConfig, backupSnapshots, recentAuditLogs, role, currentUser, staffUsers, gdriveConfig, militaryData] = await Promise.all([
    getSettings(),
    getSecurityConfig(),
    getLocalBackupSnapshots(),
    getRecentAuditLogs(30),
    getCurrentUserRole(),
    getCurrentUser(),
    getStaffUsers(),
    getGoogleDriveConfigAction(),
    getMilitarySecurityDataAction(),
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
          <div className="flex items-center gap-2.5">
            <UserProfileMenu
              user={currentUser}
              role={role}
              securityEnabled={securityConfig.securityEnabled}
            />
            <PrivacyShield />
            <SecurityAlertBell />
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                  <CalendarCheck className="w-4 h-4 text-blue-600" /> Queue
                </Button>
              </Link>
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                  <Pill className="w-4 h-4 text-emerald-600" /> Pharmacy
                </Button>
              </Link>
              <Link href="/patients">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                  <Users className="w-4 h-4" /> Patients
                </Button>
              </Link>
              <Link href="/ipd">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                  <Bed className="w-4 h-4 text-purple-600" /> IPD
                </Button>
              </Link>
              <Link href="/labs">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                  <FlaskConical className="w-4 h-4 text-indigo-600" /> Labs
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Reports & Audit
                </Button>
              </Link>
            </div>
            {securityConfig.securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <MilitarySecurityCommandCenter
          initialDefcon={militaryData.defcon}
          initialQuarantinedIps={militaryData.quarantinedIps}
          isAdmin={role === 'admin_doctor'}
        />
        <StaffManagementSection
          initialStaffUsers={staffUsers}
          currentRole={role}
        />
        <GoogleDriveBackupCard
          initialConfig={gdriveConfig}
        />
        <SettingsForm
          settings={settings}
          securityConfig={securityConfig}
          initialBackups={backupSnapshots}
          initialAuditLogs={recentAuditLogs}
        />
      </main>
    </div>
  );
}
