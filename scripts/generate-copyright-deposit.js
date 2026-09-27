#!/usr/bin/env node
/**
 * MedScript OPD - Source Code Deposit Package Generator for Indian Copyright Office
 * Rule 70 of Copyright Rules, 2013 | Copyright Act, 1957 (Govt of India)
 *
 * Generates the standardized source code deposit extract containing core architectural logic,
 * cryptographic integrity routines, and clinical data models formatted for Form XIV submission.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'regulatory', 'MEDSCRIPT_SOURCE_CODE_DEPOSIT.txt');

const CORE_FILES = [
  'src/db/schema.ts',
  'src/lib/auth.ts',
  'src/lib/security-engine.ts',
  'src/lib/prescription-security.ts',
  'src/lib/crypto-storage.ts',
  'src/lib/drug-interactions.ts',
  'src/lib/allergy-checker.ts',
  'src/lib/audit.ts',
  'src/app/prescription/new/actions.ts',
  'src/components/DigitalRxSeal.tsx',
  'src/components/DrugInteractionAlert.tsx',
  'src/components/Icd10Search.tsx',
  'src/app/prescription/new/form.tsx',
];

const HEADER = `================================================================================
STATUTORY COMPUTER SOFTWARE SOURCE CODE DEPOSIT
REGISTRAR OF COPYRIGHTS, COPYRIGHT OFFICE, NEW DELHI, INDIA
FORM XIV | THE COPYRIGHT ACT, 1957
================================================================================
TITLE OF WORK: MedScript OPD (v1.1.1)
CLASS OF WORK: Computer Software / Literary Work
AUTHOR & APPLICANT: Dr. Nitin Hiralal Sonare, MBBS (KEM Hospital)
REGISTRATION NUMBER (MCI/MMC): 20260201195
ORGANIZATION / CLINIC: Sonare Hospital, Buldhana, Maharashtra, India
DATE OF DEPOSIT: ${new Date().toISOString().split('T')[0]}
LANGUAGE: TypeScript, React, Next.js, SQLite SQL
ENVIRONMENT: POSIX Linux, Single-Tenant Embedded Runtime, Flatpak Container
================================================================================

TABLE OF DEPOSITED MODULES:
${CORE_FILES.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}

================================================================================
`;

let outputContent = HEADER + '\n';

for (const relPath of CORE_FILES) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found: ${relPath}`);
    continue;
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const lines = raw.split('\n');

  outputContent += `\n/* ============================================================================\n`;
  outputContent += ` * MODULE: ${relPath}\n`;
  outputContent += ` * LINES: ${lines.length} | COPYRIGHT (C) 2026 DR. NITIN HIRALAL SONARE\n`;
  outputContent += ` * ============================================================================ */\n\n`;

  lines.forEach((line, idx) => {
    const lineNum = String(idx + 1).padStart(5, ' ');
    outputContent += `${lineNum} | ${line}\n`;
  });
}

outputContent += `\n/* ============================================================================\n`;
outputContent += ` * END OF STATUTORY SOURCE CODE DEPOSIT\n`;
outputContent += ` * APPLICANT: DR. NITIN HIRALAL SONARE | ALL RIGHTS RESERVED\n`;
outputContent += ` * ============================================================================ */\n`;

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
console.log(`[SUCCESS] Generated statutory copyright source code deposit at:`);
console.log(`  -> ${OUTPUT_FILE}`);
console.log(`  Total size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
