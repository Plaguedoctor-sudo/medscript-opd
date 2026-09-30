import { NextResponse } from 'next/server';
import { isAuthenticated, getCurrentUserRole, getSessionSecret } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import { generateDecoyDatabaseBuffer } from '@/lib/decoy-engine';
import { encryptBufferAesGcm } from '@/lib/crypto-storage';
import fs from 'fs';
import path from 'path';

export async function GET(request?: Request) {
  const authed = await isAuthenticated();
  const role = await getCurrentUserRole();

  let isEncrypted = false;
  let customPassphrase: string | null = null;

  if (request) {
    try {
      const url = new URL(request.url);
      isEncrypted = url.searchParams.get('encrypted') === 'true' || url.searchParams.get('encrypted') === '1';
      customPassphrase = url.searchParams.get('passphrase')?.trim() || null;
    } catch {
      // Ignore URL parsing errors
    }
  }

  // Check if system is in breach containment or active deception mode
  let isLockdown = false;
  let isDeception = false;
  try {
    const settings = sqlite
      .prepare('SELECT lockdown_active, deception_mode_active FROM clinic_settings WHERE id = 1')
      .get() as { lockdown_active?: number; deception_mode_active?: number } | undefined;
    isLockdown = Boolean(settings?.lockdown_active);
    isDeception = Boolean(settings?.deception_mode_active);
  } catch {
    // Ignore schema mismatch
  }

  // If under breach containment or deception mode: feed false random synthetic data!
  if (isLockdown || isDeception) {
    const decoyBuffer = generateDecoyDatabaseBuffer();
    const today = new Date().toISOString().split('T')[0];
    let outputBuffer: Buffer = decoyBuffer;
    let filename = `medscript-backup-${today}.db`;
    let contentType = 'application/x-sqlite3';

    if (isEncrypted) {
      const passphrase = customPassphrase || getSessionSecret();
      outputBuffer = encryptBufferAesGcm(decoyBuffer, passphrase);
      filename = `medscript-backup-${today}.enc.db`;
      contentType = 'application/octet-stream';
    }

    await logAuditEvent({
      action: 'DECEPTION_DATA_SERVED',
      actorRole: role ? role.toUpperCase() : 'RECEPTIONIST',
      details: `Database export intercepted during breach containment. Served ${(outputBuffer.length / 1024).toFixed(1)} KB of synthetic honeypot records with embedded canary tokens.`,
      status: 'WARNING',
    });

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Security-Sentinel': 'ACTIVE-DECEPTION-ENGAGED',
        'X-Encryption-Standard': isEncrypted ? 'AES-256-GCM-SCRYPT' : 'none',
      },
    });
  }

  if (!authed || role !== 'admin_doctor') {
    await logAuditEvent({
      action: 'BACKUP_SNAPSHOT_DOWNLOADED',
      actorRole: role ? role.toUpperCase() : 'RECEPTIONIST',
      details: 'Unauthorized raw database download attempt blocked (Admin Doctor / CMO role required)',
      status: 'FAILURE',
    });
    return new NextResponse('Forbidden: Only the Chief Medical Officer (Admin Doctor) has authority to export raw clinical database archives.', {
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
    let outputBuffer: Buffer = fileBuffer;
    let filename = `medscript-backup-${today}.db`;
    let contentType = 'application/x-sqlite3';

    if (isEncrypted) {
      const passphrase = customPassphrase || getSessionSecret();
      outputBuffer = encryptBufferAesGcm(fileBuffer, passphrase);
      filename = `medscript-backup-${today}.enc.db`;
      contentType = 'application/octet-stream';
    }

    await logAuditEvent({
      action: 'BACKUP_SNAPSHOT_DOWNLOADED',
      details: isEncrypted
        ? `Encrypted live database backup downloaded (${(outputBuffer.length / 1024).toFixed(1)} KB, AES-256-GCM + scrypt derivation)`
        : `Live database backup downloaded (${(fileBuffer.length / 1024).toFixed(1)} KB, raw SQLite format)`,
      status: 'SUCCESS',
    });

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': outputBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Encryption-Standard': isEncrypted ? 'AES-256-GCM-SCRYPT' : 'none',
      },
    });
  } catch (err) {
    console.error('Backup download error:', err);
    return new NextResponse('Failed to generate backup file.', { status: 500 });
  }
}
