#!/usr/bin/env node
/**
 * MedScript OPD - Cryptographic Proof of Existence Certificate Generator
 * Creates a SHA-256 hash digest of the entire source tree as tamper-evident
 * timestamp evidence for copyright disputes and legal proceedings.
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walkDir(dir, exts = ['.ts', '.tsx', '.js', '.json', '.md', '.sql']) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'regulatory'].includes(entry.name)) continue;
      results.push(...walkDir(full, exts));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results.sort();
}

const files = walkDir(ROOT);
const fileHashes = files.map(f => ({ file: path.relative(ROOT, f), hash: hashFile(f) }));

// Master hash = hash of all (filepath + hash) pairs
const masterInput = fileHashes.map(f => `${f.file}:${f.hash}`).join('\n');
const masterHash  = crypto.createHash('sha256').update(masterInput).digest('hex');

const now = new Date();
const isoTime = now.toISOString();

const certificate = `================================================================================
     CRYPTOGRAPHIC PROOF OF EXISTENCE CERTIFICATE
     MedScript OPD - Proprietary Clinical Software
================================================================================

CERTIFICATE DETAILS
───────────────────
Title         : MedScript OPD (Offline-First EMR & Prescription System)
Version       : 1.1.1
Author        : Dr. Nitin Hiralal Sonare, MBBS (KEM Hospital)
MMC Reg. No.  : 20260201195
Organization  : Sonare Hospital, Buldhana, Maharashtra, India
Contact       : sonarenitin3@gmail.com | +91 9860748963
Certificate   : Generated ${isoTime}
Algorithm     : SHA-256 (FIPS 180-4)

MASTER FINGERPRINT (SHA-256 of all source files)
─────────────────────────────────────────────────
${masterHash}

This hash is a unique cryptographic fingerprint of the entire MedScript OPD
source tree at the time of generation. Any modification to any file — even a
single character — will produce a completely different master hash, making
tampering detectable.

HOW TO VERIFY INTEGRITY
────────────────────────
Run this script again on the source tree:
  node scripts/generate-proof-of-existence.js

If the "MASTER FINGERPRINT" matches the value above, the source code is identical
to what was certified by Dr. Nitin Hiralal Sonare on ${isoTime}.

LEGAL SIGNIFICANCE
──────────────────
This certificate, combined with:
  1. Git commit history (timestamped cryptographic DAG)
  2. Internet Archive snapshot: https://web.archive.org/web/20260927140317/https://github.com/Plaguedoctor-sudo/medscript-opd
  3. Software Heritage Archive: https://archive.softwareheritage.org (Save ID: 2508155)
  4. Proprietary LICENSE file in repository root

...constitutes prima facie evidence of authorship, creation date, and sole
proprietorship under the Copyright Act, 1957 (India) and the Berne Convention.

PER-FILE HASH MANIFEST (${fileHashes.length} files)
─────────────────────────────────────────────────────
${fileHashes.map(f => `${f.hash}  ${f.file}`).join('\n')}

================================================================================
Copyright (c) 2026 Dr. Nitin Hiralal Sonare. All Rights Reserved.
================================================================================
`;

const outPath = path.join(ROOT, 'regulatory', 'PROOF_OF_EXISTENCE.txt');
fs.writeFileSync(outPath, certificate, 'utf8');
console.log(`[SUCCESS] Proof of Existence Certificate generated:`);
console.log(`  -> ${outPath}`);
console.log(`  Master SHA-256: ${masterHash}`);
console.log(`  Files covered : ${fileHashes.length}`);
