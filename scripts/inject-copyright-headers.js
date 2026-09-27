#!/usr/bin/env node
/**
 * MedScript OPD - Statutory Copyright Header Injector
 * Prepends a legally binding proprietary copyright notice to all core source modules.
 * Run once; idempotent — will not double-inject if header already present.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YEAR = 2026;
const AUTHOR = 'Dr. Nitin Hiralal Sonare';
const EMAIL = 'sonarenitin3@gmail.com';

const TS_HEADER = `/**
 * Copyright (c) ${YEAR} ${AUTHOR} <${EMAIL}>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
`;

const TSX_HEADER = `/**
 * Copyright (c) ${YEAR} ${AUTHOR} <${EMAIL}>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Unauthorized reproduction, reverse engineering, or redistribution is strictly prohibited.
 * See LICENSE at project root for full terms.
 */
`;

const CORE_FILES = [
  { path: 'src/lib/auth.ts', header: TS_HEADER },
  { path: 'src/lib/security-engine.ts', header: TS_HEADER },
  { path: 'src/lib/prescription-security.ts', header: TS_HEADER },
  { path: 'src/lib/crypto-storage.ts', header: TS_HEADER },
  { path: 'src/lib/drug-interactions.ts', header: TS_HEADER },
  { path: 'src/lib/allergy-checker.ts', header: TS_HEADER },
  { path: 'src/lib/audit.ts', header: TS_HEADER },
  { path: 'src/lib/icd10.ts', header: TS_HEADER },
  { path: 'src/lib/drug-library.ts', header: TS_HEADER },
  { path: 'src/db/schema.ts', header: TS_HEADER },
  { path: 'src/app/prescription/new/actions.ts', header: TS_HEADER },
  { path: 'src/components/DigitalRxSeal.tsx', header: TSX_HEADER },
  { path: 'src/components/DrugInteractionAlert.tsx', header: TSX_HEADER },
  { path: 'src/components/Icd10Search.tsx', header: TSX_HEADER },
];

const SENTINEL = `Copyright (c) ${YEAR} ${AUTHOR}`;

let injected = 0, skipped = 0;

for (const { path: relPath, header } of CORE_FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[SKIP] Not found: ${relPath}`);
    skipped++;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(SENTINEL)) {
    console.log(`[OK]   Already protected: ${relPath}`);
    skipped++;
    continue;
  }
  // For 'use client' / 'use server' directives, insert header after the directive line
  if (content.startsWith("'use client'") || content.startsWith('"use client"') ||
      content.startsWith("'use server'") || content.startsWith('"use server"')) {
    const newlineIdx = content.indexOf('\n');
    const directive = content.slice(0, newlineIdx + 1);
    const rest = content.slice(newlineIdx + 1);
    fs.writeFileSync(fullPath, directive + '\n' + header + rest, 'utf8');
  } else {
    fs.writeFileSync(fullPath, header + content, 'utf8');
  }
  console.log(`[DONE] Copyright header injected: ${relPath}`);
  injected++;
}

console.log(`\nSummary: ${injected} file(s) updated, ${skipped} file(s) already done or skipped.`);
