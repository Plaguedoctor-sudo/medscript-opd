'use server';

import { isAuthenticated, getCurrentUserRole } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import fs from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';

export interface BackupItem {
  filename: string;
  sizeKb: string;
  createdAt: string;
}

export async function createManualBackupSnapshot(): Promise<{ success: boolean; message: string }> {
  const authed = await isAuthenticated();
  const role = await getCurrentUserRole();
  if (!authed || role !== 'doctor') {
    return { success: false, message: 'Forbidden: Only verified Doctor accounts can create database snapshots.' };
  }

  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const targetPath = path.join(backupsDir, `medscript-backup-${timestamp}.db`);

    await sqlite.backup(targetPath);

    // Enforce POSIX 0600 (owner read-write only)
    try {
      fs.chmodSync(targetPath, 0o600);
    } catch {
      // Ignore if on non-POSIX filesystem
    }

    await logAuditEvent({
      action: 'BACKUP_SNAPSHOT_CREATED',
      details: `Created snapshot: medscript-backup-${timestamp}.db`,
      status: 'SUCCESS',
    });

    revalidatePath('/settings');

    return {
      success: true,
      message: `Snapshot created: medscript-backup-${timestamp}.db`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown backup error';
    return { success: false, message: `Backup failed: ${msg}` };
  }
}

export async function getLocalBackupSnapshots(): Promise<BackupItem[]> {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(backupsDir)
      .filter((file) => file.startsWith('medscript-backup-') && file.endsWith('.db'))
      .map((file) => {
        const fullPath = path.join(backupsDir, file);
        const stats = fs.statSync(fullPath);
        return {
          filename: file,
          sizeKb: (stats.size / 1024).toFixed(1),
          createdAt: stats.mtime.toLocaleString(),
          mtimeMs: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 10);

    return files.map(({ filename, sizeKb, createdAt }) => ({
      filename,
      sizeKb,
      createdAt,
    }));
  } catch {
    return [];
  }
}

export async function exportAuditLogsCsvAction(): Promise<{ success: boolean; csv?: string; error?: string }> {
  const authed = await isAuthenticated();
  const role = await getCurrentUserRole();
  if (!authed || role !== 'doctor') {
    return { success: false, error: 'Forbidden: Only verified Doctor accounts can export clinical audit trails.' };
  }

  try {
    interface SqliteAuditRow {
      id: number;
      timestamp: number | string | null;
      action: string;
      actor_role?: string | null;
      details?: string | null;
      ip_address?: string | null;
      status?: string | null;
    }

    const logs = sqlite
      .prepare('SELECT id, timestamp, action, actor_role, details, ip_address, status FROM audit_logs ORDER BY timestamp DESC')
      .all() as SqliteAuditRow[];

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '""';
      let clean = String(str).replace(/"/g, '""');
      // Neutralize CSV formula injection (CWE-1236): prepend single quote if formula trigger
      if (/^[=+\-@\t\r]/.test(clean)) {
        clean = `'${clean}`;
      }
      return `"${clean}"`;
    };

    const header = 'ID,Timestamp,Action,Role,Status,Details,IP Address\n';
    const rows = logs.map((l) => [
      l.id,
      l.timestamp ? new Date(l.timestamp).toISOString() : '',
      escapeCsv(l.action),
      escapeCsv(l.actor_role || 'DOCTOR'),
      escapeCsv(l.status || 'SUCCESS'),
      escapeCsv(l.details),
      escapeCsv(l.ip_address || '127.0.0.1'),
    ].join(',')).join('\n');

    await logAuditEvent({
      action: 'DATA_EXPORT_CONSULTATIONS',
      actorRole: 'DOCTOR',
      details: `Clinical audit trail exported (${logs.length} events)`,
      status: 'SUCCESS',
    });

    return { success: true, csv: header + rows };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Export error';
    return { success: false, error: errorMsg };
  }
}
