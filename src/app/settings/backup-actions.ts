'use server';

import { isAuthenticated } from '@/lib/auth';
import { sqlite } from '@/db';
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
  if (!authed) {
    return { success: false, message: 'Unauthorized. Please unlock the desk first.' };
  }

  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const targetPath = path.join(backupsDir, `medscript-backup-${timestamp}.db`);

    await sqlite.backup(targetPath);
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
