'use client';

import React, { useState } from 'react';
import {
  Award,
  FileCheck,
  Send,
  Printer,
  X,
  Stethoscope,
  Building2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { Patient, MedicalCertificate, MedicalCertificateType, SafeClinicSettings, ClinicSettings } from '@/types';
import { issueMedicalCertificateAction } from '@/app/actions/certificate-actions';

interface MedicalCertificateModalProps {
  patient: Patient;
  settings?: SafeClinicSettings | ClinicSettings | null;
  isOpen: boolean;
  onClose: () => void;
  onCertificateIssued?: (cert: MedicalCertificate) => void;
}

function getDefaultStartDate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split('T')[0];
}

export function MedicalCertificateModal({
  patient,
  settings,
  isOpen,
  onClose,
  onCertificateIssued,
}: MedicalCertificateModalProps) {
  const [certType, setCertType] = useState<MedicalCertificateType>('LEAVE');
  const [diagnosis, setDiagnosis] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [restDays, setRestDays] = useState('3');
  const [referralHospital, setReferralHospital] = useState('');
  const [referralSpecialist, setReferralSpecialist] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedCert, setIssuedCert] = useState<MedicalCertificate | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await issueMedicalCertificateAction({
        patientId: patient.id,
        type: certType,
        diagnosis,
        startDate: certType === 'LEAVE' ? startDate : undefined,
        endDate: certType === 'LEAVE' ? endDate : undefined,
        restDays: certType === 'LEAVE' ? parseInt(restDays, 10) || undefined : undefined,
        referralHospital: certType === 'REFERRAL' ? referralHospital : undefined,
        referralSpecialist: certType === 'REFERRAL' ? referralSpecialist : undefined,
        remarks,
      });

      if (res.success && res.certificate) {
        setIssuedCert(res.certificate);
        if (onCertificateIssued) onCertificateIssued(res.certificate);
        toast.show({
          title: 'Certificate Issued!',
          description: `Certificate #${res.certificate.certificateNo} generated successfully.`,
          type: 'success',
        });
      } else {
        toast.show({ title: 'Error', description: res.error || 'Failed to issue certificate', type: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Award className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Clinical Certificates & Referral Notes</h2>
              <p className="text-xs text-amber-100">Medical Fitness, Sick Leave, and Tertiary Referral generator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {issuedCert ? (
            /* Printable Certificate Document */
            <div className="space-y-6">
              <div
                id="certificate-print-area"
                className="p-8 border-2 border-slate-300 rounded-2xl bg-white space-y-6 text-slate-800 font-serif"
              >
                {/* Clinic Header */}
                <div className="text-center border-b-2 border-amber-600 pb-4">
                  <h1 className="text-xl font-bold font-sans text-slate-900">
                    {settings?.clinicName || 'MEDSCRIPT OUTPATIENT CLINIC'}
                  </h1>
                  <p className="text-xs text-slate-600 font-sans mt-0.5">
                    {settings?.address} &nbsp;|&nbsp; Contact: {settings?.contact}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 font-sans mt-0.5">
                    {issuedCert.doctorName} (Reg. No: {issuedCert.doctorRegNo})
                  </p>
                </div>

                {/* Certificate Title */}
                <div className="text-center my-4">
                  <h2 className="text-lg font-bold uppercase tracking-widest text-slate-900 border-b border-dashed inline-block pb-1">
                    {issuedCert.type === 'FITNESS' && 'MEDICAL FITNESS CERTIFICATE'}
                    {issuedCert.type === 'LEAVE' && 'MEDICAL / SICKNESS LEAVE CERTIFICATE'}
                    {issuedCert.type === 'REFERRAL' && 'CLINICAL REFERRAL LETTER'}
                  </h2>
                  <div className="text-xs font-sans text-slate-500 mt-1">
                    Ref No: <strong>{issuedCert.certificateNo}</strong> &nbsp;|&nbsp; Date:{' '}
                    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {/* Body Text */}
                <div className="text-sm leading-relaxed space-y-4 text-justify">
                  {issuedCert.type === 'LEAVE' && (
                    <p>
                      This is to certify that <strong>{patient.name}</strong>, aged <strong>{patient.age}</strong> years,{' '}
                      <strong>{patient.gender}</strong>
                      {patient.regNo ? ` (Reg. No: ${patient.regNo})` : ''}, was examined at this clinic and is suffering
                      from <strong>{issuedCert.diagnosis || 'an acute medical condition'}</strong>.
                      <br />
                      <br />
                      In my clinical opinion, absence from work/school is considered essential for recovery from{' '}
                      <strong>{issuedCert.startDate}</strong> to <strong>{issuedCert.endDate}</strong> (Total:{' '}
                      <strong>{issuedCert.restDays || 3} days</strong>).
                    </p>
                  )}

                  {issuedCert.type === 'FITNESS' && (
                    <p>
                      This is to certify that <strong>{patient.name}</strong>, aged <strong>{patient.age}</strong> years,{' '}
                      <strong>{patient.gender}</strong>
                      {patient.regNo ? ` (Reg. No: ${patient.regNo})` : ''}, has been clinically examined.
                      <br />
                      <br />
                      The patient has recovered from <strong>{issuedCert.diagnosis || 'the illness'}</strong> and is
                      found fit to resume normal duties, work, or educational activities with effect from{' '}
                      <strong>{new Date().toLocaleDateString('en-IN')}</strong>.
                    </p>
                  )}

                  {issuedCert.type === 'REFERRAL' && (
                    <p>
                      <strong>To:</strong> The Attending Specialist / Medical Team
                      <br />
                      <strong>Hospital:</strong> {issuedCert.referralHospital || 'Tertiary Care Center'}
                      <br />
                      <strong>Specialty:</strong> {issuedCert.referralSpecialist || 'Internal Medicine'}
                      <br />
                      <br />
                      Referring patient <strong>{patient.name}</strong>, aged <strong>{patient.age}</strong> years,{' '}
                      <strong>{patient.gender}</strong>
                      {patient.regNo ? ` (Reg. No: ${patient.regNo})` : ''} for further specialist evaluation and
                      management of <strong>{issuedCert.diagnosis || 'suspected condition'}</strong>.
                      <br />
                      {issuedCert.remarks && <span>Clinical Notes: {issuedCert.remarks}</span>}
                    </p>
                  )}

                  {issuedCert.remarks && issuedCert.type !== 'REFERRAL' && (
                    <p className="text-xs italic bg-slate-50 p-2.5 rounded border">
                      Remarks: {issuedCert.remarks}
                    </p>
                  )}
                </div>

                {/* Signature Bar */}
                <div className="pt-12 flex justify-between items-end border-t border-slate-200 font-sans">
                  <div>
                    <div className="text-xs text-slate-500">Patient / Guardian Signature</div>
                    <div className="mt-8 border-t border-slate-400 w-36"></div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{issuedCert.doctorName}</div>
                    <div className="text-xs text-slate-600">Reg. No: {issuedCert.doctorRegNo}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Authorised Medical Signatory</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 print:hidden">
                <Button variant="outline" size="sm" onClick={() => setIssuedCert(null)}>
                  Issue Another
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handlePrint}
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    <Printer className="w-4 h-4" /> Print Certificate
                  </Button>
                  <Button size="sm" variant="outline" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Certificate Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCertType('LEAVE')}
                    className={`py-2 px-3 text-xs rounded-xl font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      certType === 'LEAVE'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> Medical Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertType('FITNESS')}
                    className={`py-2 px-3 text-xs rounded-xl font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      certType === 'FITNESS'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" /> Medical Fitness
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertType('REFERRAL')}
                    className={`py-2 px-3 text-xs rounded-xl font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      certType === 'REFERRAL'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Referral Letter
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Clinical Diagnosis *</Label>
                <Input
                  required
                  placeholder="e.g. Acute Viral Bronchitis / Lumbar Spondylosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="bg-white"
                />
              </div>

              {certType === 'LEAVE' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">From Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">To Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Rest Days</Label>
                    <Input
                      type="number"
                      value={restDays}
                      onChange={(e) => setRestDays(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              )}

              {certType === 'REFERRAL' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Referred Hospital / Center</Label>
                    <Input
                      placeholder="e.g. Apollo Hospital / AIIMS"
                      value={referralHospital}
                      onChange={(e) => setReferralHospital(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Specialist Department</Label>
                    <Input
                      placeholder="e.g. Cardiology / Pulmonology"
                      value={referralSpecialist}
                      onChange={(e) => setReferralSpecialist(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Special Instructions / Remarks</Label>
                <Input
                  placeholder="e.g. Advised complete bed rest and hydration"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 shadow-xs"
                >
                  {isSubmitting ? 'Generating Certificate...' : 'Generate & Issue Certificate'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
