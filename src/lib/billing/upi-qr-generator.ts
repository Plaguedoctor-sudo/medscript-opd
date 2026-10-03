import QRCode from 'qrcode';
import { UpiPaymentDetails } from '@/types';

/**
 * Builds standard NPCI Bharat UPI deep-link URL and generates a base64 QR code image.
 */
export async function generateDynamicUpiQr(details: {
  vpa: string;
  merchantName: string;
  amount: number;
  transactionRef: string;
  note?: string;
}): Promise<UpiPaymentDetails> {
  const cleanVpa = details.vpa.trim();
  const cleanName = details.merchantName.trim();
  const cleanRef = details.transactionRef.trim();
  const cleanAmount = details.amount.toFixed(2);
  const cleanNote = (details.note || 'Hospital Bill Payment').slice(0, 30);

  // Standard NPCI UPI URI Specification
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&tr=${encodeURIComponent(cleanRef)}&tn=${encodeURIComponent(cleanNote)}&cu=INR`;

  const qrDataUrl = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  return {
    vpa: cleanVpa,
    merchantName: cleanName,
    amount: details.amount,
    transactionRef: cleanRef,
    qrPayload: qrDataUrl,
  };
}
