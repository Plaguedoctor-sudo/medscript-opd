import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import { getSessionSecret } from '@/lib/auth';
import { decryptPhi, encryptBufferAesGcm } from '@/lib/crypto-storage';
export { encryptBufferAesGcm };

export interface GoogleDriveConfigInput {
  clientEmail: string;
  privateKey: string;
  folderId?: string;
  encryptionKey?: string;
  autoBackupInterval?: 'DAILY' | 'TWICE_DAILY' | 'MANUAL';
  enabled?: boolean;
}

export interface GoogleDriveBackupResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  fileSizeKb?: number;
  uploadedAt?: Date;
  error?: string;
}

/**
 * Creates a signed JWT for Google Service Account OAuth2 exchange.
 */
function createServiceAccountJwt(clientEmail: string, privateKeyPem: string): string {
  // Normalize private key if escaped newlines are present
  const cleanKey = privateKeyPem.includes('\\n')
    ? privateKeyPem.replace(/\\n/g, '\n')
    : privateKeyPem;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaim = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(cleanKey, 'base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Exchanges signed service account JWT for Google OAuth2 Bearer Access Token.
 */
export async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = createServiceAccountJwt(clientEmail, privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google OAuth2 Token Exchange Failed (${res.status}): ${errorBody}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Google OAuth2 response did not contain an access_token');
  }

  return data.access_token;
}

/**
 * Tests connection to Google Drive using provided credentials.
 */
export async function testGoogleDriveConnection(config: {
  clientEmail: string;
  privateKey: string;
  folderId?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!config.clientEmail || !config.privateKey) {
      return { success: false, message: 'Client email and private key are required.' };
    }

    const token = await getGoogleAccessToken(config.clientEmail, config.privateKey);

    if (config.folderId && config.folderId.trim()) {
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.folderId.trim())}?fields=id,name,mimeType`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!folderRes.ok) {
        return {
          success: false,
          message: `Authenticated with Google, but unable to access Folder ID "${config.folderId}". Verify the folder exists and is shared with ${config.clientEmail}`,
        };
      }

      const folderData = (await folderRes.json()) as { name?: string };
      return {
        success: true,
        message: `Successfully connected to Google Drive! Target folder: "${folderData.name || config.folderId}".`,
      };
    }

    return {
      success: true,
      message: 'Successfully authenticated with Google Drive Service Account.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Connection test failed: ${msg}` };
  }
}

/**
 * Executes a full encrypted backup of the SQLite database and uploads it to Google Drive.
 */
export async function backupDatabaseToGoogleDrive(options?: {
  encryptionPassphrase?: string;
  actorRole?: string;
}): Promise<GoogleDriveBackupResult> {
  const dbPath = path.resolve(process.cwd(), 'sqlite.db');

  try {
    // 1. Fetch Google Drive credentials from clinic_settings
    const settings = sqlite
      .prepare(`
        SELECT
          gdrive_backup_enabled as enabled,
          gdrive_folder_id as folderId,
          gdrive_client_email as clientEmail,
          gdrive_private_key as privateKey,
          gdrive_encryption_key as encryptionKey,
          session_secret as sessionSecret,
          clinic_name as clinicName
        FROM clinic_settings
        WHERE id = 1
      `)
      .get() as {
        enabled?: number;
        folderId?: string | null;
        clientEmail?: string | null;
        privateKey?: string | null;
        encryptionKey?: string | null;
        sessionSecret?: string | null;
        clinicName?: string | null;
      } | undefined;

    const effectivePrivateKey = settings?.privateKey ? decryptPhi(settings.privateKey) : '';
    if (!settings || !settings.clientEmail || !effectivePrivateKey) {
      throw new Error(
        'Google Drive backup is not configured. Please supply Service Account Client Email and Private Key in Settings.'
      );
    }

    // 2. Obtain OAuth2 access token
    const token = await getGoogleAccessToken(settings.clientEmail, effectivePrivateKey);

    // 3. Checkpoint SQLite WAL and read database file snapshot safely
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Ignore checkpoint error if busy
    }

    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found at ${dbPath}`);
    }

    const rawBuffer = fs.readFileSync(dbPath);
    const decryptedSettingsKey = settings.encryptionKey ? decryptPhi(settings.encryptionKey) : '';
    const passphrase =
      options?.encryptionPassphrase?.trim() ||
      decryptedSettingsKey.trim() ||
      settings.sessionSecret ||
      getSessionSecret();

    // 4. Encrypt database with AES-256-GCM
    const encryptedBuffer = encryptBufferAesGcm(rawBuffer, passphrase);
    const sizeKb = Math.round(encryptedBuffer.length / 1024);

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `medscript-backup-${timestampStr}.enc.db`;

    // 5. Construct Multipart Upload to Google Drive API v3
    const metadata: { name: string; mimeType: string; parents?: string[]; description?: string } = {
      name: fileName,
      mimeType: 'application/octet-stream',
      description: `MedScript OPD Encrypted Clinical Database Backup (AES-256-GCM) generated on ${now.toISOString()}`,
    };

    if (settings.folderId && settings.folderId.trim()) {
      metadata.parents = [settings.folderId.trim()];
    }

    const boundary = `-------medscript_boundary_${Date.now()}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(
        delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/octet-stream\r\n\r\n'
      ),
      encryptedBuffer,
      Buffer.from(closeDelimiter),
    ]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(multipartBody.length),
        },
        body: multipartBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Google Drive Upload HTTP ${uploadRes.status}: ${errText}`);
    }

    const uploadData = (await uploadRes.json()) as { id: string; name: string };
    const uploadedAt = new Date();

    // 6. Update database settings with last backup status
    sqlite
      .prepare(`
        UPDATE clinic_settings
        SET
          gdrive_last_backup_at = ?,
          gdrive_last_backup_status = 'SUCCESS',
          gdrive_last_backup_file_id = ?,
          gdrive_last_backup_file_name = ?
        WHERE id = 1
      `)
      .run(uploadedAt.getTime(), uploadData.id, fileName);

    await logAuditEvent({
      action: 'GOOGLE_DRIVE_BACKUP_COMPLETED',
      actorRole: options?.actorRole || 'SYSTEM',
      details: `Automated encrypted database snapshot (${sizeKb} KB) uploaded to Google Drive. File ID: ${uploadData.id}, Name: ${fileName}`,
      status: 'SUCCESS',
    });

    return {
      success: true,
      fileId: uploadData.id,
      fileName,
      fileSizeKb: sizeKb,
      uploadedAt,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Record failure in settings and audit logs
    try {
      sqlite
        .prepare(`
          UPDATE clinic_settings
          SET
            gdrive_last_backup_at = ?,
            gdrive_last_backup_status = 'FAILURE'
          WHERE id = 1
        `)
        .run(Date.now());

      await logAuditEvent({
        action: 'GOOGLE_DRIVE_BACKUP_FAILED',
        actorRole: options?.actorRole || 'SYSTEM',
        details: `Cloud backup failed: ${errorMsg}`,
        status: 'FAILURE',
      });
    } catch {}

    return {
      success: false,
      error: errorMsg,
    };
  }
}
