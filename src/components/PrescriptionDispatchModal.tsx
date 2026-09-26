'use client';

import React, { useState } from 'react';
import {
  MessageCircle,
  Phone,
  Send,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { Patient, Prescription, ClinicSettings, Medication } from '@/types';
import { formatDate } from '@/lib/utils';
import { formatDigitalSealCode } from '@/lib/prescription-security';
import { logClinicalAuditAction } from '@/app/login/actions';

interface PrescriptionDispatchModalProps {
  prescription: Prescription;
  patient: Patient;
  settings: ClinicSettings;
  isOpen: boolean;
  onClose: () => void;
  defaultChannel?: 'whatsapp' | 'sms';
}

export function PrescriptionDispatchModal({
  prescription,
  patient,
  settings,
  isOpen,
  onClose,
  defaultChannel = 'whatsapp',
}: PrescriptionDispatchModalProps) {
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>(defaultChannel);
  const [phoneNumber, setPhoneNumber] = useState(patient.phone || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let medications: Medication[] = [];
  try {
    medications = JSON.parse(prescription.medications || '[]');
  } catch {
    medications = [];
  }

  const sealCode = prescription.signatureHash
    ? formatDigitalSealCode(prescription.signatureHash)
    : 'VERIFIED-EMR';

  // Format WhatsApp Message (Markdown-compatible)
  const generateWhatsAppMessage = () => {
    const lines: string[] = [];
    lines.push(`🏥 *${settings.clinicName || 'CLINIC OPD'}*`);
    lines.push(`👨‍⚕️ *${settings.doctorName}*${settings.qualifications ? ` (${settings.qualifications})` : ''}`);
    if (settings.regNumber) lines.push(`Reg No: ${settings.regNumber}`);
    if (settings.contact) lines.push(`Contact: ${settings.contact}`);
    lines.push(`--------------------------------`);
    lines.push(`📋 *OFFICIAL PRESCRIPTION SUMMARY*`);
    lines.push(`*Patient:* ${patient.name} (${patient.age}y / ${patient.gender})`);
    if (patient.regNo) lines.push(`*Reg No:* ${patient.regNo}`);
    lines.push(`*Date:* ${prescription.createdAt ? formatDate(prescription.createdAt) : 'Today'}`);
    if (prescription.diagnosis) lines.push(`*Diagnosis:* ${prescription.diagnosis}`);
    lines.push(`--------------------------------`);
    lines.push(`💊 *MEDICATIONS (Rx):*`);

    medications.forEach((m, idx) => {
      const prefix = m.prefix ? `${m.prefix} ` : '';
      const generic = m.genericName ? ` (${m.genericName.toUpperCase()})` : '';
      const strength = m.strength ? ` ${m.strength}` : '';
      lines.push(`${idx + 1}. *${prefix}${m.name}${strength}*${generic}`);
      lines.push(`   Dosage: ${m.dosage || 'As directed'} | ${m.timing || 'After food'} | ${m.duration || ''}`);
      if (m.instruction) lines.push(`   Note: ${m.instruction}`);
    });

    if (prescription.advice) {
      lines.push(`--------------------------------`);
      lines.push(`ℹ️ *ADVICE & INSTRUCTIONS:*`);
      lines.push(prescription.advice);
    }

    if (prescription.labTests) {
      lines.push(`🔬 *INVESTIGATIONS:*`);
      lines.push(prescription.labTests);
    }

    if (prescription.followUpDate) {
      lines.push(`--------------------------------`);
      lines.push(`📅 *NEXT FOLLOW-UP:* ${prescription.followUpDate}`);
    }

    lines.push(`--------------------------------`);
    lines.push(`🔐 *DIGITAL SEAL:* ${sealCode}`);
    lines.push(`*MedScript Secure OPD Record*`);

    return lines.join('\n');
  };

  // Format SMS Message (Compact)
  const generateSMSMessage = () => {
    const rxSummary = medications
      .map((m, i) => `${i + 1}.${m.name} ${m.dosage} (${m.duration})`)
      .join('; ');

    return `Rx from ${settings.doctorName}, ${settings.clinicName || 'Clinic'}: Patient ${patient.name}. Medicines: ${rxSummary}. Follow-up: ${
      prescription.followUpDate || 'SOS'
    }. Seal: ${sealCode}`;
  };

  const messageText = channel === 'whatsapp' ? generateWhatsAppMessage() : generateSMSMessage();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      toast.show({
        title: 'Copied to Clipboard',
        description: `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} prescription text copied.`,
        type: 'success',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.show({
        title: 'Copy Failed',
        description: 'Please copy the message manually.',
        type: 'error',
      });
    }
  };

  const handleDispatch = () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

    if (!cleanPhone && channel === 'whatsapp') {
      toast.show({
        title: 'Phone Number Required',
        description: 'Please enter a valid mobile number for WhatsApp dispatch.',
        type: 'error',
      });
      return;
    }

    if (channel === 'whatsapp') {
      logClinicalAuditAction(
        'PRESCRIPTION_DISPATCHED_WHATSAPP',
        `Prescription #${prescription.id} dispatched via WhatsApp to ${cleanPhone} (Patient: ${patient.name})`
      ).catch(() => {});

      // If phone starts with country code or not, ensure proper format (default India 91 if 10 digits)
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.show({
        title: 'Opening WhatsApp',
        description: `Dispatching prescription to +${formattedPhone}...`,
        type: 'success',
      });
      onClose();
    } else {
      logClinicalAuditAction(
        'PRESCRIPTION_DISPATCHED_SMS',
        `Prescription #${prescription.id} prepared for SMS dispatch to ${cleanPhone} (Patient: ${patient.name})`
      ).catch(() => {});

      const smsUrl = cleanPhone
        ? `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`
        : `sms:?body=${encodeURIComponent(messageText)}`;
      window.open(smsUrl, '_self');
      toast.show({
        title: 'Opening SMS App',
        description: 'Launching native messaging client...',
        type: 'info',
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              {channel === 'whatsapp' ? (
                <MessageCircle className="w-5 h-5 text-emerald-200" />
              ) : (
                <Phone className="w-5 h-5 text-teal-200" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {channel === 'whatsapp' ? 'WhatsApp Prescription Dispatch' : 'SMS Prescription Dispatch'}
              </h2>
              <p className="text-xs text-emerald-100">
                Send verified clinical prescription summary to patient mobile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2">
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              channel === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp Dispatch
          </button>
          <button
            type="button"
            onClick={() => setChannel('sms')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              channel === 'sms'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Phone className="w-4 h-4" /> SMS Dispatch
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Patient Details & Phone Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Patient:</span>
              <p className="font-bold text-slate-900 mt-0.5">{patient.name}</p>
              {patient.regNo && <p className="text-slate-500 font-mono text-[11px]">Reg: {patient.regNo}</p>}
            </div>
            <div>
              <Label htmlFor="dispatchPhone" className="text-slate-700 text-xs font-semibold">
                Mobile Number:
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="dispatchPhone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="h-8 text-xs font-medium bg-white"
                />
              </div>
            </div>
          </div>

          {/* Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {channel === 'whatsapp' ? 'WhatsApp Formatted Preview' : 'SMS Compact Message'}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {messageText.length} characters
              </span>
            </div>
            <div className="relative">
              <textarea
                readOnly
                rows={9}
                value={messageText}
                className="w-full p-3 font-mono text-[11px] bg-slate-900 text-emerald-300 rounded-xl border border-slate-800 leading-relaxed resize-none focus:outline-none select-all"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 text-xs text-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy Message'}
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDispatch}
              className={`gap-1.5 text-xs shadow-sm font-semibold ${
                channel === 'whatsapp'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              <Send className="w-4 h-4" />
              {channel === 'whatsapp' ? 'Open WhatsApp' : 'Dispatch via SMS'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
