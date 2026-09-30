import { db, sqlite } from '@/db';
import { requirePermission, getCurrentUserRole, getSecurityConfig, getCurrentUser } from '@/lib/auth';
import { getHospitalDevicesAction } from '../device-actions';
import { IcuCentralMonitoringDashboard } from '@/components/ipd/IcuCentralMonitoringDashboard';
import Link from 'next/link';
import { Activity, ChevronLeft, Bed, ShieldAlert, ArrowLeft } from 'lucide-react';
import { UserProfileMenu } from '@/components/UserProfileMenu';
import { SecurityAlertBell } from '@/components/SecurityAlertBell';
import { LockDeskButton } from '@/components/LockDeskButton';
import { PrivacyShield } from '@/components/PrivacyShield';
import { getSecurityAlerts } from '@/lib/security-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IcuMonitoringPage() {
  await requirePermission('device:view', '/ipd');

  const [{ securityEnabled }, role, currentUser, devices, securityAlertsData] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    getHospitalDevicesAction(),
    getSecurityAlerts({ unacknowledgedOnly: false, limit: 30 }),
  ]);

  // Query active admissions for quick attachment
  const activeAdmissionsRows = sqlite
    .prepare(`
      SELECT a.id, a.admission_no, a.ward, a.bed_no, p.name as patient_name
      FROM ipd_admissions a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.status = 'ADMITTED'
      ORDER BY a.ward, a.bed_no
    `)
    .all() as any[];

  const activeAdmissions = activeAdmissionsRows.map((r) => ({
    id: r.id,
    admissionNo: r.admission_no,
    patientName: r.patient_name,
    ward: r.ward,
    bedNo: r.bed_no,
  }));

  const clinicSettings = await db.query.clinicSettings.findFirst();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Navbar in Dark Cockpit Theme */}
      <nav className="bg-slate-900 border-b border-slate-800 shadow-md sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between max-w-[1680px]">
          <div className="flex items-center gap-3">
            <Link
              href="/ipd"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-xs">
                <Activity className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white tracking-tight">
                    ICU & IPD Telemetry Station
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-800">
                    Real-Time Physiological Telemetry
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium leading-none">
                  {clinicSettings?.clinicName || 'MedScript Healthcare Hospital'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/ipd"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              Back to IPD Census
            </Link>
            {securityEnabled && <LockDeskButton />}
            <SecurityAlertBell initialStats={securityAlertsData} />
            <UserProfileMenu user={currentUser} role={role} />
          </div>
        </div>
      </nav>

      {/* Main Command Center Container */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-[1680px]">
        <IcuCentralMonitoringDashboard
          initialDevices={devices}
          activeAdmissions={activeAdmissions}
          userRole={role}
        />
      </main>

      <PrivacyShield />
    </div>
  );
}
