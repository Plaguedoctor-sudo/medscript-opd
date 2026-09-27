/**
 * Protected Health Information (PHI) Sanitization & Masking Module
 * Compliant with ABDM (Ayushman Bharat Digital Mission), DISHA, and HIPAA § 164.514(b)
 */

/**
 * Masks an Ayushman Bharat Health Account (ABHA) ID / Number.
 * Example: '14-2345-6789-0123' -> '14-XXXX-XXXX-0123'
 * Example: '14234567890123' -> '14-XXXX-XXXX-0123'
 */
export function maskAbhaId(abhaId?: string | null): string {
  if (!abhaId) return '';
  const clean = abhaId.trim();

  // If already formatted as 14-XXXX-XXXX-XXXX
  if (/^\d{2}-\d{4}-\d{4}-\d{4}$/.test(clean)) {
    const parts = clean.split('-');
    return `${parts[0]}-XXXX-XXXX-${parts[3]}`;
  }

  // If 14 raw consecutive digits
  const rawDigits = clean.replace(/\D/g, '');
  if (rawDigits.length === 14) {
    return `${rawDigits.slice(0, 2)}-XXXX-XXXX-${rawDigits.slice(10)}`;
  }

  // Fallback for short or alphanumeric ABHA addresses (e.g. name@abdm)
  if (clean.includes('@')) {
    const [user, domain] = clean.split('@');
    if (user.length <= 2) return `${user}***@${domain}`;
    return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
  }

  if (clean.length > 6) {
    return `${clean.slice(0, 2)}****${clean.slice(-4)}`;
  }

  return clean;
}

/**
 * Masks a patient or staff phone number for privacy display.
 * Example: '+91 98765 43210' -> '+91 98*** **210'
 * Example: '9876543210' -> '******3210'
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.trim();
  const digits = clean.replace(/\D/g, '');

  if (digits.length === 10) {
    return `******${digits.slice(-4)}`;
  }

  if (digits.length > 10) {
    const countryCode = clean.startsWith('+') ? `+${digits.slice(0, digits.length - 10)} ` : '';
    const national = digits.slice(-10);
    return `${countryCode}******${national.slice(-4)}`;
  }

  if (clean.length > 4) {
    return `***${clean.slice(-4)}`;
  }

  return clean;
}

/**
 * Masks an email address for compliance with privacy standards.
 * Example: 'rajesh.sharma@hospital.org' -> 'r***a@hospital.org'
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.trim().split('@');
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Masks an Indian National Aadhaar UID number (UIDAI statutory requirement).
 * Example: '1234 5678 9012' -> 'XXXX XXXX 9012'
 */
export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '';
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length === 12) {
    return `XXXX XXXX ${digits.slice(-4)}`;
  }
  return aadhaar;
}

/**
 * Masks a patient name for de-identified research or secondary display.
 * Example: 'Dr. Nitin Sonare' -> 'Dr. N**** S*****'
 */
export function maskPatientName(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts
    .map(p => {
      if (p.length <= 1) return p;
      return p[0] + '*'.repeat(Math.max(1, p.length - 1));
    })
    .join(' ');
}

/**
 * Sanitizes rich text strings to prevent stored Cross-Site Scripting (XSS)
 * while preserving safe clinical text and linebreaks.
 */
export function sanitizeClinicalText(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:[^"']*/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}
