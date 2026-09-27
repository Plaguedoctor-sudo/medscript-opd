'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { PrescriptionPDF } from '@/components/PrescriptionPDF';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Edit,
  Download,
  Trash2,
  User,
  Loader2,
  AlertCircle,
  Settings,
  MessageCircle,
  Phone,
  Receipt,
  FileText,
  Eye,
  Calendar,
  PlusCircle,
  FlaskConical,
  Share2,
} from 'lucide-react';
import { deletePrescription } from '@/app/prescription/new/actions';
import { toast } from '@/components/ui/toast';
import { ClinicSettings, SafeClinicSettings, Patient, Prescription, Medication, UserRole } from '@/types';
import { formatDate } from '@/lib/utils';
import { DigitalRxSeal } from '@/components/DigitalRxSeal';
import { logClinicalAuditAction } from '@/app/login/actions';
import { PrescriptionDispatchModal } from '@/components/PrescriptionDispatchModal';
import { sendPrescriptionDirectly } from '@/lib/prescription-message';
import { LabEntryModal } from '@/app/labs/LabEntryModal';

interface PrescriptionPreviewProps {
  prescription: Prescription;
  patient: Patient;
  settings: SafeClinicSettings | ClinicSettings;
  isDefaultSettings?: boolean;
  userRole?: UserRole;
  autoPrint?: boolean;
  autoSend?: 'whatsapp' | 'sms' | null;
}

const emptySubscribe = () => () => {};

export default function PrescriptionPreview({
  prescription,
  patient,
  settings,
  isDefaultSettings,
  userRole = 'doctor',
  autoPrint = false,
  autoSend = null,
}: PrescriptionPreviewProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [viewMode, setViewMode] = useState<'letterhead' | 'pdf'>('letterhead');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchChannel, setDispatchChannel] = useState<'whatsapp' | 'sms'>('whatsapp');

  const fileName = `Prescription_${patient.name.replace(/\s+/g, '_')}_#${prescription.id}.pdf`;

  const handlePrintAudit = () => {
    logClinicalAuditAction(
      'PRESCRIPTION_PRINTED',
      `Prescription #${prescription.id} printed for patient ${patient.name}`
    ).catch(() => {});
    window.print();
  };

  const handleDownloadPdfAudit = () => {
    logClinicalAuditAction(
      'PRESCRIPTION_PDF_DOWNLOADED',
      `Prescription #${prescription.id} PDF downloaded for patient ${patient.name}`
    ).catch(() => {});
  };

  // Direct 1-Click WhatsApp or SMS Dispatch
  const handleDirectSend = (channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    const rawDigits = (patient.phone || '').replace(/\D/g, '');
    if (rawDigits.length >= 10) {
      sendPrescriptionDirectly(prescription, patient, settings, { channel });
    } else {
      setDispatchChannel(channel);
      setIsDispatchOpen(true);
    }
  };

  // Trigger print automatically if redirected from "Save & Print"
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handlePrintAudit();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  // Trigger 1-click WhatsApp send automatically if redirected from "Save & Send"
  useEffect(() => {
    if (autoSend) {
      const timer = setTimeout(() => {
        handleDirectSend(autoSend);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoSend]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prescription? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePrescription(prescription.id);
      toast.show({
        title: 'Prescription Deleted',
        description: 'The prescription record has been removed.',
        type: 'info',
      });
      router.push(`/patient/${patient.id}`);
    } catch {
      toast.show({
        title: 'Error',
        description: 'Failed to delete prescription.',
        type: 'error',
      });
      setIsDeleting(false);
    }
  };

  let medications: Medication[] = [];
  try {
    medications = JSON.parse(prescription.medications || '[]');
  } catch {
    medications = [];
  }

  const hasVitals = !!(
    prescription.weight ||
    prescription.bp ||
    prescription.pulse ||
    prescription.temp ||
    prescription.spo2
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col print:bg-white print:min-h-0 print:h-auto print:block">
      {/* Print-specific style overrides */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden,
          .print\\:hidden {
            display: none !important;
          }
          .print-block,
          .print\\:block {
            display: block !important;
          }
          .prescription-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
          }
          tr, .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Bar - Hidden on Print */}
      <header className="flex flex-wrap items-center justify-between p-3.5 sm:p-4 bg-white border-b shadow-xs gap-3 print:hidden sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" title="Back to Dashboard" className="h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Prescription #{prescription.id}</h1>
              {patient.regNo && (
                <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 text-[11px] font-semibold">
                  Reg: {patient.regNo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <Link href={`/patient/${patient.id}`} className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5" />
                {patient.name}
              </Link>
              <span>•</span>
              <span>{prescription.createdAt ? formatDate(prescription.createdAt) : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium mr-1">
            <button
              type="button"
              onClick={() => setViewMode('letterhead')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                viewMode === 'letterhead'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Letterhead View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                viewMode === 'pdf'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> PDF Preview
            </button>
          </div>

          {/* Primary Print Button */}
          <Button
            size="sm"
            onClick={handlePrintAudit}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
          >
            <Printer className="w-4 h-4" /> Print Prescription
          </Button>

          {/* PDF Download */}
          {isClient && (
            <PDFDownloadLink
              document={<PrescriptionPDF prescription={prescription} patient={patient} settings={settings} />}
              fileName={fileName}
              onClick={handleDownloadPdfAudit}
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading} className="gap-1.5">
                  <Download className="w-4 h-4" />
                  {loading ? 'Preparing PDF...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          )}

          {/* Direct 1-Click WhatsApp Send */}
          <Button
            size="sm"
            onClick={() => handleDirectSend('whatsapp')}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            title={patient.phone ? `Send directly to ${patient.phone} via WhatsApp` : "Send Prescription via WhatsApp"}
          >
            <MessageCircle className="w-4 h-4" /> Send to Patient (WhatsApp)
          </Button>

          {/* Direct 1-Click SMS */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDirectSend('sms')}
            className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
            title={patient.phone ? `Send directly to ${patient.phone} via SMS` : "Send Prescription via SMS"}
          >
            <Phone className="w-4 h-4 text-teal-600" /> SMS Rx
          </Button>

          {/* Customize / Edit Message */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDispatchChannel('whatsapp');
              setIsDispatchOpen(true);
            }}
            className="h-8 px-2 text-slate-500 hover:text-slate-800 text-xs"
            title="Preview and edit message before dispatch"
          >
            Customize
          </Button>

          {/* Lab Order Link (if lab tests recommended or doctor wishes to order) */}
          <LabEntryModal
            initialPatient={patient}
            initialPatientId={patient.id}
            prescriptionId={prescription.id}
            preselectedTestName={prescription.labTests ? prescription.labTests.split(/,|\n/)[0]?.trim() : undefined}
            triggerButton={
              <Button variant="outline" size="sm" className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                <FlaskConical className="w-4 h-4 text-indigo-600" /> Lab Order
              </Button>
            }
          />

          {/* Bill / Invoice Link */}
          <Link href={`/billing?patientId=${patient.id}&prescriptionId=${prescription.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50">
              <Receipt className="w-4 h-4 text-emerald-600" /> Bill / Invoice
            </Button>
          </Link>

          {/* HL7 FHIR R4 / ABDM Export */}
          <a
            href={`/api/fhir/R4/Bundle/${prescription.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Export standard HL7 FHIR R4 Bundle for ABDM National Health Interoperability"
          >
            <Button variant="outline" size="sm" className="gap-1.5 border-indigo-300 text-indigo-800 hover:bg-indigo-50">
              <Share2 className="w-4 h-4 text-indigo-600" /> FHIR R4
            </Button>
          </a>

          {/* Clinical Controls */}
          {(userRole === 'admin_doctor' || userRole === 'doctor') ? (
            <>
              <Link href={`/prescription/${prescription.id}/edit`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Edit className="w-4 h-4" /> Edit
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>

              <Link href={`/prescription/new?patientId=${patient.id}`}>
                <Button size="sm" variant="outline" className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50">
                  <PlusCircle className="w-4 h-4" /> New Consultation
                </Button>
              </Link>
            </>
          ) : (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              Receptionist View Only
            </span>
          )}
        </div>
      </header>

      {/* Active Letterhead Subheader Bar - Screen Only */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800">{settings.clinicName || 'Clinic OPD'}</span>
          <span className="text-slate-300">•</span>
          <span className="text-blue-700 font-semibold">{settings.doctorName}</span>
          {settings.qualifications && (
            <span className="text-slate-600">({settings.qualifications})</span>
          )}
          {settings.regNumber && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                Reg: {settings.regNumber}
              </span>
            </>
          )}
        </div>
        <Link href="/settings" className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium">
          <Settings className="w-3.5 h-3.5" />
          Edit Letterhead Settings
        </Link>
      </div>

      {/* Fallback Notice Banner - Screen Only */}
      {isDefaultSettings && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-amber-900 text-xs sm:text-sm print:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              This prescription is using default clinic letterhead details. Configure your doctor qualifications, registration number, and clinic logo in Settings.
            </span>
          </div>
          <Link href="/settings">
            <Button size="sm" variant="outline" className="h-7 text-xs bg-white border-amber-300 hover:bg-amber-100 text-amber-900 shrink-0">
              Configure Settings
            </Button>
          </Link>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Digital Seal Verification Badge (Screen Only) */}
          <div className="print:hidden">
            <DigitalRxSeal
              prescriptionId={prescription.id}
              initialSignatureHash={prescription.signatureHash}
            />
          </div>

          {/* 1-Click Prescription Dispatch Card (Screen Only) */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-emerald-950 print:hidden shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>1-Click Patient Dispatch</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded">
                    Direct
                  </span>
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {patient.phone ? (
                    <>
                      Send directly to <strong>{patient.name}</strong> • Mobile: <span className="font-mono font-bold">{patient.phone}</span>
                    </>
                  ) : (
                    <>No phone number saved for {patient.name}. Click button to enter phone and send.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => handleDirectSend('whatsapp')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" /> Send via WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDirectSend('sms')}
                className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> Send via SMS
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDispatchChannel('whatsapp');
                  setIsDispatchOpen(true);
                }}
                className="text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/50"
              >
                Preview Message
              </Button>
            </div>
          </div>

          {/* VIEW MODE 1: High-Definition HTML Letterhead Sheet (Instant View & Reliable Print) */}
          <div
            className={`prescription-sheet bg-white rounded-xl shadow-md border border-slate-200 p-8 sm:p-12 text-slate-900 font-sans ${
              viewMode === 'letterhead' ? 'block' : 'hidden print:block'
            }`}
          >
            {/* Clinic Header */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-blue-600 mb-5 gap-4">
              <div className="max-w-[48%]">
                <h1 className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight leading-tight">
                  {settings.doctorName || 'Doctor Name'}
                </h1>
                {settings.qualifications && (
                  <p className="font-semibold text-slate-700 text-sm mt-0.5">{settings.qualifications}</p>
                )}
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Reg. No: <span className="font-bold text-slate-700">{settings.regNumber || 'N/A'}</span>
                </p>
              </div>

              {settings.logoUrl && (
                <div className="w-20 h-20 flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.logoUrl}
                    alt="Clinic Logo"
                    className="max-h-20 max-w-[120px] object-contain"
                  />
                </div>
              )}

              <div className="text-right max-w-[48%]">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  {settings.clinicName || 'Clinic OPD'}
                </h2>
                {settings.address && (
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{settings.address}</p>
                )}
                {settings.contact && (
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">Contact: {settings.contact}</p>
                )}
              </div>
            </div>

            {/* Patient Demographics Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-3.5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Patient Name</span>
                <span className="text-sm font-bold text-slate-900">{patient.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Age / Gender</span>
                <span className="font-semibold text-slate-800">{patient.age} Yrs / {patient.gender}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Registration No</span>
                <span className="font-mono font-bold text-blue-700">{patient.regNo || `ID #${patient.id}`}</span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Consultation Date</span>
                <span className="font-semibold text-slate-800">{prescription.createdAt ? formatDate(prescription.createdAt) : 'N/A'}</span>
              </div>
              {(patient.phone || patient.abhaId) && (
                <div className="col-span-2 sm:col-span-4 border-t border-slate-200/80 pt-2 flex flex-wrap gap-4 text-slate-600">
                  {patient.phone && (
                    <span><strong className="text-slate-700">Phone:</strong> {patient.phone}</span>
                  )}
                  {patient.abhaId && (
                    <span><strong className="text-slate-700">ABHA ID:</strong> {patient.abhaId}</span>
                  )}
                </div>
              )}
            </div>

            {/* Vitals Bar (if recorded) */}
            {hasVitals && (
              <div className="bg-blue-50/70 border border-blue-200/70 rounded-lg p-2.5 mb-4 flex flex-wrap items-center justify-around gap-2 text-xs text-blue-950 font-medium">
                {prescription.weight && (
                  <div><span className="text-blue-700 text-[10px] uppercase font-bold">Weight:</span> <span className="font-bold">{prescription.weight} kg</span></div>
                )}
                {prescription.bp && (
                  <div><span className="text-blue-700 text-[10px] uppercase font-bold">BP:</span> <span className="font-bold">{prescription.bp} mmHg</span></div>
                )}
                {prescription.pulse && (
                  <div><span className="text-blue-700 text-[10px] uppercase font-bold">Pulse:</span> <span className="font-bold">{prescription.pulse} bpm</span></div>
                )}
                {prescription.temp && (
                  <div>
                    <span className="text-blue-700 text-[10px] uppercase font-bold">Temp:</span>{' '}
                    <span className="font-bold">{prescription.temp.includes('°') ? prescription.temp : `${prescription.temp} °C`}</span>
                  </div>
                )}
                {prescription.spo2 && (
                  <div><span className="text-blue-700 text-[10px] uppercase font-bold">SpO2:</span> <span className="font-bold">{prescription.spo2} %</span></div>
                )}
              </div>
            )}

            {/* Clinical Info: Complaints, History, Diagnosis */}
            {(prescription.chiefComplaints || prescription.clinicalHistory || prescription.diagnosis) && (
              <div className="space-y-3 mb-5">
                {prescription.chiefComplaints && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1 mb-1">
                      Chief Complaints
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">{prescription.chiefComplaints}</p>
                  </div>
                )}
                {prescription.clinicalHistory && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1 mb-1">
                      Clinical History
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">{prescription.clinicalHistory}</p>
                  </div>
                )}
                {prescription.diagnosis && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1 mb-1">
                      Clinical Diagnosis
                    </h3>
                    <p className="text-sm font-bold text-blue-950 leading-relaxed">{prescription.diagnosis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Prescribed Medications (Rx) Table */}
            <div className="my-5">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b-2 border-blue-600">
                <span className="text-xl font-black text-blue-900 leading-none">℞</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900">
                  Prescribed Medications
                </h3>
              </div>

              <table className="w-full border-collapse border border-slate-200 text-left text-xs">
                <thead className="bg-slate-100/90 font-bold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2.5 border border-slate-200 w-10 text-center">#</th>
                    <th className="py-2 px-2.5 border border-slate-200">Medicine Name</th>
                    <th className="py-2 px-2.5 border border-slate-200 w-24">Strength</th>
                    <th className="py-2 px-2.5 border border-slate-200 w-28">Dosage Schedule</th>
                    <th className="py-2 px-2.5 border border-slate-200 w-28">Timing</th>
                    <th className="py-2 px-2.5 border border-slate-200 w-24">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                        No medications prescribed.
                      </td>
                    </tr>
                  ) : (
                    medications.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2 px-2.5 border border-slate-200 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 border border-slate-200">
                          <div className="font-bold text-slate-900 text-sm">
                            {m.prefix ? `${m.prefix} ` : ''}{m.name}
                          </div>
                          {m.genericName && (
                            <div className="text-[11px] text-slate-500 font-mono uppercase mt-0.5">
                              ({m.genericName})
                            </div>
                          )}
                          {m.instruction && (
                            <div className="text-[11px] text-blue-800 font-medium mt-0.5 italic">
                              Note: {m.instruction}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border border-slate-200 text-slate-700 font-medium">
                          {m.strength || '-'}
                        </td>
                        <td className="py-2 px-2.5 border border-slate-200 font-bold text-slate-900">
                          {m.dosage || '-'}
                        </td>
                        <td className="py-2 px-2.5 border border-slate-200 text-slate-700">
                          {m.timing || '-'}
                        </td>
                        <td className="py-2 px-2.5 border border-slate-200 text-slate-700">
                          {m.duration || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Advice, Lab Tests, and Follow-Up */}
            {(prescription.advice || prescription.labTests || prescription.followUpDate) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 avoid-break">
                {prescription.advice && (
                  <div className="bg-slate-50/60 rounded-lg p-3 border border-slate-200">
                    <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider mb-1">
                      Advice / Diet Instructions
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {prescription.advice}
                    </p>
                  </div>
                )}

                {prescription.labTests && (
                  <div className="bg-slate-50/60 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider">
                        Recommended Investigations / Lab Tests
                      </h4>
                      <div className="print:hidden">
                        <LabEntryModal
                          initialPatient={patient}
                          initialPatientId={patient.id}
                          prescriptionId={prescription.id}
                          preselectedTestName={prescription.labTests.split(/,|\n/)[0]?.trim()}
                          triggerButton={
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-indigo-700 hover:bg-indigo-50 font-semibold gap-1">
                              <FlaskConical className="w-3 h-3 text-indigo-600" /> Enter Lab Results
                            </Button>
                          }
                        />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {prescription.labTests}
                    </p>
                  </div>
                )}

                {prescription.followUpDate && (
                  <div className="col-span-1 sm:col-span-2 bg-blue-50/80 rounded-lg p-2.5 border border-blue-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-600 print:hidden" /> Next Clinical Follow-up:
                    </span>
                    <span className="text-xs font-black text-blue-950">
                      {formatDate(prescription.followUpDate)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Doctor Signature Block & Seal */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-end avoid-break">
              <div className="text-[10px] text-slate-500 font-mono space-y-1">
                <p className="font-bold text-slate-700">
                  Digital Seal:{' '}
                  {prescription.signatureHash
                    ? `MS-${prescription.signatureHash.slice(0, 4).toUpperCase()}-${prescription.signatureHash.slice(4, 8).toUpperCase()}-${prescription.signatureHash.slice(8, 12).toUpperCase()}`
                    : `RX-${prescription.id}`}
                </p>
                <p>MedScript OPD • Computer-generated valid electronic medical prescription</p>
                <p className="text-[9px] text-slate-400">Digitally cryptographically signed & tamper-evident record</p>
              </div>

              <div className="text-center w-52">
                <div className="border-t-2 border-slate-700 pt-1.5 mt-8">
                  <p className="font-bold text-slate-900 text-sm">{settings.doctorName || 'Authorized Doctor'}</p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Authorized Signature / Seal</p>
                </div>
              </div>
            </div>
          </div>

          {/* VIEW MODE 2: PDF Canvas View (Optional) */}
          {viewMode === 'pdf' && (
            <div className="h-[750px] bg-white shadow-lg rounded-xl overflow-hidden border print:hidden">
              {isClient ? (
                <PDFViewer
                  key={`${prescription.id}-${settings?.doctorName}-${settings?.clinicName}-${settings?.logoUrl || 'nologo'}`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  showToolbar={true}
                >
                  <PrescriptionPDF prescription={prescription} patient={patient} settings={settings} />
                </PDFViewer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span>Rendering PDF document...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* WhatsApp & SMS Clinical Prescription Dispatch Modal */}
      <PrescriptionDispatchModal
        prescription={prescription}
        patient={patient}
        settings={settings}
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        defaultChannel={dispatchChannel}
      />
    </div>
  );
}
