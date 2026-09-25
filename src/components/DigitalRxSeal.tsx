'use client';

import React, { useState, useTransition } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { Button } from './ui/button';
import { verifyPrescriptionIntegrityAction } from '@/app/prescription/new/actions';

interface DigitalRxSealProps {
  prescriptionId: number;
  initialSignatureHash?: string | null;
}

export function DigitalRxSeal({ prescriptionId, initialSignatureHash }: DigitalRxSealProps) {
  const [verification, setVerification] = useState<{
    verified: boolean;
    valid?: boolean;
    sealCode?: string;
    doctorRegNo?: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleVerify = () => {
    startTransition(async () => {
      try {
        const res = await verifyPrescriptionIntegrityAction(prescriptionId);
        setVerification({
          verified: true,
          valid: res.valid,
          sealCode: res.sealCode,
          doctorRegNo: res.doctorRegNo,
        });
      } catch {
        setVerification({
          verified: true,
          valid: false,
        });
      }
    });
  };

  const sealDisplay = initialSignatureHash
    ? `MS-${initialSignatureHash.slice(0, 4).toUpperCase()}-${initialSignatureHash.slice(4, 8).toUpperCase()}-${initialSignatureHash.slice(8, 12).toUpperCase()}`
    : `RX-${prescriptionId}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>Cryptographic Tamper-Evidence Seal</span>
              <span className="font-mono text-[11px] bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                {sealDisplay}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              HMAC-SHA256 digital signature binds doctor registration, patient records, and medications.
            </div>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleVerify}
          disabled={isPending}
          className="gap-1.5 text-xs h-8 bg-white border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Verify Tamper-Evidence
            </>
          )}
        </Button>
      </div>

      {verification?.verified && (
        <div
          className={`p-2.5 rounded-lg border flex items-center justify-between text-xs animate-in fade-in duration-150 ${
            verification.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {verification.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <div>
              <span className="font-bold">
                {verification.valid ? 'Cryptographically Authentic' : 'Tamper Alert: Integrity Check Failed!'}
              </span>
              <p className="text-[11px] opacity-90">
                {verification.valid
                  ? `Clinical records match signed digital seal (${verification.sealCode}). Authorized under Doctor Reg: ${verification.doctorRegNo}.`
                  : 'Database records do not match original digital seal. Clinical data may have been altered.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
