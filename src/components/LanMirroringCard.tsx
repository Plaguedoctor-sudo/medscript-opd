'use client';

import React, { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
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
  Server,
  RefreshCw,
  Zap,
  Activity,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRightLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Clock,
  HardDrive,
  Settings2,
} from 'lucide-react';
import {
  LanMirrorStatus,
  LanMirrorConfig,
} from '@/lib/lan-mirroring';
import {
  saveLanMirrorConfigAction,
  testPeerConnectionAction,
  triggerManualSyncAction,
  promoteToMasterAction,
} from '@/app/settings/lan-mirror-actions';

interface LanMirroringCardProps {
  initialStatus: LanMirrorStatus;
  initialConfig: LanMirrorConfig;
  isDoctor: boolean;
}

export function LanMirroringCard({
  initialStatus,
  initialConfig,
  isDoctor,
}: LanMirroringCardProps) {
  const [status, setStatus] = useState<LanMirrorStatus>(initialStatus);
  const [config, setConfig] = useState<LanMirrorConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();

  // Test Connection state
  const [pingResult, setPingResult] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // Status message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Config modal
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editRole, setEditRole] = useState(config.role);
  const [editNodeName, setEditNodeName] = useState(config.nodeName);
  const [editPeerUrl, setEditPeerUrl] = useState(config.peerUrl);
  const [editSecret, setEditSecret] = useState(config.clusterSecret);
  const [editAutoFailover, setEditAutoFailover] = useState(config.autoFailover);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Failover Promotion Dialog
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);

  const handleTestConnection = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await testPeerConnectionAction();
      setPingResult({
        tested: true,
        success: res.success,
        latencyMs: res.latencyMs,
        error: res.error,
      });
      if (res.success) {
        setStatus((prev) => ({
          ...prev,
          peerReachable: true,
          peerLatencyMs: res.latencyMs,
          peerRole: res.role as any,
          peerNodeName: res.nodeName,
          peerDatabaseHash: res.dbHash,
          health:
            res.dbHash && prev.currentLocalHash !== res.dbHash
              ? 'LAGGING'
              : 'HEALTHY',
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          peerReachable: false,
          health: 'PEER_UNREACHABLE',
          lastError: res.error,
        }));
      }
    });
  };

  const handleManualSync = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await triggerManualSyncAction();
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setStatus((prev) => ({
          ...prev,
          health: 'HEALTHY',
          lastSyncAt: new Date(),
          lastSyncStatus: 'HEALTHY',
        }));
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  const handlePromoteToMaster = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await promoteToMasterAction('Promoted via Settings High Availability Card');
      setIsPromotionDialogOpen(false);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setStatus((prev) => ({
          ...prev,
          role: 'PRIMARY_MASTER',
        }));
        setConfig((prev) => ({
          ...prev,
          role: 'PRIMARY_MASTER',
        }));
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await saveLanMirrorConfigAction({
        role: editRole,
        nodeName: editNodeName,
        peerUrl: editPeerUrl,
        clusterSecret: editSecret,
        autoFailover: editAutoFailover,
      });

      if (res.success) {
        setConfig((prev) => ({
          ...prev,
          role: editRole,
          nodeName: editNodeName,
          peerUrl: editPeerUrl,
          clusterSecret: editSecret,
          autoFailover: editAutoFailover,
        }));
        setStatus((prev) => ({
          ...prev,
          role: editRole,
          nodeName: editNodeName,
          peerUrl: editPeerUrl,
          autoFailover: editAutoFailover,
          configured: editRole !== 'STANDALONE',
        }));
        setIsConfigOpen(false);
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(editSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleGenerateSecret = () => {
    const chars = '0123456789abcdef';
    let rand = '';
    for (let i = 0; i < 64; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    setEditSecret(rand);
  };

  const getHealthBadge = () => {
    switch (status.health) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> In Sync · 0 Data Loss
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" /> Syncing With Peer
          </span>
        );
      case 'LAGGING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Activity className="w-3.5 h-3.5 text-amber-600" /> Pending Changes
          </span>
        );
      case 'PEER_UNREACHABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> Peer Unreachable
          </span>
        );
      case 'STANDALONE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Server className="w-3.5 h-3.5 text-slate-500" /> Standalone Single Node
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'PRIMARY_MASTER') {
      return (
        <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
          PRIMARY MASTER
        </span>
      );
    }
    if (role === 'STANDBY_REPLICA') {
      return (
        <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-cyan-100 text-cyan-900 border border-cyan-300">
          STANDBY REPLICA
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
        STANDALONE
      </span>
    );
  };

  return (
    <>
      <Card className="p-6 bg-white border border-slate-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900">
                  Automated LAN Peer Mirroring (High Availability)
                </h3>
                {getHealthBadge()}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time zero-loss SQLite replication between Doctor Desk and Reception Desk with instant failover.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDoctor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfigOpen(true)}
                className="gap-1.5 text-xs text-slate-700"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" /> Configure Cluster
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isPending || !config.peerUrl}
              className="gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50"
            >
              <Radio className={`w-3.5 h-3.5 ${isPending ? 'animate-pulse' : ''}`} /> Test Peer Ping
            </Button>
            {config.role === 'STANDBY_REPLICA' && (
              <Button
                size="sm"
                onClick={handleManualSync}
                disabled={isPending || !config.peerUrl}
                className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} /> Sync Now
              </Button>
            )}
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Cluster Topology Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {/* This Local Node */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                This Local Machine
              </span>
              {getRoleBadge(config.role)}
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {config.nodeName || 'Primary Host'}
            </div>
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Database SHA-256 Seal:
                </span>
                <span className="font-mono text-[11px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {status.currentLocalHash ? `${status.currentLocalHash.slice(0, 14)}...` : 'Computing...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Synchronized:
                </span>
                <span className="text-slate-700 font-medium">
                  {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Peer Node */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Remote LAN Peer
              </span>
              {config.peerUrl ? (
                status.peerRole ? (
                  getRoleBadge(status.peerRole)
                ) : (
                  <span className="px-2 py-0.5 rounded font-mono text-xs bg-slate-200 text-slate-700">
                    CONFIGURED
                  </span>
                )
              ) : (
                <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-500">
                  NOT LINKED
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-slate-800 truncate">
              {config.peerUrl ? config.peerUrl : 'No Peer Address Configured'}
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-slate-400" /> Heartbeat Latency:
                </span>
                <span className="font-mono text-slate-700 font-medium">
                  {status.peerLatencyMs !== undefined ? `${status.peerLatencyMs} ms (LAN)` : 'Untested'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" /> Peer DB Seal:
                </span>
                <span className="font-mono text-[11px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {status.peerDatabaseHash
                    ? `${status.peerDatabaseHash.slice(0, 14)}...`
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Failover Emergency Banner for Standby Node */}
        {config.role === 'STANDBY_REPLICA' && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  High Availability Failover Safeguard Active
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  If the Doctor Desk computer fails or experiences a hardware fault, promote this Standby machine to Primary Master to instantly resume OPD operations with zero downtime.
                </p>
              </div>
            </div>
            {isDoctor && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsPromotionDialogOpen(true)}
                className="shrink-0 text-xs bg-amber-600 hover:bg-amber-700 font-bold"
              >
                Promote to Master
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Cluster Configuration Modal */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" /> High Availability Cluster Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure peer-to-peer database replication across your clinic LAN.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveConfig} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Cluster Role</Label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="PRIMARY_MASTER">Primary Master (Doctor Desk)</option>
                <option value="STANDBY_REPLICA">Standby Replica (Reception Desk)</option>
                <option value="STANDALONE">Standalone (Single Clinic Computer)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Local Node Name</Label>
              <Input
                value={editNodeName}
                onChange={(e) => setEditNodeName(e.target.value)}
                placeholder="e.g. Doctor Desk (Primary)"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Peer LAN Address / URL</Label>
              <Input
                value={editPeerUrl}
                onChange={(e) => setEditPeerUrl(e.target.value)}
                placeholder="e.g. https://192.168.1.150:3000"
                className="text-sm font-mono"
              />
              <p className="text-[11px] text-slate-500">
                The HTTPS LAN IP and port of the other clinic computer.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Shared Cluster Pre-Shared Key (PSK)
                </Label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    {copiedSecret ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedSecret ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateSecret}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={editSecret}
                  onChange={(e) => setEditSecret(e.target.value)}
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Must match identically on both machines to authenticate replication packages.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="auto-failover-checkbox"
                checked={editAutoFailover}
                onChange={(e) => setEditAutoFailover(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor="auto-failover-checkbox" className="text-xs text-slate-700 font-medium">
                Enable Autonomous Failover Detection
              </label>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsConfigOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Save Cluster Config
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Failover Promotion Confirmation Modal */}
      <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 text-red-600" /> Confirm Failover Promotion
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              You are about to promote this machine from <strong>Standby Replica</strong> to{' '}
              <strong>Primary Master</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1.5">
            <p className="font-semibold">When should you proceed?</p>
            <ul className="list-disc pl-4 space-y-1 text-red-800">
              <li>The primary Doctor Desk computer has experienced a hard crash, power outage, or hardware death.</li>
              <li>You need this machine to immediately take over live prescription writing, patient intake, and admissions.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromotionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handlePromoteToMaster}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 font-bold"
            >
              Yes, Promote to Master
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
