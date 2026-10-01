import { db } from "@/db";
import { prescriptions, patients, ipdAdmissions, labReports, appointments, pharmacyInventory } from "@/db/schema";
import { desc, eq, or, like } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import {
  PlusCircle,
  Settings,
  Users,
  FileText,
  AlertCircle,
  Edit,
  ExternalLink,
  Calendar,
  BarChart3,
  Receipt,
  MessageCircle,
  Bed,
  FlaskConical,
  CalendarCheck,
  Pill,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Activity,
  Wrench,
  Cctv,
} from "lucide-react";
import { DashboardSearch } from "@/components/DashboardSearch";
import { formatDate } from "@/lib/utils";
import { requireAuth, getSecurityConfig, getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { LockDeskButton } from "@/components/LockDeskButton";
import { PrivacyShield } from "@/components/PrivacyShield";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { SecurityAlertBell } from "@/components/SecurityAlertBell";
import { DoctorSecurityBanner } from "@/components/DoctorSecurityBanner";
import { LockdownBanner } from "@/components/LockdownBanner";
import { getSecurityAlerts, getLockdownStatus } from "@/lib/security-engine";
import { getCctvStats } from "@/app/cctv/actions";

interface ConsultationRow {
  id: number;
  patientId: number;
  createdAt: Date | null;
  diagnosis: string | null;
  patient: {
    name: string;
    age: number;
    gender: string;
    regNo?: string | null;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unauthorized?: string }>;
}) {
  await requireAuth('/');
  const [{ securityEnabled }, role, currentUser, resolvedParams, securityAlertsData, lockdownStatus] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    searchParams,
    getSecurityAlerts({ unacknowledgedOnly: false, limit: 30 }),
    getLockdownStatus(),
  ]);
  const query = resolvedParams?.q;
  const unauthorized = resolvedParams?.unauthorized;
  const clean = query ? query.trim() : "";
  let hyphenated = clean;
  if (/^\d{9,}$/.test(clean)) {
    hyphenated = `${clean.slice(0, 8)}-${clean.slice(8)}`;
  }

  // Fetch prescriptions with patient data, filtered by search query if present
  const results = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      createdAt: prescriptions.createdAt,
      diagnosis: prescriptions.diagnosis,
      patient: {
        name: patients.name,
        age: patients.age,
        gender: patients.gender,
        regNo: patients.regNo,
      },
    })
    .from(prescriptions)
    .innerJoin(patients, eq(prescriptions.patientId, patients.id))
    .where(
      clean
        ? or(
            like(patients.name, `%${clean}%`),
            like(patients.phone, `%${clean}%`),
            like(patients.regNo, `%${clean}%`),
            like(patients.regNo, `%${hyphenated}%`),
            like(prescriptions.diagnosis, `%${clean}%`)
          )
        : undefined
    )
    .orderBy(desc(prescriptions.createdAt))
    .limit(25);

  const todayStr = new Date().toISOString().split('T')[0];

  const [totalPatients, totalPrescriptions, activeIpdAdmissions, totalLabReports, todayAppointments, inventoryItems, settings, cctvStats] = await Promise.all([
    db.select({ id: patients.id }).from(patients),
    db.select({ id: prescriptions.id }).from(prescriptions),
    db.select({ id: ipdAdmissions.id }).from(ipdAdmissions).where(eq(ipdAdmissions.status, 'ADMITTED')),
    db.select({ id: labReports.id }).from(labReports),
    db.select({ id: appointments.id, status: appointments.status }).from(appointments).where(eq(appointments.appointmentDate, todayStr)),
    db.select({ id: pharmacyInventory.id, currentStock: pharmacyInventory.quantityInStock, minStockLevel: pharmacyInventory.minThreshold }).from(pharmacyInventory),
    db.query.clinicSettings.findFirst(),
    getCctvStats(),
  ]);

  const waitingQueueCount = todayAppointments.filter((a) => a.status === 'WAITING' || a.status === 'BOOKED').length;
  const lowStockCount = inventoryItems.filter((i) => i.currentStock <= i.minStockLevel).length;

  const typedResults = results as ConsultationRow[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900 tracking-tight">MedScript OPD</span>
                <span className="hidden sm:inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Clinic EMR
                </span>
              </div>
              {settings?.doctorName && (
                <div className="text-[11px] text-slate-500 font-medium leading-none">
                  {settings.doctorName} {settings.clinicName ? `• ${settings.clinicName}` : ''}
                </div>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <UserProfileMenu user={currentUser} role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell initialStats={securityAlertsData} />
            
            {/* Prominent CCTV Live Button (always visible across screen sizes) */}
            <Link href="/cctv" title="Live Hospital CCTV Surveillance Command Station">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-2.5 gap-1.5 text-xs border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 transition-colors font-medium shadow-2xs"
              >
                <Cctv className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>CCTV</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden sm:inline-block" />
              </Button>
            </Link>
            
            {/* Desktop module links (hidden on mobile; accessible via bottom nav and drawer) */}
            <div className="hidden lg:flex items-center gap-1">
              {/* Appointments — all roles except lab_technician & manager */}
              {role !== 'lab_technician' && role !== 'manager' && (
                <Link href="/appointments">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <CalendarCheck className="w-4 h-4 text-blue-600" /> Queue
                  </Button>
                </Link>
              )}
              {/* Patients — all roles except lab_technician & manager */}
              {role !== 'lab_technician' && role !== 'manager' && (
                <Link href="/patients">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <Users className="w-4 h-4" /> Patients
                  </Button>
                </Link>
              )}
              {/* Pharmacy Inventory */}
              {role !== 'lab_technician' && (
                <Link href="/inventory">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <Pill className="w-4 h-4 text-emerald-600" /> Pharmacy
                  </Button>
                </Link>
              )}
              {/* Pharmacy Dispense — pharmacist, doctors, admin */}
              {(role === 'admin_doctor' || role === 'doctor' || role === 'pharmacist') && (
                <Link href="/pharmacy">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50">
                    <Pill className="w-4 h-4 text-emerald-600" /> Dispense Drugs
                  </Button>
                </Link>
              )}
              {/* Hospital Stores & Assets — manager, admin */}
              {(role === 'admin_doctor' || role === 'manager') && (
                <Link href="/manager">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-blue-700 hover:bg-blue-50">
                    <Wrench className="w-4 h-4 text-blue-600" /> Stores &amp; Assets
                  </Button>
                </Link>
              )}
              {/* IPD — doctors, nurses, admin; receptionist can view */}
              {(role === 'admin_doctor' || role === 'doctor' || role === 'nurse' || role === 'receptionist') && (
                <Link href="/ipd">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <Bed className="w-4 h-4 text-purple-600" /> IPD
                  </Button>
                </Link>
              )}
              {/* ICU Telemetry — doctors and nurses */}
              {(role === 'admin_doctor' || role === 'doctor' || role === 'nurse') && (
                <Link href="/ipd/monitoring">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                    <Activity className="w-4 h-4 text-emerald-600" /> ICU Telemetry
                  </Button>
                </Link>
              )}
              {/* Labs — doctors, lab_technician, nurse (read), admin */}
              {(role === 'admin_doctor' || role === 'doctor' || role === 'nurse' || role === 'lab_technician') && (
                <Link href="/labs">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <FlaskConical className="w-4 h-4 text-indigo-600" /> Labs
                  </Button>
                </Link>
              )}
              {/* Billing — doctors, receptionist, admin */}
              {(role === 'admin_doctor' || role === 'doctor' || role === 'receptionist') && (
                <Link href="/billing">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <Receipt className="w-4 h-4 text-emerald-600" /> Billing
                  </Button>
                </Link>
              )}
              {/* Reports — doctors and admin only */}
              {(role === 'admin_doctor' || role === 'doctor') && (
                <Link href="/reports">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <BarChart3 className="w-4 h-4 text-blue-600" /> Reports
                  </Button>
                </Link>
              )}
              {/* CCTV Live Surveillance — doctors, admin, manager, nurse */}
              <Link href="/cctv">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50">
                  <Cctv className="w-4 h-4 text-indigo-600" /> CCTV
                </Button>
              </Link>
              {/* Settings — admin and doctor only */}
              {(role === 'admin_doctor' || role === 'doctor') && (
                <Link href="/settings">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                    <Settings className="w-4 h-4" /> Settings
                  </Button>
                </Link>
              )}
            </div>

            {/* Primary action button — role-contextual */}
            {(role === 'admin_doctor' || role === 'doctor') ? (
              <Link href="/prescription/new">
                <Button size="sm" className="gap-1.5 text-xs shadow-xs">
                  <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">New Consultation</span><span className="sm:hidden">New Rx</span>
                </Button>
              </Link>
            ) : role === 'pharmacist' ? (
              <Link href="/pharmacy">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-bold shadow-xs">
                  <Pill className="w-4 h-4 text-emerald-600" /> <span className="hidden sm:inline">Pharmacy Dispense</span><span className="sm:hidden">Dispense</span>
                </Button>
              </Link>
            ) : role === 'manager' ? (
              <Link href="/manager">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-blue-800 border-blue-300 bg-blue-50 hover:bg-blue-100 font-bold shadow-xs">
                  <Wrench className="w-4 h-4 text-blue-600" /> <span className="hidden sm:inline">Stores &amp; Assets</span><span className="sm:hidden">Stores</span>
                </Button>
              </Link>
            ) : role === 'nurse' ? (
              <Link href="/ipd">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-purple-800 border-purple-300 bg-purple-50 hover:bg-purple-100">
                  <Bed className="w-4 h-4" /> <span className="hidden sm:inline">IPD Ward</span><span className="sm:hidden">Ward</span>
                </Button>
              </Link>
            ) : role === 'receptionist' ? (
              <Link href="/patients">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100">
                  <Users className="w-4 h-4" /> <span className="hidden sm:inline">Patient Intake</span><span className="sm:hidden">Intake</span>
                </Button>
              </Link>
            ) : role === 'lab_technician' ? (
              <Link href="/labs">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-indigo-800 border-indigo-300 bg-indigo-50 hover:bg-indigo-100">
                  <FlaskConical className="w-4 h-4" /> <span className="hidden sm:inline">Lab Reports</span><span className="sm:hidden">Labs</span>
                </Button>
              </Link>
            ) : null}
            {securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>


      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1440px]">
        {/* Breach Containment & Deception Lockdown Banner */}
        <LockdownBanner initialStatus={lockdownStatus} userRole={role} />

        {/* Doctor Threat & Security Anomaly Banner */}
        <DoctorSecurityBanner
          activeAlerts={securityAlertsData.alerts.filter((a) => a.acknowledgedAt === null)}
        />

        {/* Role Access Warning Banner */}
        {(unauthorized === 'clinical_doctor_required' || unauthorized?.startsWith('access_denied_role_')) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-amber-900 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Elevated Authorization Required</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  This clinical or administrative action is restricted for your active role ({role}). Admin Doctor or Consulting Physician credentials are required.
                </p>
              </div>
            </div>
            <Link href={`/login?switch=true&redirect=${encodeURIComponent('/prescription/new')}`}>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0">
                Switch Account
              </Button>
            </Link>
          </div>
        )}

        {/* Security Warning Banner if Desk Security is Inactive */}
        {!securityEnabled && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-950 shadow-2xs">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Consultation Desk Security is Disabled</p>
                <p className="text-xs text-rose-800">
                  Anyone on your local network (LAN / Wi-Fi) has unauthenticated administrative access to all patient medical records. Configure a Master Passcode and enable Multi-Profile Security.
                </p>
              </div>
            </div>
            <Link href="/settings">
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs shrink-0 gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Secure Clinic Now
              </Button>
            </Link>
          </div>
        )}

        {/* Setup Banner if Settings are Empty */}
        {!settings && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Clinic Details Not Configured</p>
                <p className="text-xs text-amber-800">
                  Set up your doctor name, registration number, clinic logo, and contact info so they appear on prescription headers.
                </p>
              </div>
            </div>
            <Link href="/settings">
              <Button size="sm" variant="outline" className="bg-white border-amber-300 hover:bg-amber-100 text-amber-900 shrink-0">
                Setup Clinic Profile
              </Button>
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3.5 mb-8">
          <Link href="/appointments" className="block group">
            <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium">Queue &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">OPD Queue</p>
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-xl font-bold text-slate-900">{todayAppointments.length}</h3>
                    <span className="text-[11px] text-amber-600 font-medium">
                      ({waitingQueueCount} wait)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/patients" className="block group">
            <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium">All &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Patients</p>
                  <h3 className="text-xl font-bold text-slate-900">{totalPatients.length}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inventory" className="block group">
            <Card className="hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Pill className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">Stock &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Pharmacy</p>
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-xl font-bold text-slate-900">{inventoryItems.length}</h3>
                    {lowStockCount > 0 && (
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1 rounded">
                        {lowStockCount} low
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/ipd" className="block group">
            <Card className="hover:border-purple-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Bed className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-purple-600 font-medium">Wards &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Active IPD</p>
                  <h3 className="text-xl font-bold text-purple-700">{activeIpdAdmissions.length}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* ICU Devices Telemetry Card */}
          <Link href="/ipd/monitoring" className="block group">
            <Card className="hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">Live &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">ICU Telemetry</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <h3 className="text-xl font-bold text-emerald-700">6 Beds</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/labs" className="block group">
            <Card className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium">Hub &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Lab Reports</p>
                  <h3 className="text-xl font-bold text-indigo-700">{totalLabReports.length}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/reports" className="block group">
            <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium">Audit &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Prescriptions</p>
                  <h3 className="text-xl font-bold text-slate-900">{totalPrescriptions.length}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* CCTV Live Surveillance Card */}
          <Link href="/cctv" className="block group">
            <Card className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
              <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Cctv className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium">Station &rarr;</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">CCTV Safety</p>
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-xl font-bold text-indigo-700">{cctvStats.onlineCameras} Live</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  </div>
                  {cctvStats.criticalAlerts > 0 ? (
                    <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1 rounded mt-0.5 inline-block">
                      {cctvStats.criticalAlerts} alerts
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
                      {cctvStats.totalCameras} cameras
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          {(role === 'admin_doctor' || role === 'doctor') ? (
            <Link href="/prescription/new" className="block col-span-2 sm:col-span-1 h-full">
              <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-xs h-full border-transparent">
                <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <PlusCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] text-blue-100 font-medium">New Rx &rarr;</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold leading-tight">Consultation</h3>
                    <p className="text-blue-100 text-[10px] mt-0.5">Start Visit</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : role === 'receptionist' ? (
            <Link href="/patients/register" className="block col-span-2 md:col-span-1 xl:col-span-1 h-full">
              <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white cursor-pointer hover:from-amber-600 hover:to-amber-700 transition-all shadow-xs h-full">
                <CardContent className="pt-4 pb-4 px-3 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] text-amber-100 font-medium">New &rarr;</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold leading-tight">Register</h3>
                    <p className="text-amber-100 text-[10px] mt-0.5">New Patient</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : null}
        </div>

        {/* Receptionist Workspace — shown only for receptionist role */}
        {role === 'receptionist' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Link href="/patients/register" className="block group">
              <Card className="border-amber-200 bg-amber-50 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5 px-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <UserPlus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900 text-sm">Register New Patient</p>
                    <p className="text-xs text-amber-700 mt-0.5">Add name, age, phone, ABHA ID</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/appointments" className="block group">
              <Card className="border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5 px-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CalendarCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-blue-900 text-sm">OPD Queue</p>
                    <p className="text-xs text-blue-700 mt-0.5">{waitingQueueCount} waiting · {todayAppointments.length} today</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/billing" className="block group">
              <Card className="border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5 px-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900 text-sm">Billing</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Create & manage invoices</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/cctv" className="block group">
              <Card className="border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5 px-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Cctv className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-indigo-900 text-sm">CCTV Command Station</p>
                    <p className="text-xs text-indigo-700 mt-0.5">{cctvStats.onlineCameras} live feeds · Facility safety</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Recent Records — only shown for clinical roles */}
        {role !== 'receptionist' && role !== 'lab_technician' && (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">
                {query ? `Search Results for "${query}"` : "Recent Consultations"}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {query ? `${typedResults.length} matching consultations found` : "Latest patient consultations and issued prescriptions"}
              </p>
            </div>
            <DashboardSearch />
          </CardHeader>
          <CardContent>
            {typedResults.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-base font-medium">{query ? "No matching records found." : "No prescriptions issued yet."}</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  {query ? "Try searching for a different name, phone number, or diagnosis." : "Create your first consultation to generate digital prescriptions."}
                </p>
                <Link href="/prescription/new">
                  <Button size="sm">Start First Consultation</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Age / Gender</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedResults.map((px) => (
                    <TableRow key={px.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {px.createdAt ? formatDate(px.createdAt) : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/patient/${px.patientId}`} className="text-blue-600 hover:underline font-semibold">
                          {px.patient.name}
                        </Link>
                        {px.patient.regNo && (
                          <span className="block font-mono text-[11px] text-slate-500 font-normal">
                            Reg: {px.patient.regNo}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs">
                        {px.patient.age}y / {px.patient.gender}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-800 text-xs font-medium">
                        {px.diagnosis || "No diagnosis recorded"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/prescription/${px.id}?send=whatsapp`}>
                            <Button variant="outline" size="sm" className="h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" title="Send Prescription to Patient via WhatsApp">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                            </Button>
                          </Link>
                          <Link href={`/prescription/${px.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-blue-600 gap-1" title="Edit Prescription">
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </Button>
                          </Link>
                          <Link href={`/prescription/${px.id}`}>
                            <Button variant="outline" size="sm" className="h-8 gap-1">
                              <ExternalLink className="w-3.5 h-3.5" /> View/Print
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        )}
      </main>
    </div>
  );
}
