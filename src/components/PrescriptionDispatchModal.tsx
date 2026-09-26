'use client';

import React, { useState } from 'react';
import {
  MessageCircle,
  Phone,
  Send,
  Copy,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { Patient, Prescription, ClinicSettings } from '@/types';
import {
  generateWhatsAppPrescriptionMessage,
  generateSMSPrescriptionMessage,
  sendPrescriptionDirectly,
} from '@/lib/prescription-message';

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

  const messageText =
    channel === 'whatsapp'
      ? generateWhatsAppPrescriptionMessage(prescription, patient, settings)
      : generateSMSPrescriptionMessage(prescription, patient, settings);

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
    const success = sendPrescriptionDirectly(prescription, patient, settings, {
      channel,
      phoneOverride: phoneNumber,
    });
    if (success) {
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
              {channel === 'whatsapp' ? 'Send via WhatsApp' : 'Dispatch via SMS'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
