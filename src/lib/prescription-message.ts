import { ClinicSettings, Medication, Patient, Prescription } from '@/types';
import { formatDate } from '@/lib/utils';
import { formatDigitalSealCode } from '@/lib/seal-formatter';
import { logClinicalAuditAction } from '@/app/login/actions';
import { toast } from '@/components/ui/toast';

/**
 * Normalizes phone number to standard international format (defaulting to +91 for 10-digit India numbers)
 */
export function formatPhoneNumber(rawPhone: string | undefined | null): {
  valid: boolean;
  cleanDigits: string;
  international: string;
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, cleanDigits: '', international: '', error: 'Phone number is empty' };
  }

  const cleanDigits = rawPhone.replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length < 10) {
    return { valid: false, cleanDigits, international: '', error: 'Phone number must be at least 10 digits' };
  }

  // Handle 10-digit standard Indian mobile
  if (cleanDigits.length === 10) {
    return { valid: true, cleanDigits, international: `91${cleanDigits}` };
  }

  // Handle leading 0 (e.g. 09876543210 -> 919876543210)
  if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
    return { valid: true, cleanDigits: cleanDigits.slice(1), international: `91${cleanDigits.slice(1)}` };
  }

  // Already prefixed with country code (e.g. 919876543210 or 1XXXXXXXXXX)
  return { valid: true, cleanDigits, international: cleanDigits };
}

/**
 * Generates formatted WhatsApp Markdown message for a prescription
 */
export function generateWhatsAppPrescriptionMessage(
  prescription: Prescription,
  patient: { name: string; age?: number | string | null; gender?: string | null; regNo?: string | null },
  settings: ClinicSettings
): string {
  let medications: Medication[] = [];
  try {
    medications = JSON.parse(prescription.medications || '[]');
  } catch {
    medications = [];
  }

  const sealCode = prescription.signatureHash
    ? formatDigitalSealCode(prescription.signatureHash)
    : `RX-${prescription.id}`;

  const lines: string[] = [];
  lines.push(`🏥 *${(settings.clinicName || 'Clinic OPD').toUpperCase()}*`);
  lines.push(`👨‍⚕️ *${settings.doctorName || 'Doctor'}*${settings.qualifications ? ` (${settings.qualifications})` : ''}`);
  if (settings.regNumber) lines.push(`Reg No: ${settings.regNumber}`);
  if (settings.contact) lines.push(`Contact: ${settings.contact}`);
  lines.push(`--------------------------------`);
  lines.push(`📋 *OFFICIAL PRESCRIPTION SUMMARY*`);
  lines.push(`*Patient:* ${patient.name}${patient.age ? ` (${patient.age}y / ${patient.gender || ''})` : ''}`);
  if (patient.regNo) lines.push(`*Reg No:* ${patient.regNo}`);
  lines.push(`*Date:* ${prescription.createdAt ? formatDate(prescription.createdAt) : 'Today'}`);
  if (prescription.diagnosis) lines.push(`*Diagnosis:* ${prescription.diagnosis}`);
  lines.push(`--------------------------------`);
  lines.push(`💊 *MEDICATIONS (Rx):*`);

  if (medications.length === 0) {
    lines.push(`_No medications prescribed._`);
  } else {
    medications.forEach((m, idx) => {
      const prefix = m.prefix ? `${m.prefix} ` : '';
      const generic = m.genericName ? ` (${m.genericName.toUpperCase()})` : '';
      const strength = m.strength ? ` ${m.strength}` : '';
      lines.push(`${idx + 1}. *${prefix}${m.name}${strength}*${generic}`);
      lines.push(`   Dosage: ${m.dosage || 'As directed'} | ${m.timing || 'After food'} | ${m.duration || ''}`);
      if (m.instruction) lines.push(`   Note: ${m.instruction}`);
    });
  }

  if (prescription.advice) {
    lines.push(`--------------------------------`);
    lines.push(`ℹ️ *ADVICE & INSTRUCTIONS:*`);
    lines.push(prescription.advice);
  }

  if (prescription.labTests) {
    lines.push(`--------------------------------`);
    lines.push(`🔬 *INVESTIGATIONS:*`);
    lines.push(prescription.labTests);
  }

  if (prescription.followUpDate) {
    lines.push(`--------------------------------`);
    lines.push(`📅 *NEXT FOLLOW-UP:* ${formatDate(prescription.followUpDate)}`);
  }

  lines.push(`--------------------------------`);
  lines.push(`🔐 *DIGITAL SEAL:* ${sealCode}`);
  lines.push(`*MedScript Secure OPD Record*`);

  return lines.join('\n');
}

/**
 * Generates compact SMS text for a prescription
 */
export function generateSMSPrescriptionMessage(
  prescription: Prescription,
  patient: { name: string },
  settings: ClinicSettings
): string {
  let medications: Medication[] = [];
  try {
    medications = JSON.parse(prescription.medications || '[]');
  } catch {
    medications = [];
  }

  const sealCode = prescription.signatureHash
    ? formatDigitalSealCode(prescription.signatureHash)
    : `RX-${prescription.id}`;

  const rxSummary = medications
    .map((m, i) => `${i + 1}.${m.name} ${m.dosage} (${m.duration})`)
    .join('; ');

  return `Rx from ${settings.doctorName}, ${settings.clinicName || 'Clinic'}: Patient ${patient.name}. Medicines: ${rxSummary}. Follow-up: ${
    prescription.followUpDate || 'SOS'
  }. Seal: ${sealCode}`;
}

import { dispatchWhatsAppCloudMessageAction } from '@/app/actions/whatsapp-cloud-actions';

/**
 * 1-Click Dispatch: Dispatches via Meta WhatsApp Cloud API in background if configured, or launches WhatsApp/SMS client.
 */
export function sendPrescriptionDirectly(
  prescription: Prescription,
  patient: { name: string; age?: number | string | null; gender?: string | null; regNo?: string | null; phone?: string | null },
  settings: ClinicSettings,
  options?: {
    channel?: 'whatsapp' | 'sms';
    phoneOverride?: string;
  }
): boolean {
  const channel = options?.channel || 'whatsapp';
  const rawPhone = options?.phoneOverride || patient.phone;
  const { valid, cleanDigits, international, error } = formatPhoneNumber(rawPhone);

  if (!valid) {
    toast.show({
      title: 'Phone Number Required',
      description: error || 'Please enter a valid 10-digit mobile number.',
      type: 'error',
    });
    return false;
  }

  if (channel === 'whatsapp') {
    const text = generateWhatsAppPrescriptionMessage(prescription, patient, settings);

    // If Meta WhatsApp Cloud API is configured, attempt automated background dispatch
    if (settings.whatsappPhoneNumberId) {
      toast.show({
        title: 'Dispatching WhatsApp...',
        description: `Sending automated WhatsApp to +${international}...`,
        type: 'info',
      });

      dispatchWhatsAppCloudMessageAction({
        phone: international,
        message: text,
        prescriptionId: prescription.id,
        patientName: patient.name,
      })
        .then((res) => {
          if (res.success && res.mode === 'CLOUD_API') {
            toast.show({
              title: 'WhatsApp Delivered via Cloud API',
              description: `Prescription sent to ${patient.name} (+${international}) without browser popup.`,
              type: 'success',
            });
          } else {
            // Fallback to WhatsApp Web
            const fallbackUrl = `https://api.whatsapp.com/send?phone=${international}&text=${encodeURIComponent(text)}`;
            window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            toast.show({
              title: 'Opening WhatsApp Web',
              description: `Redirecting to chat with ${patient.name}...`,
              type: 'info',
            });
          }
        })
        .catch(() => {
          const fallbackUrl = `https://api.whatsapp.com/send?phone=${international}&text=${encodeURIComponent(text)}`;
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        });

      return true;
    }

    logClinicalAuditAction(
      'PRESCRIPTION_DISPATCHED_WHATSAPP',
      `Prescription #${prescription.id} dispatched via WhatsApp to +${international} (Patient: ${patient.name})`
    ).catch(() => {});

    // Directly open WhatsApp with target phone and URL-encoded message text
    const url = `https://api.whatsapp.com/send?phone=${international}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    toast.show({
      title: 'WhatsApp Dispatched',
      description: `Opening WhatsApp chat with ${patient.name} (+${international})...`,
      type: 'success',
    });
    return true;
  } else {
    const text = generateSMSPrescriptionMessage(prescription, patient, settings);
    logClinicalAuditAction(
      'PRESCRIPTION_DISPATCHED_SMS',
      `Prescription #${prescription.id} prepared for SMS dispatch to +${international} (Patient: ${patient.name})`
    ).catch(() => {});

    const smsUrl = `sms:${cleanDigits}?body=${encodeURIComponent(text)}`;
    window.open(smsUrl, '_self');

    toast.show({
      title: 'Opening SMS App',
      description: `Launching messaging app for ${patient.name}...`,
      type: 'info',
    });
    return true;
  }
}
