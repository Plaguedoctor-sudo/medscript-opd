'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  Lock,
  DownloadCloud,
  Siren,
  FileWarning,
  CheckCheck,
  Sparkles,
  Radio,
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from './ui/toast';
import {
  getSecurityAlertsAction,
  acknowledgeAlertAction,
  acknowledgeAllAlertsAction,
  triggerSecurityTestIncidentAction,
} from '@/app/actions/security-alert-actions';
import type { SecurityAlertStats, AlertCategory } from '@/lib/security-engine';

export function SecurityAlertBell({
  initialStats,
}: {
  initialStats?: SecurityAlertStats;
}) {
  const [stats, setStats] = useState<SecurityAlertStats>(
    initialStats || {
      totalActive: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      alerts: [],
    }
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'all' | 'simulate'>('active');
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll for updates every 25 seconds when page is open
  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getSecurityAlertsAction();
      setStats(data);
    } catch {
      // Quiet fail on network/poll error
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchAlerts();
    }, 0);
    const interval = setInterval(fetchAlerts, 25000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchAlerts();
    setIsRefreshing(false);
  };

  const handleAcknowledgeOne = (id: number) => {
    startTransition(async () => {
      const res = await acknowledgeAlertAction(id);
      if (res.success) {
        toast.show({
          title: 'Alert Acknowledged',
          description: 'Security incident marked as reviewed by Doctor.',
          type: 'success',
        });
        await fetchAlerts();
      } else {
        toast.show({
          title: 'Action Failed',
          description: res.error || 'Could not acknowledge alert.',
          type: 'error',
        });
      }
    });
  };

  const handleAcknowledgeAll = () => {
    startTransition(async () => {
      const res = await acknowledgeAllAlertsAction();
      if (res.success) {
        toast.show({
          title: 'All Alerts Acknowledged',
          description: 'All active security alerts marked as reviewed.',
          type: 'success',
        });
        await fetchAlerts();
      } else {
        toast.show({
          title: 'Action Failed',
          description: res.error || 'Could not acknowledge alerts.',
          type: 'error',
        });
      }
    });
  };

  const handleSimulateIncident = (
    type: 'brute_force' | 'data_transfer' | 'break_glass' | 'tamper_seal'
  ) => {
    startTransition(async () => {
      const res = await triggerSecurityTestIncidentAction(type);
      if (res.success) {
        toast.show({
          title: 'Simulated Threat Injected',
          description: 'The anomaly detection engine has flagged the simulated event.',
          type: 'warning',
        });
        await fetchAlerts();
        setActiveTab('active');
      }
    });
  };

  const activeAlerts = stats.alerts.filter((a) => a.acknowledgedAt === null);
  const hasActive = stats.totalActive > 0;
  const isCritical = stats.criticalCount > 0;

  const getCategoryIcon = (category: AlertCategory) => {
    switch (category) {
      case 'BRUTE_FORCE':
        return <Lock className="w-4 h-4 text-red-600" />;
      case 'UNUSUAL_TRANSFER':
        return <DownloadCloud className="w-4 h-4 text-amber-600" />;
      case 'BREAK_GLASS':
        return <Siren className="w-4 h-4 text-orange-600" />;
      case 'ACCESS_VIOLATION':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'INTEGRITY_TAMPER':
        return <FileWarning className="w-4 h-4 text-red-600" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-amber-600" />;
    }
  };

  const getRemediationAdvice = (category: AlertCategory) => {
    switch (category) {
      case 'BRUTE_FORCE':
        return 'Verify whether legitimate staff forgot the desk PIN. If unauthorized, verify LAN access and consider updating your Doctor PIN in Settings.';
      case 'UNUSUAL_TRANSFER':
        return 'Review exported files with clinic staff. Ensure patient export data remains stored on encrypted storage with POSIX 0600 restrictions.';
      case 'BREAK_GLASS':
        return 'Confirm clinical triage urgency with your desk assistant and verify patient registration.';
      case 'ACCESS_VIOLATION':
        return 'Ensure non-doctor staff only use the patient registration portal; clinical deletions and raw database dumps are strictly restricted.';
      case 'INTEGRITY_TAMPER':
        return 'Prescription HMAC digital seal failed. Check for unexpected file modifications in sqlite.db or restore from an authenticated backup.';
      default:
        return 'Audit the recent activity trail in the Settings > Audit Logs desk.';
    }
  };

  const formatAlertTimestamp = (dateInput: Date | string | null) => {
    if (!dateInput) return 'Recorded';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Recorded';
    return (
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
      ', ' +
      date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    );
  };

  return (
    <>
      {/* Navbar Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        title={
          hasActive
            ? `${stats.totalActive} Security Incident(s) Detected - Click to Review`
            : 'Clinic Security Sentinel: Active & Monitoring'
        }
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-2xs ${
          isCritical
            ? 'bg-red-50 hover:bg-red-100 text-red-800 border-red-300 ring-2 ring-red-400/30'
            : hasActive
            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-400/30'
            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {isCritical ? (
          <ShieldAlert className="w-4 h-4 text-red-600 animate-bounce" />
        ) : hasActive ? (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
        )}

        <span className="hidden md:inline">
          {hasActive
            ? `${stats.totalActive} Security ${stats.totalActive === 1 ? 'Alert' : 'Alerts'}`
            : 'Shield Active'}
        </span>

        {hasActive && (
          <span className="relative flex h-2 w-2 ml-0.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isCritical ? 'bg-red-500' : 'bg-amber-500'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isCritical ? 'bg-red-600' : 'bg-amber-600'
              }`}
            />
          </span>
        )}
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isCritical
                      ? 'bg-red-100 text-red-700'
                      : hasActive
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {isCritical ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : hasActive ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      Doctor Threat & Security Sentinel
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <Radio className="w-3 h-3 text-emerald-600 animate-pulse" /> Live Guard
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Surveillance for brute-force attacks, emergency triage bypass, and unusual data exfiltration.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="h-8 px-2.5 text-xs text-slate-600"
                  title="Refresh Incident Log"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  Sync
                </Button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'active'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Active Threats</span>
                  {stats.totalActive > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                        isCritical
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {stats.totalActive}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'all'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Incident History</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-600 font-medium">
                    {stats.alerts.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('simulate')}
                  className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'simulate'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Threat Simulation Test</span>
                </button>
              </div>

              {hasActive && activeTab === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAcknowledgeAll}
                  disabled={isPending}
                  className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Acknowledge All ({stats.totalActive})
                </Button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 max-h-[60vh]">
              {/* Tab 1: Active Threats */}
              {activeTab === 'active' && (
                <>
                  {activeAlerts.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">
                        All Systems Protected — Zero Active Threats
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                        The anomaly detection engine is continuously auditing PIN attempts, export volumes, triage break-glass actions, and digital seals.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-lg mx-auto text-xs bg-white p-3 rounded-lg border border-slate-200 text-slate-600">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Brute-Force Rate Limiting Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Off-Hours Exfiltration Sentinel</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Break-Glass Triage Audit Enabled</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>HMAC-SHA256 Rx Tamper Seal</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-xl border transition-all ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-red-50/70 border-red-300 shadow-2xs'
                              : 'bg-amber-50/70 border-amber-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs shrink-0 mt-0.5">
                                {getCategoryIcon(alert.category)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                                      alert.severity === 'CRITICAL'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-amber-600 text-white'
                                    }`}
                                  >
                                    {alert.severity}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-tight">
                                    {alert.category.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {formatAlertTimestamp(alert.createdAt)}
                                  </span>
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm mt-1">
                                  {alert.title}
                                </h4>
                                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                                  {alert.description}
                                </p>

                                <div className="mt-2.5 p-2 bg-white/90 rounded-lg border border-slate-200/70 text-[11px] text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    Recommended Doctor Action:{' '}
                                  </span>
                                  {getRemediationAdvice(alert.category)}
                                </div>

                                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
                                  {alert.ipAddress && (
                                    <span>
                                      Origin IP:{' '}
                                      <strong className="text-slate-700 font-mono">
                                        {alert.ipAddress}
                                      </strong>
                                    </span>
                                  )}
                                  {alert.createdAt && (
                                    <span>
                                      Recorded:{' '}
                                      <span className="text-slate-600">
                                        {new Date(alert.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                        })}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledgeOne(alert.id)}
                              disabled={isPending}
                              className="shrink-0 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Acknowledge
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Tab 2: Incident History */}
              {activeTab === 'all' && (
                <div className="space-y-2">
                  {stats.alerts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No security incidents logged yet.
                    </div>
                  ) : (
                    stats.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                          alert.acknowledgedAt
                            ? 'bg-slate-50/60 border-slate-200 text-slate-600 opacity-80'
                            : alert.severity === 'CRITICAL'
                            ? 'bg-red-50/60 border-red-200 text-red-900'
                            : 'bg-amber-50/60 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {getCategoryIcon(alert.category)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {alert.title}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatAlertTimestamp(alert.createdAt)}
                              </span>
                              {alert.acknowledgedAt && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  Reviewed
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {alert.description}
                            </p>
                          </div>
                        </div>

                        {!alert.acknowledgedAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAcknowledgeOne(alert.id)}
                            disabled={isPending}
                            className="h-7 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Simulate Threat / Test Desk */}
              {activeTab === 'simulate' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900">
                    <div className="flex items-center gap-2 font-bold mb-1 text-indigo-950">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Doctor Incident Simulation Sandbox</span>
                    </div>
                    <p className="text-indigo-800 leading-relaxed">
                      Trigger controlled simulated security incidents to verify how MedScript-OPD detects, flags, and alerts the doctor in real-time. Each simulation tests a distinct threat category.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-red-700 mb-1">
                          <Lock className="w-4 h-4" />
                          <span>1. Brute-Force PIN Attack</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Simulates consecutive failed PIN entries triggering automated desk lockout to prevent brute forcing.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSimulateIncident('brute_force')}
                        disabled={isPending}
                        className="w-full text-xs border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Simulate Brute-Force Lockout
                      </Button>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 mb-1">
                          <DownloadCloud className="w-4 h-4" />
                          <span>2. Bulk Data Exfiltration</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Simulates rapid successive downloads of bulk patient rosters and SQLite snapshots.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSimulateIncident('data_transfer')}
                        disabled={isPending}
                        className="w-full text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
                      >
                        Simulate Bulk Exfiltration
                      </Button>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-orange-700 mb-1">
                          <Siren className="w-4 h-4" />
                          <span>3. Break-Glass Emergency Triage</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Simulates front-desk assistant invoking emergency break-glass triage without doctor PIN.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSimulateIncident('break_glass')}
                        disabled={isPending}
                        className="w-full text-xs border-orange-200 text-orange-800 hover:bg-orange-50"
                      >
                        Simulate Break-Glass Triage
                      </Button>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-700 mb-1">
                          <FileWarning className="w-4 h-4" />
                          <span>4. Tamper Seal Mismatch</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Simulates cryptographic HMAC-SHA256 signature verification failure on modified clinical prescription.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSimulateIncident('tamper_seal')}
                        disabled={isPending}
                        className="w-full text-xs border-rose-200 text-rose-800 hover:bg-rose-50"
                      >
                        Simulate Seal Mismatch
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-400" />
                Offline-First SQLite WAL • No external cloud transmission
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="text-xs"
              >
                Close Desk
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
