'use client'

import { useState, useSyncExternalStore } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { PrescriptionPDF } from '@/components/PrescriptionPDF';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Edit, Download, Trash2, User, Loader2, AlertCircle } from 'lucide-react';
import { deletePrescription } from '@/app/prescription/new/actions';
import { toast } from '@/components/ui/toast';
import { ClinicSettings, Patient, Prescription } from '@/types';
import { formatDate } from '@/lib/utils';

interface PrescriptionPreviewProps {
  prescription: Prescription;
  patient: Patient;
  settings: ClinicSettings;
  isDefaultSettings?: boolean;
}

const emptySubscribe = () => () => {};

export default function PrescriptionPreview({ prescription, patient, settings, isDefaultSettings }: PrescriptionPreviewProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-white border-b shadow-sm gap-4">
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
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading} className="gap-1.5">
                  <Download className="w-4 h-4" />
                  {loading ? 'Preparing...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          )}

          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print Page
          </Button>

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
        </div>
      </div>

      {/* Fallback Notice Banner */}
      {isDefaultSettings && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-amber-900 text-xs sm:text-sm">
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

      {/* PDF Canvas View */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-5xl mx-auto h-full bg-white shadow-lg rounded-xl overflow-hidden border">
          {isClient ? (
            <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar={true}>
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
  );
}
