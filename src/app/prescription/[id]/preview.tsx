'use client'

import { useState, useSyncExternalStore } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { PrescriptionPDF } from '@/components/PrescriptionPDF';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Edit, Download, Trash2, User, Loader2, AlertCircle, Settings, MessageCircle, Phone, Receipt } from 'lucide-react';
import { deletePrescription } from '@/app/prescription/new/actions';
import { toast } from '@/components/ui/toast';
import { ClinicSettings, Patient, Prescription, Medication } from '@/types';
import { formatDate } from '@/lib/utils';
import { DigitalRxSeal } from '@/components/DigitalRxSeal';
import { logClinicalAuditAction } from '@/app/login/actions';
import { PrescriptionDispatchModal } from '@/components/PrescriptionDispatchModal';

interface PrescriptionPreviewProps {
  prescription: Prescription;
  patient: Patient;
  settings: ClinicSettings;
  isDefaultSettings?: boolean;
  userRole?: 'doctor' | 'receptionist';
}

const emptySubscribe = () => () => {};

export default function PrescriptionPreview({
  prescription,
  patient,
  settings,
  isDefaultSettings,
  userRole = 'doctor',
}: PrescriptionPreviewProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchChannel, setDispatchChannel] = useState<'whatsapp' | 'sms'>('whatsapp');

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

  let medications: Medication[] = [];
  try {
    medications = JSON.parse(prescription.medications || '[]');
  } catch {
    medications = [];
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 print:bg-white print:h-auto print:block">
      {/* Top Bar - Hidden on Print */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-white border-b shadow-sm gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Prescription #{prescription.id}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link href={`/patient/${patient.id}`} className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5" />
                {patient.name}
              </Link>
              {patient.regNo && (
                <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                  Reg: {patient.regNo}
                </span>
              )}
              <span>•</span>
              <span>{prescription.createdAt ? formatDate(prescription.createdAt) : 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isClient && (
            <PDFDownloadLink
              document={<PrescriptionPDF prescription={prescription} patient={patient} settings={settings} />}
              fileName={fileName}
              onClick={handleDownloadPdfAudit}
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading} className="gap-1.5">
                  <Download className="w-4 h-4" />
                  {loading ? 'Preparing...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          )}

          <Button variant="outline" size="sm" onClick={handlePrintAudit} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print Page
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDispatchChannel('whatsapp');
              setIsDispatchOpen(true);
            }}
            className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            WhatsApp Rx
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDispatchChannel('sms');
              setIsDispatchOpen(true);
            }}
            className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
          >
            <Phone className="w-4 h-4 text-teal-600" />
            SMS Rx
          </Button>

          <Link href={`/billing?patientId=${patient.id}&prescriptionId=${prescription.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50">
              <Receipt className="w-4 h-4 text-emerald-600" /> Bill / Invoice
            </Button>
          </Link>

          {userRole !== 'receptionist' ? (
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
                <Button size="sm">New Consultation</Button>
              </Link>
            </>
          ) : (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              Receptionist View Only (Clinical Edits Restricted)
            </span>
          )}
        </div>
      </div>

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
          Edit Clinic Letterhead
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

      {/* PDF Canvas View - Screen Only */}
      <div className="flex-1 p-4 md:p-8 print:hidden">
        <div className="max-w-5xl mx-auto space-y-4">
          <DigitalRxSeal
            prescriptionId={prescription.id}
            initialSignatureHash={prescription.signatureHash}
          />
          <div className="h-[750px] bg-white shadow-lg rounded-xl overflow-hidden border">
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
              <span>Rendering prescription document...</span>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Printable Letterhead HTML Sheet (hidden on screen, active for window.print()) */}
      <div className="hidden print:block print:p-8 bg-white text-slate-900 font-sans text-xs">
        {/* Printable Header */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-blue-600 mb-4">
          <div className="max-w-[50%]">
            <h1 className="text-lg font-bold text-blue-800">{settings.doctorName || 'Doctor Name'}</h1>
            <p className="font-semibold text-slate-700">{settings.qualifications || ''}</p>
            <p className="text-slate-500">Reg. No: {settings.regNumber || 'N/A'}</p>
          </div>
          {settings.logoUrl && (
            <div className="w-16 h-16 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logoUrl} alt="Clinic Logo" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <div className="text-right max-w-[45%]">
            <h2 className="text-base font-bold text-slate-900">{settings.clinicName || 'Clinic Name'}</h2>
            <p className="text-slate-600">{settings.address || ''}</p>
            <p className="text-slate-600">Contact: {settings.contact || 'N/A'}</p>
          </div>
        </div>

        {/* Patient Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex justify-between items-center mb-4">
          <div>
            <span className="font-bold text-slate-900">{patient.name}</span>
            <span className="text-slate-600 ml-2">({patient.age}y / {patient.gender})</span>
            {patient.phone && <span className="text-slate-500 ml-2">• Tel: {patient.phone}</span>}
          </div>
          <div className="text-right text-slate-600">
            {patient.regNo && <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 mr-2">Reg: {patient.regNo}</span>}
            <span>Date: {prescription.createdAt ? formatDate(prescription.createdAt) : 'N/A'}</span>
          </div>
        </div>

        {/* Vitals Bar */}
        {(prescription.bp || prescription.pulse || prescription.weight || prescription.temp || prescription.spo2) && (
          <div className="bg-blue-50/60 border border-blue-100 rounded p-2 flex justify-around text-xs mb-4 text-blue-900">
            {prescription.weight && <span><strong>Weight:</strong> {prescription.weight} kg</span>}
            {prescription.bp && <span><strong>BP:</strong> {prescription.bp} mmHg</span>}
            {prescription.pulse && <span><strong>Pulse:</strong> {prescription.pulse} bpm</span>}
            {prescription.temp && (
              <span>
                <strong>Temp:</strong> {prescription.temp.includes("°") ? prescription.temp : `${prescription.temp} °C`}
              </span>
            )}
            {prescription.spo2 && <span><strong>SpO2:</strong> {prescription.spo2} %</span>}
          </div>
        )}

        {/* Clinical Info */}
        {prescription.chiefComplaints && (
          <div className="mb-3">
            <h3 className="font-bold text-blue-900 border-b border-slate-200 pb-0.5 mb-1">Chief Complaints</h3>
            <p className="text-slate-700">{prescription.chiefComplaints}</p>
          </div>
        )}
        {prescription.diagnosis && (
          <div className="mb-3">
            <h3 className="font-bold text-blue-900 border-b border-slate-200 pb-0.5 mb-1">Diagnosis</h3>
            <p className="text-slate-700">{prescription.diagnosis}</p>
          </div>
        )}

        {/* Medications */}
        {medications.length > 0 && (
          <div className="my-4">
            <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1.5">Rx (Prescribed Medications)</h3>
            <table className="w-full border-collapse border border-slate-200 text-left text-xs">
              <thead className="bg-slate-100 font-semibold text-slate-700">
                <tr>
                  <th className="p-1.5 border border-slate-200 w-8">#</th>
                  <th className="p-1.5 border border-slate-200">Medicine Name</th>
                  <th className="p-1.5 border border-slate-200">Strength</th>
                  <th className="p-1.5 border border-slate-200">Dosage</th>
                  <th className="p-1.5 border border-slate-200">Timing</th>
                  <th className="p-1.5 border border-slate-200">Duration</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="p-1.5 border border-slate-200 text-slate-500">{idx + 1}</td>
                    <td className="p-1.5 border border-slate-200">
                      <div className="font-bold text-slate-900">
                        {m.prefix && <span className="text-slate-600 font-semibold mr-1">{m.prefix}</span>}
                        {m.name}
                      </div>
                      {m.genericName && (
                        <div className="text-[11px] text-slate-500 font-medium italic mt-0.5 uppercase tracking-wide">
                          ({m.genericName.toUpperCase()})
                        </div>
                      )}
                      {m.instruction && <div className="text-[10px] text-slate-500 font-normal mt-0.5">{m.instruction}</div>}
                    </td>
                    <td className="p-1.5 border border-slate-200">{m.strength || '-'}</td>
                    <td className="p-1.5 border border-slate-200 font-mono font-medium">{m.dosage}</td>
                    <td className="p-1.5 border border-slate-200">{m.timing}</td>
                    <td className="p-1.5 border border-slate-200">{m.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Advice / Lab Tests */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {prescription.advice && (
            <div>
              <h3 className="font-bold text-blue-900 border-b border-slate-200 pb-0.5 mb-1">General Advice</h3>
              <p className="text-slate-700">{prescription.advice}</p>
            </div>
          )}
          {prescription.labTests && (
            <div>
              <h3 className="font-bold text-blue-900 border-b border-slate-200 pb-0.5 mb-1">Recommended Investigations</h3>
              <p className="text-slate-700">{prescription.labTests}</p>
            </div>
          )}
        </div>

        {/* Signature Line */}
        <div className="mt-12 flex justify-between items-end">
          <div className="text-[10px] text-slate-500 font-mono">
            <p className="font-semibold text-slate-700">
              Digital Seal: {prescription.signatureHash ? `MS-${prescription.signatureHash.slice(0, 4).toUpperCase()}-${prescription.signatureHash.slice(4, 8).toUpperCase()}-${prescription.signatureHash.slice(8, 12).toUpperCase()}` : `RX-${prescription.id}`}
            </p>
            <p>MedScript OPD • Computer-generated valid electronic prescription</p>
          </div>
          <div className="text-center w-48 border-t border-slate-400 pt-1">
            <p className="font-bold text-slate-800">{settings.doctorName}</p>
            <p className="text-[10px] text-slate-500">Authorized Signature</p>
          </div>
        </div>
      </div>

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
