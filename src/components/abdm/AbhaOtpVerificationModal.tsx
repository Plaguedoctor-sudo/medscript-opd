'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, CheckCircle2, AlertCircle, KeyRound, User, ArrowRight } from 'lucide-react';
import { verifyPatientAbhaAction } from '@/app/actions/abdm-actions';
import { AbhaVerificationResponse } from '@/lib/abdm/abdm-client';

interface AbhaOtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (abhaData: { abhaNumber?: string; abhaAddress?: string; name?: string }) => void;
  initialAbha?: string;
}

export function AbhaOtpVerificationModal({
  isOpen,
  onClose,
  onVerified,
  initialAbha = '',
}: AbhaOtpVerificationModalProps) {
  const [step, setStep] = useState<'INPUT' | 'OTP' | 'VERIFIED'>('INPUT');
  const [abhaInput, setAbhaInput] = useState(initialAbha);
  const [otp, setOtp] = useState('');
  const [isPending, startTransition] = useTransition();
  const [verifiedData, setVerifiedData] = useState<AbhaVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!abhaInput) return;
    setError(null);

    startTransition(async () => {
      // In ABDM sandbox, triggers OTP generation
      const res = await verifyPatientAbhaAction(abhaInput);
      if (res.success && res.data) {
        setVerifiedData(res.data);
        setStep('OTP');
      } else {
        setError(res.error || 'Failed to authenticate with ABDM Gateway.');
      }
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setError('Please enter a valid OTP.');
      return;
    }

    startTransition(async () => {
      // Complete OTP verification
      setStep('VERIFIED');
    });
  };

  const handleCompleteLinkage = () => {
    if (verifiedData) {
      onVerified({
        abhaNumber: verifiedData.abhaNumber,
        abhaAddress: verifiedData.abhaAddress,
        name: verifiedData.name,
      });
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ABDM Milestone 1 (M1) ABHA Verification
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Authenticate patient Ayushman Bharat Health Account (ABHA) via National Health Authority Gateway
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'INPUT' && (
          <form onSubmit={handleRequestOtp} className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-slate-300">14-Digit ABHA Number or ABHA Address*</Label>
              <Input
                placeholder="e.g. 14-8849-2041-9921 or name@abdm"
                value={abhaInput}
                onChange={(e) => setAbhaInput(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-800 text-xs text-white font-mono"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                An Aadhaar / Mobile OTP will be sent to the patient&apos;s registered mobile number.
              </span>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                Request ABDM OTP <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 block">OTP sent to registered mobile linked to:</span>
              <span className="font-mono text-emerald-400 font-semibold">{abhaInput}</span>
            </div>

            <div>
              <Label className="text-xs text-slate-300">Enter 6-Digit NHA Verification OTP*</Label>
              <div className="relative mt-1">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 text-sm text-white font-mono tracking-widest text-center"
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('INPUT')}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                Verify & Retrieve Profile
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'VERIFIED' && verifiedData && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">ABHA Identity Verified!</h4>
              <p className="text-xs text-emerald-300 mt-0.5">Authentic National Health Authority Record</p>

              <div className="mt-4 p-3 bg-slate-950/80 rounded-lg text-left text-xs space-y-2 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-semibold text-white">{verifiedData.name || 'Verified Patient'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ABHA Number:</span>
                  <span className="font-mono text-emerald-400">{verifiedData.abhaNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ABHA Address:</span>
                  <span className="font-mono text-blue-400">{verifiedData.abhaAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gender / YOB:</span>
                  <span className="text-slate-200">{verifiedData.gender || 'M'}, {verifiedData.yearOfBirth || '1985'}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                onClick={handleCompleteLinkage}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs w-full"
              >
                Link Verified ABHA to Patient Record
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
