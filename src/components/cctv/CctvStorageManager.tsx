'use client';

import React, { useState, useEffect, useTransition, useRef } from 'react';
import {
  CctvRecording,
  CctvStorageStats,
  CctvTriggerType,
  CctvZone,
  UserRole,
} from '@/types';
import {
  getCctvStorageDataAction,
  updateCctvStorageConfigAction,
  toggleLockRecordingAction,
  verifyRecordingIntegrityAction,
  deleteRecordingAction,
  triggerStoragePruneAction,
} from '@/app/cctv/storage-actions';
import { CctvStorageConfig } from '@/lib/cctv/cctv-storage-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  HardDrive,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Calendar,
  Archive,
  Download,
  Search,
  Filter,
  AlertTriangle,
  FileCheck2,
  Clock,
  Loader2,
  Copy,
  Printer,
  FileText,
} from 'lucide-react';

interface CctvStorageManagerProps {
  currentUserRole: UserRole;
  currentUserName?: string;
  getZoneBadgeColor: (zone: string) => string;
}

export function CctvStorageManager({
  currentUserRole,
  currentUserName,
  getZoneBadgeColor,
}: CctvStorageManagerProps) {
  const [stats, setStats] = useState<CctvStorageStats | null>(null);
  const [config, setConfig] = useState<CctvStorageConfig | null>(null);
  const [recordings, setRecordings] = useState<CctvRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('ALL');
  const [lockedOnly, setLockedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Storage Settings Dialog
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyRetentionDays, setPolicyRetentionDays] = useState(30);
  const [policyMaxGb, setPolicyMaxGb] = useState(250);
  const [policyPath, setPolicyPath] = useState('./storage/cctv');
  const [policyAutoPurge, setPolicyAutoPurge] = useState(true);

  // Lock Evidence Dialog
  const [lockTarget, setLockTarget] = useState<CctvRecording | null>(null);
  const [lockReasonInput, setLockReasonInput] = useState('');

  // Inspector & Section 65B Certificate Dialog
  const [inspectTarget, setInspectTarget] = useState<CctvRecording | null>(null);
  const [inspectVerification, setInspectVerification] = useState<{
    verified: boolean;
    expectedHash: string;
    actualHash?: string;
    isTampered: boolean;
    error?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Individual verification map
  const [verifiedMap, setVerifiedMap] = useState<Record<number, boolean>>({});

  const canManage =
    currentUserRole === 'admin_doctor' || currentUserRole === 'doctor' || currentUserRole === 'manager';

  // Fetch storage stats & recordings
  const loadStorageData = (overrideFilters?: {
    zone?: string;
    triggerType?: string;
    isLocked?: boolean;
  }) => {
    setIsLoading(true);
    startTransition(async () => {
      try {
        const filters = {
          zone: overrideFilters?.zone !== undefined ? overrideFilters.zone : selectedZone,
          triggerType: overrideFilters?.triggerType !== undefined ? overrideFilters.triggerType : selectedTrigger,
          isLocked: overrideFilters?.isLocked !== undefined ? overrideFilters.isLocked : lockedOnly ? true : undefined,
        };
        const data = await getCctvStorageDataAction(filters);
        setStats(data.stats);
        setConfig(data.config);
        setRecordings(data.recordings);

        setPolicyRetentionDays(data.config.retentionDays);
        setPolicyMaxGb(data.config.maxStorageGb);
        setPolicyPath(data.config.storagePath);
        setPolicyAutoPurge(data.config.autoPurgeEnabled);
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load storage data',
        });
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadStorageData();
  }, [selectedZone, selectedTrigger, lockedOnly]);

  // Handle Save Policy
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateCctvStorageConfigAction({
        retentionDays: Number(policyRetentionDays),
        maxStorageGb: Number(policyMaxGb),
        storagePath: policyPath.trim(),
        autoPurgeEnabled: policyAutoPurge,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setIsPolicyModalOpen(false);
        loadStorageData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  // Handle Run Manual Prune
  const handleTriggerPrune = () => {
    if (!confirm('Run rolling retention purge now? Unlocked recordings past the retention window will be securely zeroized (NIST SP 800-88). Locked evidence will remain strictly preserved.')) {
      return;
    }

    startTransition(async () => {
      const res = await triggerStoragePruneAction();
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        loadStorageData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  // Handle Evidence Lock / Unlock
  const handleToggleLock = (recording: CctvRecording) => {
    if (recording.isLocked) {
      // Unlocking
      if (!confirm(`Unlock recording #${recording.id}? It will become subject to standard retention purge policies.`)) {
        return;
      }
      startTransition(async () => {
        const res = await toggleLockRecordingAction(recording.id, false);
        if (res.success) {
          setFeedback({ type: 'success', message: res.message });
          loadStorageData();
        } else {
          setFeedback({ type: 'error', message: res.message });
        }
      });
    } else {
      // Locking
      setLockTarget(recording);
      setLockReasonInput(`Section 65B Evidence Preservation - Case #${recording.incidentId || recording.id}`);
    }
  };

  const handleConfirmLock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockTarget) return;

    startTransition(async () => {
      const res = await toggleLockRecordingAction(lockTarget.id, true, lockReasonInput);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setLockTarget(null);
        loadStorageData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  // Handle Verify Recording Integrity
  const handleVerifyIntegrity = (recording: CctvRecording) => {
    setIsVerifying(true);
    startTransition(async () => {
      const res = await verifyRecordingIntegrityAction(recording.id);
      setVerifiedMap((prev) => ({ ...prev, [recording.id]: res.verified }));
      if (inspectTarget?.id === recording.id) {
        setInspectVerification(res);
      }
      setIsVerifying(false);
      if (res.verified) {
        setFeedback({
          type: 'success',
          message: `✓ SHA-256 seal verified for #${recording.id}. File is intact and legally admissible.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: `🚨 TAMPER WARNING: Recording #${recording.id} failed SHA-256 verification! ${res.error || 'Checksum mismatch.'}`,
        });
      }
    });
  };

  // Handle Delete Recording
  const handleDeleteRecording = (recording: CctvRecording) => {
    if (recording.isLocked) {
      alert('Cannot delete locked evidence. Please unlock it first with authorized doctor privileges.');
      return;
    }

    if (!confirm(`Permanently zeroize and delete recording #${recording.id} (${recording.filename})? This action is irreversible.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteRecordingAction(recording.id);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        loadStorageData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  // Handle Download Segment / Manifest
  const handleDownloadClip = (recording: CctvRecording) => {
    const manifest = `================================================================================
HOSPITAL CCTV NVR FOOTAGE ARCHIVE SEGMENT
MEDSCRIPT CLINICAL SURVEILLANCE & PATIENT SAFETY SYSTEM
================================================================================
Record ID:       ${recording.id}
Filename:        ${recording.filename}
Zone:            ${recording.zone}
Camera ID:       ${recording.cameraId} (${recording.cameraName})
Start Time:      ${new Date(recording.startTime).toISOString()}
End Time:        ${new Date(recording.endTime).toISOString()}
Duration:        ${recording.durationSeconds}s
Trigger Type:    ${recording.triggerType}
File Size:       ${(recording.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
Evidence Lock:   ${recording.isLocked ? 'YES - MEDICO-LEGAL PROTECTED' : 'NO - ROLLING RETENTION'}
Lock Reason:     ${recording.lockReason || 'N/A'}

================================================================================
SECTION 65B INDIAN EVIDENCE ACT / SECTION 63 BSA COMPLIANCE CERTIFICATE
================================================================================
Cryptographic Hash (SHA-256):
${recording.checksumSha256}

Certified that this recording segment was generated in the ordinary course of
hospital surveillance without manual alteration or tampering.
================================================================================`;

    const blob = new Blob([manifest], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.filename}.sec65b-certificate.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Trigger Badge Formatter
  const getTriggerBadge = (trigger: CctvTriggerType) => {
    switch (trigger) {
      case 'INCIDENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Incident Alert
          </span>
        );
      case 'MOTION':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <ActivityIcon className="w-3 h-3" /> Motion
          </span>
        );
      case 'MANUAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
            <UserIcon className="w-3 h-3" /> Manual
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Continuous
          </span>
        );
    }
  };

  // Filter recordings by search query
  const filteredRecordings = recordings.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.cameraName.toLowerCase().includes(q) ||
      r.filename.toLowerCase().includes(q) ||
      r.zone.toLowerCase().includes(q) ||
      (r.lockReason && r.lockReason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner HUD: Capacity & Retention Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                Hospital NVR Vault & Retention Policy
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {stats?.autoPurgeEnabled ? 'Auto-Purge Active' : 'Manual Retention'}
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
              CCTV Video Storage, NVR Archive & Forensic Vault
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Cryptographically verified continuous and incident-triggered video retention complying with the Clinical Establishments Act, NABH Hospital Safety Guidelines, and Section 65B Indian Evidence Act / Section 63 BSA electronic admissibility.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadStorageData()}
              disabled={isLoading}
              className="gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-700 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {canManage && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTriggerPrune}
                  disabled={isPending}
                  className="gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Prune Expired Footage
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsPolicyModalOpen(true)}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Retention Policy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Storage Capacity Gauge & Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
          {/* Capacity Progress Bar Card */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                Storage Utilization
              </span>
              <span className="font-mono font-bold text-slate-200">
                {stats?.totalSizeFormatted || '0 B'} / {stats?.maxStorageGb || 250} GB ({stats?.usedPercentage || 0}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  (stats?.usedPercentage || 0) > 90
                    ? 'bg-rose-500'
                    : (stats?.usedPercentage || 0) > 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, stats?.usedPercentage || 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{stats?.totalRecordings || 0} recorded segments</span>
              <span className="text-slate-500 font-mono">
                Storage: {config?.storagePath || './storage/cctv'}
              </span>
            </div>
          </div>

          {/* Locked Medico-Legal Evidence Card */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Locked Evidence (Sec 65B)
              </div>
              <div className="text-2xl font-mono font-black text-amber-400 mt-0.5">
                {stats?.lockedRecordingsCount || 0}{' '}
                <span className="text-xs text-slate-500 font-normal font-sans">clips</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Size: {stats?.lockedRecordingsSizeFormatted || '0 B'} (Exempt from purge)
              </div>
            </div>
            <Lock className="w-7 h-7 text-amber-400/50" />
          </div>

          {/* Retention Window & Archive Window Card */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Retention Window
              </div>
              <div className="text-2xl font-mono font-black text-indigo-400 mt-0.5">
                {stats?.retentionDays || 30}{' '}
                <span className="text-xs text-slate-500 font-normal font-sans">days</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Oldest: {stats?.oldestRecordingAt ? new Date(stats.oldestRecordingAt).toLocaleDateString('en-IN') : 'N/A'}
              </div>
            </div>
            <Calendar className="w-7 h-7 text-indigo-400/50" />
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
              : 'bg-rose-950/40 text-rose-300 border-rose-800/80'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Zone Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Zone:
            </span>
            {[
              { id: 'ALL', label: 'All Zones' },
              { id: 'ICU', label: 'ICU' },
              { id: 'EMERGENCY', label: 'Emergency' },
              { id: 'OT', label: 'OT Complex' },
              { id: 'IPD_WARD', label: 'IPD Ward' },
              { id: 'PHARMACY', label: 'Pharmacy' },
              { id: 'OPD_RECEPTION', label: 'Reception' },
              { id: 'STORES_ASSETS', label: 'Stores' },
            ].map((z) => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedZone === z.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Trigger filter & Locked Only checkbox */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Trigger:</span>
              <select
                value={selectedTrigger}
                onChange={(e) => setSelectedTrigger(e.target.value)}
                className="h-8 px-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Triggers</option>
                <option value="CONTINUOUS">Continuous Recording</option>
                <option value="INCIDENT">Incident & Patient Safety Flag</option>
                <option value="MOTION">Motion Detected</option>
                <option value="MANUAL">Manual Security Flag</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:border-slate-700">
              <input
                type="checkbox"
                checked={lockedOnly}
                onChange={(e) => setLockedOnly(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <Lock className="w-3 h-3 text-amber-400" />
              Locked Only
            </label>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search footage library by camera name, filename, or evidence notes..."
            className="pl-9 h-9 text-xs bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 rounded-xl"
          />
        </div>
      </div>

      {/* Footage Library Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Footage Archive Library</h3>
            <span className="text-xs text-slate-400">({filteredRecordings.length} segments found)</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>NIST SP 800-88 Zeroization Compliant</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
            <p className="text-xs">Loading recorded footage from NVR storage...</p>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Archive className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No footage segments match filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Adjust your zone or trigger filter, or wait for active cameras to complete recording cycles.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800 overflow-x-auto">
            {filteredRecordings.map((rec) => {
              const isVerified = verifiedMap[rec.id];
              return (
                <div
                  key={rec.id}
                  className={`p-4 hover:bg-slate-800/40 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs ${
                    rec.isLocked ? 'bg-amber-950/10' : ''
                  }`}
                >
                  {/* Clip Info */}
                  <div className="space-y-1.5 min-w-0 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rec.isLocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-400" /> Evidence Locked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <Unlock className="w-3 h-3 text-slate-500" /> Rolling
                        </span>
                      )}

                      <span className="font-bold text-white text-sm">{rec.cameraName}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${getZoneBadgeColor(rec.zone)}`}>
                        {rec.zone}
                      </span>
                      {getTriggerBadge(rec.triggerType)}

                      <span className="text-[11px] font-mono text-slate-400">
                        {(rec.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB • {rec.durationSeconds}s
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400">Timestamp:</span>
                      <span className="font-mono text-slate-200">
                        {new Date(rec.startTime).toLocaleString('en-IN')} →{' '}
                        {new Date(rec.endTime).toLocaleTimeString('en-IN')}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">({rec.filename})</span>
                    </div>

                    {rec.lockReason && (
                      <div className="text-[11px] text-amber-300/90 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-900/60 inline-flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Preservation Case: {rec.lockReason}</span>
                      </div>
                    )}

                    {/* Checksum SHA-256 seal preview */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono uppercase">Seal SHA-256:</span>
                      <span className="font-mono text-[10px] text-indigo-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {rec.checksumSha256.slice(0, 16)}...{rec.checksumSha256.slice(-8)}
                      </span>
                      {isVerified !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                            isVerified
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {isVerified ? (
                            <>
                              <FileCheck2 className="w-3 h-3 text-emerald-400" /> Valid
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 text-rose-400" /> Tampered
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerifyIntegrity(rec)}
                      disabled={isVerifying}
                      className="text-xs h-8 bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700 gap-1.5"
                      title="Verify SHA-256 seal against physical file"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Verify Seal
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        setInspectTarget(rec);
                        setInspectVerification(null);
                      }}
                      className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Inspect & Sec 65B
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadClip(rec)}
                      className="text-xs h-8 bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700 gap-1"
                      title="Export electronic evidence certificate"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </Button>

                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleLock(rec)}
                          className={`text-xs h-8 gap-1.5 border-slate-700 ${
                            rec.isLocked
                              ? 'bg-amber-950/60 text-amber-300 hover:bg-amber-900 border-amber-800'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300'
                          }`}
                          title={rec.isLocked ? 'Unlock evidence' : 'Lock as permanent legal evidence'}
                        >
                          {rec.isLocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-amber-400" /> Unlock
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-slate-400" /> Lock
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRecording(rec)}
                          disabled={rec.isLocked}
                          className="text-xs h-8 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                          title={rec.isLocked ? 'Cannot delete locked evidence' : 'Zeroize & delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Storage Retention Policy Configuration Dialog */}
      {isPolicyModalOpen && (
        <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
          <DialogContent className="sm:max-w-lg bg-slate-950 text-white border-slate-800">
            <form onSubmit={handleSavePolicy}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  Hospital CCTV Retention & Quota Policy
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Configure regulatory rolling purge windows, maximum disk quota, and storage path for clinical video feeds.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {/* Retention Window Preset Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">
                    Mandatory Retention Window (Days) *
                  </Label>
                  <select
                    value={policyRetentionDays}
                    onChange={(e) => setPolicyRetentionDays(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold"
                  >
                    <option value={7}>7 Days (Minimal Local Cache)</option>
                    <option value={15}>15 Days (Small Clinic Standard)</option>
                    <option value={30}>30 Days (NABH Hospital Standard Recommendation)</option>
                    <option value={60}>60 Days (Extended Hospital Multi-Zone)</option>
                    <option value={90}>90 Days (Statutory NABH High-Risk ICU/OT)</option>
                    <option value={180}>180 Days (High Security Narcotic Vault)</option>
                  </select>
                  <p className="text-[10px] text-slate-500">
                    NABH and Clinical Establishments Act recommend a minimum of 30 days retention for clinical patient areas.
                  </p>
                </div>

                {/* Max Storage Quota */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">Max Disk Quota (GB) *</Label>
                    <Input
                      type="number"
                      min={10}
                      max={10000}
                      value={policyMaxGb}
                      onChange={(e) => setPolicyMaxGb(Number(e.target.value))}
                      required
                      className="h-9 text-xs bg-slate-900 border-slate-700 text-slate-200 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">Zeroization Method</Label>
                    <div className="h-9 px-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center text-[11px] text-slate-400 font-mono">
                      NIST SP 800-88
                    </div>
                  </div>
                </div>

                {/* Storage Path */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">Storage Archive Path *</Label>
                  <Input
                    value={policyPath}
                    onChange={(e) => setPolicyPath(e.target.value)}
                    required
                    placeholder="./storage/cctv"
                    className="h-9 text-xs bg-slate-900 border-slate-700 text-slate-200 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    Files are created with strict POSIX 0600 permissions restricted to the MedScript server daemon.
                  </p>
                </div>

                {/* Auto-Purge Toggle */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 text-xs block">
                      Automated Rolling Purge
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Automatically zeroize and delete unlocked recordings past the retention window or when storage quota exceeds 90%.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyAutoPurge}
                    onChange={(e) => setPolicyAutoPurge(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 ml-3"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/60 text-amber-300 text-[11px] space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" /> Evidence Preservation Rule:
                  </span>
                  <p>
                    Recordings marked as <strong>Locked Evidence</strong> are strictly exempt from both time-based and quota-based auto-purges.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Save Retention Policy
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Lock Evidence Modal */}
      {lockTarget && (
        <Dialog open={Boolean(lockTarget)} onOpenChange={(open) => !open && setLockTarget(null)}>
          <DialogContent className="sm:max-w-md bg-slate-950 text-white border-slate-800">
            <form onSubmit={handleConfirmLock}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
                  <Lock className="w-5 h-5 text-amber-400" />
                  Preserve Medico-Legal Evidence #{lockTarget.id}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {lockTarget.cameraName} ({lockTarget.zone}) • {new Date(lockTarget.startTime).toLocaleString('en-IN')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <p className="text-slate-300">
                  Locking this footage preserves it permanently in the NVR vault. It will be protected from all automated purges and quota trimming until unlocked by an authorized doctor.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">
                    Legal Case Reference / Reason for Preservation *
                  </Label>
                  <textarea
                    value={lockReasonInput}
                    onChange={(e) => setLockReasonInput(e.target.value)}
                    required
                    placeholder="e.g. MLC No. 44/2026, Posture fall incident investigation in ICU Bed 3"
                    rows={3}
                    className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLockTarget(null)}
                  className="bg-slate-900 text-slate-300 border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Lock as Permanent Evidence
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Evidence Inspector & Section 65B Certificate Modal */}
      {inspectTarget && (
        <Dialog open={Boolean(inspectTarget)} onOpenChange={(open) => !open && setInspectTarget(null)}>
          <DialogContent className="sm:max-w-3xl bg-slate-950 text-white border-slate-800 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                    <FileCheck2 className="w-5 h-5 text-indigo-400" />
                    Forensic Footage Inspector & Section 65B Electronic Seal
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Recording #{inspectTarget.id} • {inspectTarget.cameraName} ({inspectTarget.zone})
                  </DialogDescription>
                </div>
                {inspectTarget.isLocked && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" /> Medico-Legal Locked
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Simulated Video Player Box */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <CctvPlaybackCanvas recording={inspectTarget} />
                <div className="absolute top-3 left-3 bg-black/80 px-2.5 py-1 rounded text-[11px] font-mono font-bold text-amber-400 border border-amber-500/40">
                  ARCHIVED NVR PLAYBACK • {inspectTarget.durationSeconds}s
                </div>
                <div className="absolute bottom-3 left-3 bg-black/80 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                  {new Date(inspectTarget.startTime).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Section 65B Medico-Legal Electronic Evidence Certificate */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200 text-xs">
                      Certificate of Electronic Evidence (Section 65B IEA / Section 63 BSA)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadClip(inspectTarget)}
                    className="h-7 text-xs bg-slate-950 text-indigo-300 border-slate-700 hover:bg-slate-800 gap-1"
                  >
                    <Download className="w-3 h-3" /> Export Certificate
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400">File Identifier:</span>
                    <p className="font-mono text-slate-200 font-semibold truncate">{inspectTarget.filename}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Zone & Location:</span>
                    <p className="font-semibold text-slate-200">{inspectTarget.zone} ({inspectTarget.cameraName})</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Time Range (IST):</span>
                    <p className="font-mono text-slate-200 text-[11px]">
                      {new Date(inspectTarget.startTime).toLocaleTimeString('en-IN')} →{' '}
                      {new Date(inspectTarget.endTime).toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Capture Trigger:</span>
                    <p className="font-semibold text-slate-200">{inspectTarget.triggerType}</p>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Seal Verification */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Cryptographic SHA-256 Digest Seal:</span>
                    <Button
                      size="sm"
                      onClick={() => handleVerifyIntegrity(inspectTarget)}
                      disabled={isVerifying}
                      className="h-6 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1"
                    >
                      {isVerifying ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      Test Seal Integrity
                    </Button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 break-all select-all flex items-center justify-between">
                    <span>{inspectTarget.checksumSha256}</span>
                  </div>

                  {inspectVerification && (
                    <div
                      className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        inspectVerification.verified
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {inspectVerification.verified ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>
                        {inspectVerification.verified
                          ? '✓ Physical file matches SHA-256 seal. No bit modification or tampering detected.'
                          : `🚨 Verification Failed: ${inspectVerification.error || 'Disk file checksum does not match digital seal!'}`}
                      </span>
                    </div>
                  )}
                </div>

                {inspectTarget.lockReason && (
                  <div className="p-2.5 bg-amber-950/30 rounded-lg border border-amber-900/60 text-amber-300 text-xs">
                    <span className="font-bold block">Case Custody Reason:</span>
                    <p className="mt-0.5">{inspectTarget.lockReason}</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInspectTarget(null)}
                className="bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
              >
                Close Inspector
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Playback Canvas for Archived Footage ─────────────────────────────────────

function CctvPlaybackCanvas({ recording }: { recording: CctvRecording }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Dark room background
      ctx.fillStyle = '#06090e';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Zone indicator
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.fillRect(w * 0.1, h * 0.2, w * 0.8, h * 0.6);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w * 0.1, h * 0.2, w * 0.8, h * 0.6);

      // Playback progress bar on bottom
      const progress = (tick % 300) / 300;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, h - 25, w - 40, 6);
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(20, h - 25, (w - 40) * progress, 6);

      // Watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '11px monospace';
      ctx.fillText(
        `NVR PLAYBACK • CAM-${recording.cameraId} [${recording.zone}] • SHA-256: ${recording.checksumSha256.slice(0, 12)}...`,
        20,
        h - 35
      );

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [recording]);

  return <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-cover" />;
}

// Helper icons
function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
