/**
 * ESC/POS Thermal Receipt & Token Formatter
 * Formats ultra-fast 58mm (32 chars/line) and 80mm (48 chars/line) thermal receipts
 * for reception desk token slips and OPD cash receipts.
 */

export interface ThermalReceiptOptions {
  widthMm?: 58 | 80;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  receiptNumber: string;
  dateTime: Date;
  patientName: string;
  patientRegNo?: string;
  doctorName: string;
  items: Array<{ name: string; amount: number }>;
  totalAmount: number;
  paymentMode: string;
}

export function formatThermalReceiptText(opts: ThermalReceiptOptions): string {
  const lineLen = (opts.widthMm || 58) === 80 ? 48 : 32;
  const divider = '='.repeat(lineLen);
  const thinDivider = '-'.repeat(lineLen);

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((lineLen - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  const padRow = (left: string, right: string) => {
    const spaces = Math.max(1, lineLen - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };

  const lines: string[] = [
    center(opts.clinicName.slice(0, lineLen)),
    center(opts.clinicAddress.slice(0, lineLen)),
    center(`Tel: ${opts.clinicPhone}`),
    divider,
    center('OPD PAYMENT RECEIPT'),
    divider,
    padRow('Receipt #:', opts.receiptNumber),
    padRow('Date:', opts.dateTime.toLocaleDateString()),
    padRow('Time:', opts.dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    padRow('Patient:', opts.patientName.slice(0, lineLen - 10)),
  ];

  if (opts.patientRegNo) {
    lines.push(padRow('Reg No:', opts.patientRegNo));
  }
  lines.push(padRow('Doctor:', opts.doctorName.slice(0, lineLen - 9)));
  lines.push(thinDivider);
  lines.push(padRow('Particulars', 'Amount'));
  lines.push(thinDivider);

  for (const item of opts.items) {
    lines.push(padRow(item.name.slice(0, lineLen - 10), `₹${item.amount.toFixed(2)}`));
  }

  lines.push(divider);
  lines.push(padRow('TOTAL PAID:', `₹${opts.totalAmount.toFixed(2)}`));
  lines.push(padRow('Payment Mode:', opts.paymentMode));
  lines.push(divider);
  lines.push(center('Get well soon!'));
  lines.push(center('*** Computer Generated Slip ***'));
  lines.push('\n\n\n'); // Feed lines for paper tear

  return lines.join('\n');
}
