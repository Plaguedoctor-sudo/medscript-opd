'use client';

import { useState } from 'react';
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, Key, Folder, Mail, Lock, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  saveGoogleDriveConfigAction,
  testGoogleDriveAction,
  triggerGoogleDriveBackupNowAction,
} from '@/app/settings/actions';
import { GoogleDriveBackupConfig } from '@/types';

interface GoogleDriveBackupCardProps {
  initialConfig: GoogleDriveBackupConfig;
}

export function GoogleDriveBackupCard({ initialConfig }: GoogleDriveBackupCardProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [clientEmail, setClientEmail] = useState(initialConfig.clientEmail || '');
  const [privateKey, setPrivateKey] = useState('');
  const [folderId, setFolderId] = useState(initialConfig.folderId || '');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [autoBackupInterval, setAutoBackupInterval] = useState<'DAILY' | 'TWICE_DAILY' | 'MANUAL'>(
    initialConfig.autoBackupInterval || 'DAILY'
  );

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastBackup, setLastBackup] = useState<{
    status: string | null;
    at: Date | null;
    fileId: string | null;
    fileName: string | null;
  }>({
    status: initialConfig.lastBackupStatus || null,
    at: initialConfig.lastBackupAt || null,
    fileId: initialConfig.lastBackupFileId || null,
    fileName: initialConfig.lastBackupFileName || null,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await saveGoogleDriveConfigAction({
        enabled,
        clientEmail,
        privateKey: privateKey || undefined,
        folderId,
        encryptionKey: encryptionKey || undefined,
        autoBackupInterval,
      });

      if (res.success) {
        setStatusMessage({ type: 'success', text: 'Google Drive backup settings saved successfully.' });
        if (privateKey) setPrivateKey(''); // clear key from memory
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to save settings.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusMessage(null);

    try {
      const res = await testGoogleDriveAction({
        clientEmail,
        privateKey: privateKey || undefined,
        folderId,
      });

      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: `Test failed: ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setStatusMessage(null);

    try {
      const res = await triggerGoogleDriveBackupNowAction();
      if (res.success) {
        setLastBackup({
          status: 'SUCCESS',
          at: res.uploadedAt || new Date(),
          fileId: res.fileId || null,
          fileName: res.fileName || null,
        });
        setStatusMessage({
          type: 'success',
          text: `Encrypted backup (${res.fileSizeKb} KB) successfully uploaded to Google Drive as "${res.fileName}"!`,
        });
      } else {
        setLastBackup((prev) => ({ ...prev, status: 'FAILURE' }));
        setStatusMessage({ type: 'error', text: res.error || 'Backup upload failed.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: `Backup failed: ${msg}` });
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
      <div className="p-6 border-b bg-gradient-to-r from-sky-50 to-indigo-50/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Google Drive Automated Cloud Backup
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  AES-256 Encrypted
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically archive encrypted clinical SQLite snapshots to offsite Google Drive storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
              <span className="ml-2 text-xs font-semibold text-slate-700">
                {enabled ? 'Active' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{statusMessage.text}</div>
          </div>
        )}

        {/* Current Cloud Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Last Cloud Backup</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {lastBackup.at ? new Date(lastBackup.at).toLocaleString('en-IN') : 'No backup recorded'}
            </div>
            {lastBackup.fileName && (
              <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{lastBackup.fileName}</div>
            )}
          </div>

          <div className="p-3.5 rounded-xl border bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Backup Status</div>
            <div className="mt-1 flex items-center gap-1.5">
              {lastBackup.status === 'SUCCESS' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Healthy & Verified
                </span>
              ) : lastBackup.status === 'FAILURE' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-3 h-3" /> Last Backup Failed
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-medium">Pending initial backup</span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Encryption Standard</div>
            <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              AES-256-GCM (Zero-Knowledge)
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Scrypt KDF memory-hard vault</div>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> Google Service Account Email
              </Label>
              <Input
                type="email"
                placeholder="e.g. medscript-backup@my-project.iam.gserviceaccount.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                From Google Cloud Console &gt; IAM &amp; Admin &gt; Service Accounts
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-slate-500" /> Target Google Drive Folder ID
              </Label>
              <Input
                type="text"
                placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="mt-1 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Copy the folder ID from the Google Drive URL. Share this folder with the service account email.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" /> Service Account Private Key (PEM format)
              </span>
              {initialConfig.hasPrivateKey && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Private Key already stored securely
                </span>
              )}
            </Label>
            <textarea
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEowIBAAKCAQEA...&#10;-----END RSA PRIVATE KEY-----"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Leave blank to keep existing stored key. Downloaded JSON key file contains `private_key`.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> Custom AES-256 Backup Encryption Passphrase
              </Label>
              <Input
                type="password"
                placeholder="Leave blank to use hospital dynamic vault key"
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                All SQLite database files are strongly encrypted before uploading to Google Drive.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Auto-Backup Frequency</Label>
              <select
                value={autoBackupInterval}
                onChange={(e) => setAutoBackupInterval(e.target.value as 'DAILY' | 'TWICE_DAILY' | 'MANUAL')}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="DAILY">Daily at Midnight (00:00 AM)</option>
                <option value="TWICE_DAILY">Twice Daily (Every 12 Hours)</option>
                <option value="MANUAL">Manual On-Demand Only</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Scheduled background sync triggers automatically without interrupting clinical work.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing || (!clientEmail && !initialConfig.clientEmail)}
                className="gap-1.5 text-xs text-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Testing OAuth2...' : 'Test Connection'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleBackupNow}
                disabled={backingUp || (!clientEmail && !initialConfig.clientEmail)}
                className="gap-1.5 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
              >
                <Cloud className={`w-3.5 h-3.5 ${backingUp ? 'animate-bounce' : ''}`} />
                {backingUp ? 'Encrypting & Uploading...' : 'Backup Now to Google Drive'}
              </Button>
            </div>

            <Button type="submit" size="sm" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-xs">
              {saving ? 'Saving...' : 'Save Cloud Settings'}
            </Button>
          </div>
        </form>

        {/* Quick Setup Instructions Collapsible */}
        <div className="p-4 rounded-xl bg-slate-50 border text-xs text-slate-600 space-y-2">
          <div className="font-semibold text-slate-900 flex items-center justify-between">
            <span>How to configure Google Cloud Service Account in 3 minutes:</span>
            <a
              href="https://console.cloud.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 hover:underline inline-flex items-center gap-1 font-normal text-[11px]"
            >
              Google Cloud Console <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
            <li>Create a project in Google Cloud Console and enable the <strong>Google Drive API</strong>.</li>
            <li>Go to <strong>IAM &amp; Admin &gt; Service Accounts</strong>, click <em>Create Service Account</em>, and create a key in JSON format.</li>
            <li>Open the downloaded JSON file: copy `client_email` and `private_key` into the fields above.</li>
            <li>Create a folder in your personal or hospital Google Drive, click <strong>Share</strong>, and add the Service Account email with <strong>Editor</strong> permissions.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
