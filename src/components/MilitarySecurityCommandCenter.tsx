'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Radio,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCw,
  Flame,
  Search,
  CheckCircle2,
  XCircle,
  FileCheck,
  Ban,
  UserCheck,
  Terminal,
  Activity,
} from 'lucide-react';
import { DefconThreatStatus, QuarantinedIpRecord, FleetIntegrityReport, DefconLevel } from '@/types';
import {
  setDefconLevelAction,
  runFleetIntegritySweepAction,
  pardonQuarantinedIpAction,
  quarantineIpManualAction,
  runSecurityDrillAction,
} from '@/app/settings/military-actions';

function Badge({
  children,
  className = '',
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: string;
}) {
  const variantClass =
    variant === 'destructive'
      ? 'bg-rose-600 text-white'
      : variant === 'outline'
      ? 'border border-slate-300 text-slate-700'
      : variant === 'secondary'
      ? 'bg-slate-200 text-slate-800'
      : 'bg-slate-900 text-white';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${variantClass} ${className}`}>
      {children}
    </span>
  );
}

interface MilitarySecurityCommandCenterProps {
  initialDefcon: DefconThreatStatus;
  initialQuarantinedIps: QuarantinedIpRecord[];
  isAdmin: boolean;
}

export function MilitarySecurityCommandCenter({
  initialDefcon,
  initialQuarantinedIps,
  isAdmin,
}: MilitarySecurityCommandCenterProps) {
  const [defcon, setDefcon] = useState<DefconThreatStatus>(initialDefcon);
  const [quarantinedIps, setQuarantinedIps] = useState<QuarantinedIpRecord[]>(initialQuarantinedIps);
  const [integrityReport, setIntegrityReport] = useState<FleetIntegrityReport | null>(null);
  const [isPending, startTransition] = useTransition();

  // Manual DEFCON change state
  const [targetDefcon, setTargetDefcon] = useState<DefconLevel>(defcon.level);
  const [overrideReason, setOverrideReason] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [manualIpReason, setManualIpReason] = useState('');

  // Handle DEFCON Manual Override
  const handleDefconOverride = () => {
    if (!overrideReason.trim()) {
      toast.error('Reason Required', 'Provide a military justification for changing the defense posture.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await setDefconLevelAction(targetDefcon, overrideReason);
        if (res.success) {
          toast.success(
            `DEFCON ${targetDefcon} Enforced`,
            `Defense posture successfully updated: ${overrideReason}`
          );
          setDefcon((prev) => ({ ...prev, level: targetDefcon }));
          setOverrideReason('');
        }
      } catch (err: any) {
        toast.error('DEFCON Change Failed', err.message);
      }
    });
  };

  // Run Fleet-Wide Cryptographic Sweep
  const handleRunIntegritySweep = () => {
    startTransition(async () => {
      try {
        const report = await runFleetIntegritySweepAction();
        setIntegrityReport(report);
        if (report.overallIntact) {
          toast.success(
            'Fleet Cryptographic Sweep: 100% INTACT',
            `Verified ${report.totalArtifactsChecked} records. Zero tampering detected.`
          );
        } else {
          toast.error(
            'CRITICAL: Cryptographic Tampering Detected',
            `Found ${report.totalTamperedCount} tampered records!`
          );
        }
      } catch (err: any) {
        toast.error('Integrity Sweep Failed', err.message);
      }
    });
  };

  // Pardon Quarantined IP
  const handlePardonIp = (ipAddress: string) => {
    startTransition(async () => {
      try {
        const res = await pardonQuarantinedIpAction(ipAddress);
        if (res.success) {
          toast.success(
            'Quarantine Lifted',
            `Host IP ${ipAddress} has been pardoned.`
          );
          setQuarantinedIps((prev) => prev.filter((q) => q.ipAddress !== ipAddress));
        }
      } catch (err: any) {
        toast.error('Pardon Failed', err.message);
      }
    });
  };

  // Manually Quarantine Host IP
  const handleManualQuarantine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim() || !manualIpReason.trim()) {
      toast.error('IP and Reason Required', 'Provide an IP address and violation justification.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await quarantineIpManualAction(manualIp.trim(), manualIpReason.trim());
        if (res.success) {
          toast.success('Host Quarantined', `Host ${manualIp} is now blacklisted.`);
          setQuarantinedIps((prev) => [
            {
              id: Date.now(),
              ipAddress: manualIp.trim(),
              reason: manualIpReason.trim(),
              violationCount: 1,
              quarantinedAt: new Date(),
            },
            ...prev,
          ]);
          setManualIp('');
          setManualIpReason('');
        }
      } catch (err: any) {
        toast.error('Quarantine Failed', err.message);
      }
    });
  };

  // Run Security Simulation Drill
  const handleRunDrill = (type: 'sqli_probe' | 'xss_probe' | 'tamper_probe' | 'brute_force_probe') => {
    startTransition(async () => {
      try {
        const res = await runSecurityDrillAction(type);
        toast.success('Security Drill Executed', res.message);
        if (res.quarantined) {
          setDefcon((prev) => ({
            ...prev,
            quarantineCount: prev.quarantineCount + 1,
          }));
        }
      } catch (err: any) {
        toast.error('Drill Execution Failed', err.message);
      }
    });
  };

  // Color mappings for DEFCON levels
  const getDefconColor = (level: DefconLevel) => {
    switch (level) {
      case 1:
        return 'bg-red-950 text-red-100 border-red-800';
      case 2:
        return 'bg-orange-950 text-orange-100 border-orange-800';
      case 3:
        return 'bg-amber-950 text-amber-100 border-amber-800';
      case 4:
        return 'bg-blue-950 text-blue-100 border-blue-800';
      case 5:
        return 'bg-emerald-950 text-emerald-100 border-emerald-800';
    }
  };

  const getDefconBadge = (level: DefconLevel) => {
    switch (level) {
      case 1:
        return 'bg-red-600 text-white animate-pulse';
      case 2:
        return 'bg-orange-600 text-white';
      case 3:
        return 'bg-amber-600 text-white';
      case 4:
        return 'bg-blue-600 text-white';
      case 5:
        return 'bg-emerald-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. DEFCON THREAT READINESS RADAR */}
      <Card className={`border-2 shadow-lg overflow-hidden ${getDefconColor(defcon.level)}`}>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs flex items-center justify-center">
                <Radio className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-mono opacity-80">
                    DoD Cyber Command Threat Matrix
                  </span>
                  <Badge className={`font-mono text-xs px-2.5 py-0.5 font-bold ${getDefconBadge(defcon.level)}`}>
                    DEFCON {defcon.level}
                  </Badge>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">
                  {defcon.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs opacity-75 block font-mono">THREAT SEVERITY SCORE</span>
                <span className="text-2xl font-black font-mono tracking-tight text-white">
                  {defcon.threatScore} / 100
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            {/* Indicators */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider font-mono opacity-80 block">
                Active Threat Indicators
              </span>
              <ul className="space-y-1.5 text-xs">
                {defcon.indicators.map((ind, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span className="opacity-90">{ind}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tactical Directives */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider font-mono opacity-80 block">
                Standing Defensive Directive
              </span>
              <p className="text-xs leading-relaxed opacity-90 bg-white/5 p-3 rounded-lg border border-white/10">
                {defcon.recommendation}
              </p>
            </div>

            {/* Perimeter Summary */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider font-mono opacity-80 block">
                Perimeter Defense Status
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/10">
                  <span className="opacity-70 block text-[10px]">QUARANTINED IPS</span>
                  <span className="text-lg font-bold font-mono text-white">{defcon.quarantineCount}</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/10">
                  <span className="opacity-70 block text-[10px]">SYSTEM LOCKDOWN</span>
                  <span className={`text-sm font-bold font-mono ${defcon.lockdownActive ? 'text-red-400' : 'text-emerald-400'}`}>
                    {defcon.lockdownActive ? 'ARMED' : 'STANDBY'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Override Bar */}
          {isAdmin && (
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-white/90 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" /> Manual DEFCON Override (Admin Doctor Authorized)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={targetDefcon}
                  onChange={(e) => setTargetDefcon(Number(e.target.value) as DefconLevel)}
                  className="bg-black/30 text-white border border-white/20 rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-hidden"
                >
                  <option value={5}>DEFCON 5 (Normal Clinical)</option>
                  <option value={4}>DEFCON 4 (Guarded Monitoring)</option>
                  <option value={3}>DEFCON 3 (Elevated Threat)</option>
                  <option value={2}>DEFCON 2 (High Posture)</option>
                  <option value={1}>DEFCON 1 (Maximum Lockdown)</option>
                </select>
                <Input
                  placeholder="Operational justification..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="h-8 bg-black/20 border-white/20 text-white text-xs w-56 placeholder:text-white/40"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={handleDefconOverride}
                  className="h-8 text-xs font-bold"
                >
                  Enforce Posture
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. FLEET-WIDE CRYPTOGRAPHIC INTEGRITY VERIFIER */}
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Fleet-Wide Cryptographic Integrity Sweep
                  </CardTitle>
                  <CardDescription className="text-xs">
                    FIPS 140-3 &amp; NIST SP 800-53 Merkle/HMAC-SHA256 data tampering verifier
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleRunIntegritySweep}
                disabled={isPending}
                className="gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                {isPending ? 'Scanning Fleet...' : 'Run Cryptographic Sweep'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {integrityReport ? (
              <div className="space-y-3">
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    integrityReport.overallIntact
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {integrityReport.overallIntact ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {integrityReport.overallIntact ? '100% CRYPTOGRAPHICALLY INTACT' : 'TAMPERING DETECTED'}
                      </div>
                      <div className="text-[11px] opacity-80">
                        {integrityReport.totalArtifactsChecked} records verified across database partitions
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">
                    {new Date(integrityReport.sweepCompletedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">Partition Verification Breakdown</span>
                  <div className="space-y-1.5">
                    {integrityReport.sections.map((sec, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <span className="font-mono font-semibold text-slate-700">{sec.artifactType}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[11px]">{sec.totalChecked} items</span>
                          {sec.tamperedCount === 0 ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                              ✓ Intact
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              ✕ {sec.tamperedCount} Tampered
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-100 rounded-lg text-[10px] font-mono text-slate-600 truncate border border-slate-200">
                  <span className="font-bold text-slate-800">Root Audit Chain Hash:</span>{' '}
                  {integrityReport.chainRootHash}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                <Shield className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">No active scan in current session</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Click the button above to run a cryptographic verification sweep across all Prescriptions, Lab Reports, eMAR Administrations, Handovers, and Audit Log blockchain records.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. AUTOMATED INTRUSION SENTINEL & IP QUARANTINE */}
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <Ban className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Host IP Quarantine &amp; Blacklist
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Autonomous deep payload inspection (WAF/IDS) perimeter drop list
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {quarantinedIps.length} Quarantined
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {quarantinedIps.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {quarantinedIps.map((q) => (
                  <div
                    key={q.id}
                    className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-900">{q.ipAddress}</span>
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                          {q.violationCount} Violations
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">{q.reason}</p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Quarantined: {new Date(q.quarantinedAt).toLocaleString()}
                      </span>
                    </div>

                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePardonIp(q.ipAddress)}
                        disabled={isPending}
                        className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                      >
                        Pardon
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Perimeter Clear</div>
                <p className="text-[11px] text-slate-500">
                  Zero host IP addresses currently flagged or quarantined by the military intrusion sentinel.
                </p>
              </div>
            )}

            {/* Manual Quarantine Form */}
            {isAdmin && (
              <form onSubmit={handleManualQuarantine} className="pt-2 border-t border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Manual IP Block / Quarantine</span>
                <div className="flex gap-2">
                  <Input
                    placeholder="Host IP (e.g. 192.168.1.50)"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    className="h-8 text-xs font-mono w-44"
                  />
                  <Input
                    placeholder="Violation reason..."
                    value={manualIpReason}
                    onChange={(e) => setManualIpReason(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="submit" size="sm" variant="destructive" disabled={isPending} className="h-8 text-xs">
                    Quarantine
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. MISSION RESILIENCE & PENETRATION ATTACK DRILLS */}
      {isAdmin && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Flame className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Mission Cyber Resilience Drills (Security Testing)
                </CardTitle>
                <CardDescription className="text-xs">
                  Trigger controlled synthetic exploits to verify automated quarantine, alert dispatch, and defense escalation
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunDrill('sqli_probe')}
                disabled={isPending}
                className="h-auto py-2.5 flex-col items-start text-left border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
              >
                <div className="font-bold text-xs text-slate-900">1. SQLi Probe Drill</div>
                <div className="text-[10px] text-slate-500 font-normal">Tests SQL injection quarantine</div>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunDrill('xss_probe')}
                disabled={isPending}
                className="h-auto py-2.5 flex-col items-start text-left border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
              >
                <div className="font-bold text-xs text-slate-900">2. XSS Probe Drill</div>
                <div className="text-[10px] text-slate-500 font-normal">Tests script injection filter</div>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunDrill('tamper_probe')}
                disabled={isPending}
                className="h-auto py-2.5 flex-col items-start text-left border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
              >
                <div className="font-bold text-xs text-slate-900">3. Tamper Seal Alarm</div>
                <div className="text-[10px] text-slate-500 font-normal">Tests HMAC tamper escalation</div>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunDrill('brute_force_probe')}
                disabled={isPending}
                className="h-auto py-2.5 flex-col items-start text-left border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
              >
                <div className="font-bold text-xs text-slate-900">4. Brute-Force Drill</div>
                <div className="text-[10px] text-slate-500 font-normal">Tests credential lockout</div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
