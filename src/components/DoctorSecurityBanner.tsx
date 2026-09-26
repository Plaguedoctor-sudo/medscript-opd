'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, CheckCircle2, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { acknowledgeAlertAction, triggerEmergencyLockdownAction } from '@/app/actions/security-alert-actions';
import { toast } from './ui/toast';
import type { SecurityAlertItem } from '@/lib/security-engine';

export function DoctorSecurityBanner({
  activeAlerts,
}: {
  activeAlerts: SecurityAlertItem[];
}) {
  const [alerts, setAlerts] = useState<SecurityAlertItem[]>(activeAlerts);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || alerts.length === 0) {
    return null;
  }

  const primaryAlert = alerts[0];
  const isCritical = alerts.some((a) => a.severity === 'CRITICAL');

  const handleAcknowledge = async (id: number) => {
    try {
      const res = await acknowledgeAlertAction(id);
      if (res.success) {
        toast.show({
          title: 'Threat Acknowledged',
          description: 'Security incident acknowledged by doctor.',
          type: 'success',
        });
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in ${
        isCritical
          ? 'bg-red-50/90 border-red-300 text-red-900 ring-1 ring-red-400/20'
          : 'bg-amber-50/90 border-amber-300 text-amber-900 ring-1 ring-amber-400/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg shrink-0 mt-0.5 ${
            isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isCritical ? (
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isCritical ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              Security Alert ({alerts.length})
            </span>
            <span className="font-semibold text-sm">{primaryAlert.title}</span>
          </div>
          <p className="text-xs mt-1 leading-relaxed max-w-3xl opacity-90">
            {primaryAlert.description}
          </p>
          {primaryAlert.ipAddress && (
            <div className="mt-1 text-[11px] font-mono opacity-75">
              Source IP: {primaryAlert.ipAddress} • Category: {primaryAlert.category}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
        {isCritical && (
          <Button
            size="sm"
            onClick={async () => {
              if (
                confirm(
                  'Trigger Emergency Breach Containment & System Lockdown? Clinical mutations will be contained and Honeypot Decoy Mode armed.'
                )
              ) {
                const res = await triggerEmergencyLockdownAction(
                  `Manual Doctor Containment for: ${primaryAlert.title}`,
                  true
                );
                if (res.success) {
                  window.location.reload();
                }
              }
            }}
            className="text-xs bg-slate-950 hover:bg-black text-rose-300 border border-rose-500 font-bold shadow-xs"
          >
            <Lock className="w-3.5 h-3.5 mr-1 text-rose-400" />
            Contain & Lockdown
          </Button>
        )}

        <Button
          size="sm"
          onClick={() => handleAcknowledge(primaryAlert.id)}
          className={`text-xs ${
            isCritical
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Acknowledge
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
