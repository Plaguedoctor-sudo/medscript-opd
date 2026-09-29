'use server';

import { sqlite } from '@/db';
import { requirePermission, isDoctor } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function importPatientsFromCsvAction(csvText: string): Promise<ImportResult> {
  const role = await requirePermission('patient:register', '/patients');
  const doctorAuthorized = isDoctor(role);

  if (!doctorAuthorized && role !== 'receptionist') {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: ['Permission denied. Only doctors and receptionists can import patient records.'],
    };
  }

  if (!csvText || !csvText.trim()) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: ['CSV content is empty.'],
    };
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: ['CSV must have a header row and at least one patient record row.'],
    };
  }

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const nameIdx = header.findIndex((h) => h.includes('name'));
  const ageIdx = header.findIndex((h) => h.includes('age'));
  const genderIdx = header.findIndex((h) => h.includes('gender') || h.includes('sex'));
  const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile'));
  const allergiesIdx = header.findIndex((h) => h.includes('allerg'));
  const bloodGroupIdx = header.findIndex((h) => h.includes('blood'));
  const abhaIdx = header.findIndex((h) => h.includes('abha'));

  if (nameIdx === -1 || ageIdx === -1) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: ['CSV must contain at least "Name" and "Age" columns.'],
    };
  }

  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const countRow = sqlite
    .prepare("SELECT COUNT(*) as count FROM patients WHERE reg_no LIKE ?")
    .get(`${yyyymmdd}%`) as { count: number } | undefined;
  let counter = (countRow?.count || 0) + 1;

  const insertStmt = sqlite.prepare(`
    INSERT INTO patients (name, age, gender, phone, allergies, blood_group, abha_id, reg_no, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = sqlite.transaction((rows: string[]) => {
    for (let i = 1; i < rows.length; i++) {
      const line = rows[i];
      // Basic CSV token parser handling quoted strings
      const cols: string[] = [];
      let inQuotes = false;
      let current = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());

      const name = cols[nameIdx]?.replace(/['"]/g, '').trim();
      const ageStr = cols[ageIdx]?.replace(/['"]/g, '').trim();
      const age = parseInt(ageStr, 10);

      if (!name || isNaN(age) || age < 0 || age > 130) {
        skippedCount++;
        errors.push(`Row ${i + 1}: Skipped (Invalid name "${name}" or age "${ageStr}")`);
        continue;
      }

      let gender = genderIdx !== -1 && cols[genderIdx] ? cols[genderIdx].replace(/['"]/g, '').trim() : 'Other';
      if (/^m/i.test(gender)) gender = 'Male';
      else if (/^f/i.test(gender)) gender = 'Female';
      else gender = 'Other';

      const phone = phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx].replace(/['"]/g, '').trim() : null;
      const allergies = allergiesIdx !== -1 && cols[allergiesIdx] ? cols[allergiesIdx].replace(/['"]/g, '').trim() : null;
      const bloodGroup = bloodGroupIdx !== -1 && cols[bloodGroupIdx] ? cols[bloodGroupIdx].replace(/['"]/g, '').trim() : null;
      const abhaId = abhaIdx !== -1 && cols[abhaIdx] ? cols[abhaIdx].replace(/['"]/g, '').trim() : null;

      const regNo = `${yyyymmdd}-${counter++}`;

      insertStmt.run(name, age, gender, phone, allergies, bloodGroup, abhaId, regNo, Date.now());
      importedCount++;
    }
  });

  try {
    transaction(lines);

    await logAuditEvent({
      action: 'PATIENTS_BULK_IMPORTED',
      actorRole: role.toUpperCase(),
      details: `Bulk imported ${importedCount} patients from CSV (${skippedCount} skipped)`,
      status: 'SUCCESS',
    });

    revalidatePath('/patients');
    return {
      success: true,
      importedCount,
      skippedCount,
      errors: errors.slice(0, 10), // Limit error messages to first 10
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error during CSV import';
    return {
      success: false,
      importedCount: 0,
      skippedCount: lines.length - 1,
      errors: [msg],
    };
  }
}
