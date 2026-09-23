import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { sqlite } from '@/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return new NextResponse('Unauthorized: Please unlock the consultation desk first.', {
      status: 401,
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
      fs.mkdirSync(backupsDir, { recursive: true });
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
