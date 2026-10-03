'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Check, Copy, ShieldCheck, ArrowRight } from 'lucide-react';
import { UpiPaymentDetails } from '@/types';

interface UpiDynamicQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  upiDetails: UpiPaymentDetails | null;
  onPaymentConfirmed?: () => void;
}

export function UpiDynamicQrModal({
  isOpen,
  onClose,
  upiDetails,
  onPaymentConfirmed,
}: UpiDynamicQrModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!upiDetails) return null;

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(upiDetails.vpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = () => {
    setConfirmed(true);
    setTimeout(() => {
      onPaymentConfirmed?.();
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-400" />
            Instant Bharat UPI Payment
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Scan using Google Pay, PhonePe, Paytm, BHIM, or any banking UPI app
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 flex flex-col items-center">
          {/* Amount Badge */}
          <div className="text-2xl font-black text-white tracking-wide">
            ₹{upiDetails.amount.toFixed(2)}
          </div>
          <span className="text-xs text-slate-400 font-mono mt-0.5">
            Ref: {upiDetails.transactionRef}
          </span>

          {/* QR Code Container */}
          <div className="mt-4 p-3 bg-white rounded-2xl shadow-xl border-4 border-indigo-600/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={upiDetails.qrPayload}
              alt="Dynamic UPI QR"
              className="w-56 h-56 object-contain rounded-lg"
            />
          </div>

          {/* VPA Details & Copy */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-indigo-400 truncate max-w-[200px]">{upiDetails.vpa}</span>
            <button
              onClick={handleCopyVpa}
              className="text-slate-400 hover:text-white p-1 rounded"
              title="Copy VPA"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Merchant: {upiDetails.merchantName}</span>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-800 text-slate-300 text-xs w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSimulatePayment}
            className={`text-xs w-full sm:w-auto ${
              confirmed
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {confirmed ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" /> Payment Received!
              </>
            ) : (
              <>
                Confirm Receipt <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
