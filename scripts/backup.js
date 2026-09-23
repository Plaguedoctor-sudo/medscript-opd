/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dbPath = process.env.DATABASE_PATH || path.join(projectRoot, 'sqlite.db');
const backupsDir = path.join(projectRoot, 'backups');
const MAX_BACKUPS = 30; // Keep last 30 backups

async function performBackup() {
  const startTime = Date.now();
  console.log('--- MedScript OPD Automated Backup ---');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Source Database: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Source database does not exist at ${dbPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
    console.log(`Created backup directory: ${backupsDir}`);
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const targetBackupPath = path.join(backupsDir, `medscript-backup-${timestamp}.db`);

  const db = new Database(dbPath);

  try {
    console.log(`Creating atomic backup to: ${targetBackupPath}...`);
    // better-sqlite3 native async backup
    await db.backup(targetBackupPath);

    const stats = fs.statSync(targetBackupPath);
    const sizeKb = (stats.size / 1024).toFixed(1);
    const durationMs = Date.now() - startTime;

    console.log(`✓ Backup successfully created! (${sizeKb} KB in ${durationMs}ms)`);

    // Prune old backups if count > MAX_BACKUPS
    const backupFiles = fs
      .readdirSync(backupsDir)
      .filter((file) => file.startsWith('medscript-backup-') && file.endsWith('.db'))
      .map((file) => ({
        name: file,
        fullPath: path.join(backupsDir, file),
        time: fs.statSync(path.join(backupsDir, file)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (backupFiles.length > MAX_BACKUPS) {
      console.log(`Rotating backups (keeping newest ${MAX_BACKUPS})...`);
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      for (const item of filesToDelete) {
        fs.unlinkSync(item.fullPath);
        console.log(`- Pruned older backup: ${item.name}`);
      }
    }

    console.log(`Total retained backups: ${Math.min(backupFiles.length, MAX_BACKUPS)}`);
    console.log('--------------------------------------');
  } catch (err) {
    console.error('Backup failed with error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

performBackup();
