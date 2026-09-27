/**
 * Formats a short human-readable digital seal code for print letterheads, labels & messages.
 * Pure client-safe utility with zero Node.js server dependencies.
 * Example: "MS-7A9F-B210-44DE"
 */
export function formatDigitalSealCode(signatureHash: string | undefined | null): string {
  if (!signatureHash) return 'UNSEALED';
  const clean = signatureHash.toUpperCase();
  return `MS-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}
