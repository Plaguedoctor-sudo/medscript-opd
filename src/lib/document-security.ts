export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

export function sanitizeDocumentFileName(name?: string): string {
  if (!name) return 'document';
  // Strip control chars, null bytes, and path traversal characters
  const clean = name.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\.\.+/g, '_').trim();
  return clean.slice(0, 100) || 'document';
}

export function verifyDocumentMagicBytes(base64Payload: string, expectedMime: string): boolean {
  try {
    const sample = base64Payload.slice(0, 64);
    const buf = Buffer.from(sample, 'base64');
    if (buf.length < 4) return false;

    if (expectedMime === 'application/pdf') {
      // Must start with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      return buf.slice(0, 5).toString('ascii') === '%PDF-';
    }
    if (expectedMime === 'image/jpeg') {
      // Must start with 0xFF 0xD8 0xFF
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    if (expectedMime === 'image/png') {
      // Must start with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    }
    if (expectedMime === 'image/webp') {
      // Must start with RIFF at 0..3 and WEBP at 8..11
      if (buf.length < 12) return false;
      return (
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return false;
  } catch {
    return false;
  }
}
