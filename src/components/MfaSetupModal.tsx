'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Key,
  Copy,
  Check,
  Download,
  X,
  Loader2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from './ui/toast';
import { setupMfaAction, confirmAndEnableMfaAction, disableMfaAction } from '@/app/login/actions';

interface MfaSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  mfaEnabled: boolean;
  onStatusChange?: (enabled: boolean) => void;
}

export function MfaSetupModal({
  isOpen,
  onClose,
  mfaEnabled,
  onStatusChange,
}: MfaSetupModalProps) {
  // Setup Flow State
  const [secret, setSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [hashedBackupCodes, setHashedBackupCodes] = useState<string[]>([]);
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Verification & Disable State
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePin, setDisablePin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, startVerifyingTransition] = useTransition();
  const [isDisabling, startDisablingTransition] = useTransition();

  const loadingSetup = !mfaEnabled && !secret && !errorMessage;

  const handleClose = () => {
    setVerificationCode('');
    setDisablePin('');
    setErrorMessage(null);
    setShowManualKey(false);
    onClose();
  };

  // Load TOTP secret and QR code when opening the modal if MFA is not enabled yet
  useEffect(() => {
    let ignore = false;
    if (isOpen && !mfaEnabled && !secret) {
      setupMfaAction()
        .then((res) => {
          if (!ignore) {
            if (res.success && res.secret && res.qrCodeDataUrl && res.backupCodes && res.hashedBackupCodes) {
              setSecret(res.secret);
              setQrCodeDataUrl(res.qrCodeDataUrl);
              setBackupCodes(res.backupCodes);
              setHashedBackupCodes(res.hashedBackupCodes);
            } else {
              setErrorMessage('Failed to initialize MFA engine.');
            }
          }
        })
        .catch(() => {
          if (!ignore) {
            setErrorMessage('Could not initialize offline TOTP service.');
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, mfaEnabled, secret]);

  if (!isOpen) return null;

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
      toast.show({
        title: 'Secret Key Copied',
        description: 'Manual secret key copied to clipboard.',
        type: 'info',
      });
    } catch {
      // Fallback
    }
  };

  const handleCopyBackupCodes = async () => {
    try {
      const text = `MedScript-OPD Emergency Recovery Backup Codes:\n${backupCodes.join('\n')}\nKeep these codes safe and offline.`;
      await navigator.clipboard.writeText(text);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
      toast.show({
        title: 'Backup Codes Copied',
        description: '5 Emergency backup codes copied to clipboard.',
        type: 'info',
      });
    } catch {
      // Fallback
    }
  };

  const handleDownloadBackupCodes = () => {
    const text = [
      '====================================================',
      'MEDSCRIPT-OPD EMERGENCY RECOVERY BACKUP CODES',
      `Date Generated: ${new Date().toLocaleString()}`,
      '====================================================',
      '',
      'INSTRUCTIONS:',
      'If you lose access to your Authenticator App, you can',
      'use each of the following 5 single-use codes to log into',
      'your Consultation Desk as Doctor.',
      '',
      ...backupCodes.map((code, idx) => `[ Code ${idx + 1} ]: ${code}`),
      '',
      '====================================================',
      'Store this file in an offline encrypted vault or print it.',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medscript-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVerifyAndEnable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length < 6) {
      setErrorMessage('Please enter the 6-digit code shown on your authenticator app.');
      return;
    }

    setErrorMessage(null);
    startVerifyingTransition(async () => {
      const res = await confirmAndEnableMfaAction(secret, verificationCode.trim(), hashedBackupCodes);
      if (res.success) {
        toast.show({
          title: 'Two-Factor Authentication Active',
          description: res.message,
          type: 'success',
        });
        onStatusChange?.(true);
        handleClose();
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  const handleDisableMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePin) {
      setErrorMessage('Please enter your Doctor PIN to confirm deactivation.');
      return;
    }

    setErrorMessage(null);
    startDisablingTransition(async () => {
      const res = await disableMfaAction(disablePin.trim());
      if (res.success) {
        toast.show({
          title: 'MFA Deactivated',
          description: res.message,
          type: 'info',
        });
        setSecret('');
        onStatusChange?.(false);
        handleClose();
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${mfaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {mfaEnabled ? 'Two-Factor Authentication (2FA) Status' : 'Configure Multi-Factor Authentication'}
              </h3>
              <p className="text-[11px] text-slate-500">
                RFC 6238 TOTP Standard • 100% Offline Sovereign Security
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {mfaEnabled ? (
            /* ACTIVE MFA MANAGEMENT VIEW */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-900 text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  MFA Protection Is Currently Active
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Doctor logins are verified using both your Doctor PIN and a time-based 6-digit one-time passcode from your authenticator application.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  Authenticator Sync
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Compatible with Google Authenticator, Microsoft Authenticator, Aegis, 2FAS, Bitwarden, or any standard TOTP hardware token.
                </p>
              </div>

              {/* Disable MFA Section */}
              <form onSubmit={handleDisableMfa} className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                <div className="font-semibold text-rose-900 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Deactivate Two-Factor Authentication
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Enter your Doctor Master PIN below to deactivate 2FA. Re-enabling will require scanning a new QR code.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="disablePin" className="text-xs font-medium text-slate-700">
                    Doctor Master PIN
                  </Label>
                  <Input
                    id="disablePin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={disablePin}
                    onChange={(e) => setDisablePin(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Enter Doctor PIN"
                    className="font-mono text-center tracking-widest bg-white"
                  />
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isDisabling || !disablePin}
                  className="w-full h-9 text-xs font-semibold gap-1.5"
                >
                  {isDisabling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying PIN...
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" /> Confirm Deactivation
                    </>
                  )}
                </Button>
              </form>
            </div>
          ) : (
            /* INITIAL MFA SETUP FLOW */
            <div className="space-y-5">
              {loadingSetup ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                  <p className="text-xs">Generating offline TOTP cryptographic keypair...</p>
                </div>
              ) : (
                <>
                  {/* Step 1: Scan QR Code */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 border-b pb-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      <span>Scan QR Code in Authenticator App</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Open Google Authenticator, Aegis, 2FAS, or Bitwarden on your smartphone and scan this barcode:
                    </p>

                    <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      {qrCodeDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrCodeDataUrl}
                          alt="Two-Factor QR Code"
                          className="w-44 h-44 rounded-lg border border-slate-100 p-1"
                        />
                      ) : (
                        <div className="w-44 h-44 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          QR Unavailable
                        </div>
                      )}

                      <div className="mt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setShowManualKey(!showManualKey)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium underline"
                        >
                          {showManualKey ? 'Hide manual secret key' : 'Cannot scan barcode? Enter key manually'}
                        </button>

                        {showManualKey && (
                          <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2 max-w-xs mx-auto">
                            <span className="font-mono text-[11px] font-bold tracking-wider text-slate-800 break-all select-all">
                              {secret}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyKey}
                              className="h-7 w-7 p-0 shrink-0 text-slate-500 hover:text-indigo-600"
                            >
                              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Emergency Recovery Backup Codes */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 border-b pb-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                      <span>Save Emergency Backup Recovery Codes</span>
                    </div>
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-950 text-[11px] flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-amber-600" />
                          5 Single-Use Offline Recovery Codes
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyBackupCodes}
                            className="h-6 text-[10px] px-2 gap-1 text-amber-900 hover:bg-amber-100"
                          >
                            {copiedCodes ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleDownloadBackupCodes}
                            className="h-6 text-[10px] px-2 gap-1 text-amber-900 hover:bg-amber-100"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                        {backupCodes.map((code, idx) => (
                          <div
                            key={idx}
                            className="bg-white/90 border border-amber-200/90 rounded px-2 py-1 text-center font-mono text-[11px] font-bold text-slate-800 select-all"
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-800 leading-tight">
                        Keep these codes in a safe offline location. If your phone is lost or damaged, each code will unlock the consultation desk once.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Confirmation Form */}
                  <form onSubmit={handleVerifyAndEnable} className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 border-b pb-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                      <span>Verify Authenticator Code to Activate</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="verificationCode" className="text-xs font-medium">
                        Enter the 6-digit code currently shown on your phone
                      </Label>
                      <Input
                        id="verificationCode"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="123456"
                        className="font-mono text-center text-lg tracking-widest bg-white h-11"
                        autoFocus
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isVerifying || verificationCode.length < 6}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-10 gap-2 shadow-xs"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" /> Activate Two-Factor Authentication
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
          <span>Standard RFC 6238 TOTP (SHA1, 30s period)</span>
          <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs text-slate-600">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
