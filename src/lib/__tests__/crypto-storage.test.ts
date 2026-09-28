import { describe, it, expect } from 'vitest';
import { encryptPhi, decryptPhi } from '../crypto-storage';

describe('Cryptographic Storage & PHI Protection', () => {
  it('encrypts and decrypts sensitive text using AES-256-GCM', () => {
    const sensitive = 'Patient diagnosed with Type 2 Diabetes; HbA1c 8.2%';
    const encrypted = encryptPhi(sensitive, 'test-super-secret-key-32-chars-long!');

    expect(encrypted).toMatch(/^enc:v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    expect(encrypted).not.toContain(sensitive);

    const decrypted = decryptPhi(encrypted, 'test-super-secret-key-32-chars-long!');
    expect(decrypted).toBe(sensitive);
  });

  it('fails decryption gracefully if tampered or wrong key', () => {
    const sensitive = 'Confidential Patient Data';
    const encrypted = encryptPhi(sensitive, 'key-1-abcdefghijklmnopqrstuvwxyz123');

    // Wrong key
    const decryptedWrongKey = decryptPhi(encrypted, 'wrong-key-different-secret-here123');
    expect(decryptedWrongKey).toContain('Decryption Failed');
  });

  it('handles empty or non-encrypted legacy values gracefully', () => {
    expect(encryptPhi('')).toBe('');
    expect(decryptPhi('')).toBe('');
    expect(decryptPhi('plaintext legacy data')).toBe('plaintext legacy data');
  });
});
