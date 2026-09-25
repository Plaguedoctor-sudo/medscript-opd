import { NextResponse } from 'next/server';
import { isAuthenticated, getCurrentUserRole } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const authed = await isAuthenticated();
  const role = await getCurrentUserRole();

  if (!authed || role !== 'doctor') {
    await logAuditEvent({
      action: 'BACKUP_SNAPSHOT_DOWNLOADED',
      actorRole: role === 'doctor' ? 'DOCTOR' : 'RECEPTIONIST',
      details: 'Unauthorized raw database download attempt blocked (Doctor role required)',
      status: 'FAILURE',
    });
    return new NextResponse('Forbidden: Only verified Doctor accounts have authority to export the raw clinical database.', {
      status: 403,
    });
  }

  const tempBackupPath = path.join(
    process.cwd(),
    'backups',
    `medscript-temp-export-${Date.now()}.db`
  );

  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
    }

    // Perform atomic snapshot using SQLite's backup API to ensure 0 corruption with WAL
    await sqlite.backup(tempBackupPath);

    const fileBuffer = fs.readFileSync(tempBackupPath);

    // Clean up temporary snapshot file
    try {
      fs.unlinkSync(tempBackupPath);
    } catch {
      // Ignore cleanup error
    }

    const today = new Date().toISOString().split('T')[0];
    const filename = `medscript-backup-${today}.db`;

    await logAuditEvent({
      action: 'BACKUP_SNAPSHOT_DOWNLOADED',
      details: `Live database backup downloaded (${(fileBuffer.length / 1024).toFixed(1)} KB)`,
      status: 'SUCCESS',
    });

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Backup download error:', err);
    return new NextResponse('Failed to generate backup file.', { status: 500 });
  }
}
