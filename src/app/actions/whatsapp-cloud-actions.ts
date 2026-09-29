'use server';

import { db } from '@/db';
import { clinicSettings } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export interface WhatsAppCloudDispatchResult {
  success: boolean;
  mode: 'CLOUD_API' | 'WEB_FALLBACK';
  messageId?: string;
  error?: string;
}

/**
 * Dispatch WhatsApp message directly via Meta WhatsApp Cloud API if configured.
 * If credentials are not configured, signals fallback to web client.
 */
export async function dispatchWhatsAppCloudMessageAction(params: {
  phone: string;
  message: string;
  prescriptionId?: number;
  patientName?: string;
}): Promise<WhatsAppCloudDispatchResult> {
  await requirePermission('prescription:view', '/prescription');

  const settings = await db.query.clinicSettings.findFirst();

  if (!settings?.whatsappPhoneNumberId || !settings?.whatsappCloudToken) {
    return {
      success: false,
      mode: 'WEB_FALLBACK',
      error: 'WhatsApp Cloud API credentials not configured in Clinic Settings.',
    };
  }

  const cleanDigits = params.phone.replace(/\D/g, '');
  const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

  try {
    const url = `https://graph.facebook.com/v18.0/${settings.whatsappPhoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappCloudToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body: params.message,
        },
      }),
    });

    const data = await res.json();

    if (res.ok && data.messages?.[0]?.id) {
      await logAuditEvent({
        action: 'PRESCRIPTION_DISPATCHED_WHATSAPP',
        details: `Dispatched prescription #${params.prescriptionId || 'N/A'} directly via WhatsApp Cloud API to +${recipient} (${params.patientName || 'Patient'}) [MsgID: ${data.messages[0].id}]`,
        status: 'SUCCESS',
      });

      return {
        success: true,
        mode: 'CLOUD_API',
        messageId: data.messages[0].id,
      };
    } else {
      console.warn('Meta WhatsApp Cloud API error response:', data);
      return {
        success: false,
        mode: 'WEB_FALLBACK',
        error: data.error?.message || 'WhatsApp Cloud API call returned non-200 status',
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('WhatsApp Cloud API dispatch failure:', err);
    return {
      success: false,
      mode: 'WEB_FALLBACK',
      error: msg,
    };
  }
}
