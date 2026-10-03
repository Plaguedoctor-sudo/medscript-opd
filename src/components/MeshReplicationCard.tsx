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
  Network,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  Radio,
  Share2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import {
  MeshClusterOverview,
  MeshNode,
  MeshNodeBranchType,
} from '@/types';
import {
  registerMeshNodeAction,
  triggerPeerSyncAction,
  deleteMeshNodeAction,
  getMeshClusterOverviewAction,
} from '@/app/actions/mesh-actions';

interface MeshReplicationCardProps {
  initialOverview: MeshClusterOverview;
  isDoctor: boolean;
}

export function MeshReplicationCard({
  initialOverview,
  isDoctor,
}: MeshReplicationCardProps) {
  const [overview, setOverview] = useState<MeshClusterOverview>(initialOverview);
  const [isPending, startTransition] = useTransition();
  const [activeSyncingNode, setActiveSyncingNode] = useState<string | null>(null);

  // Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNodeId, setNewNodeId] = useState('');
  const [newNodeName, setNewNodeName] = useState('');
  const [newBranchType, setNewBranchType] = useState<MeshNodeBranchType>('SATELLITE');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // User feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refreshOverview = () => {
    startTransition(async () => {
      const res = await getMeshClusterOverviewAction();
      if (res.success && res.data) {
        setOverview(res.data);
      }
    });
  };

  const handleSyncNode = (node: MeshNode) => {
    setActiveSyncingNode(node.nodeId);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await triggerPeerSyncAction(node.nodeId);
        if (res.success) {
          setFeedback({
            type: 'success',
            message: `Reconciliation with ${node.name} completed: ${res.pushedCount ?? 0} deltas pushed, ${res.receivedCount ?? 0} deltas received.`,
          });
        } else {
          setFeedback({
            type: 'error',
            message: `Sync failed with ${node.name}: ${res.error || 'Connection timed out'}`,
          });
        }
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown sync error',
        });
      } finally {
        setActiveSyncingNode(null);
        refreshOverview();
      }
    });
  };

  const handleRegisterNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeId || !newNodeName || !newEndpointUrl) return;

    setFeedback(null);
    startTransition(async () => {
      const res = await registerMeshNodeAction({
        nodeId: newNodeId,
        name: newNodeName,
        branchType: newBranchType,
        endpointUrl: newEndpointUrl,
        clusterSecret: newSecret || undefined,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Branch node ${newNodeName} (${newNodeId}) registered successfully in replication mesh.`,
        });
        setIsAddOpen(false);
        setNewNodeId('');
        setNewNodeName('');
        setNewEndpointUrl('');
        setNewSecret('');
        refreshOverview();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to register mesh node.',
        });
      }
    });
  };

  const handleDeleteNode = (nodeId: string, nodeName: string) => {
    if (!confirm(`Are you sure you want to decommission branch node "${nodeName}"?`)) return;

    startTransition(async () => {
      const res = await deleteMeshNodeAction(nodeId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Decommissioned branch node ${nodeName}.`,
        });
        refreshOverview();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to delete node',
        });
      }
    });
  };

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <Card className="p-6 border-blue-900/40 bg-slate-900/60 backdrop-blur-sm shadow-xl text-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Network className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white tracking-wide">
                Multi-Branch Clinic Mesh Replication
              </h3>
              <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                Vector Clocks & CRDT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero-data-loss delta replication for multi-doctor satellite clinics & mobile medical camps over intermittent 4G/5G WAN
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshOverview}
            disabled={isPending}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isDoctor && (
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs shadow-md shadow-blue-900/30"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Remote Branch
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Local Identity & Vector Clock Ribbon */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Local Node ID</span>
          <span className="text-xs font-mono font-semibold text-blue-400 mt-1 truncate">
            {overview.localNodeId}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">Role: {overview.localBranchType}</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Local Vector Clock</span>
          <span className="text-xs font-mono text-emerald-400 mt-1 truncate">
            {JSON.stringify(overview.localVectorClock)}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">Monotonic Causal Sequence</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Store-and-Forward Outbox</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-mono font-bold ${overview.totalPendingOutbox > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {overview.totalPendingOutbox} deltas pending
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Queued for offline branch links</span>
        </div>
      </div>

      {/* Nodes Table */}
      <div className="mt-6">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Registered Remote Clinic Branches ({overview.nodes.length})
        </h4>

        {overview.nodes.length === 0 ? (
          <div className="p-6 rounded-lg bg-slate-950/40 border border-dashed border-slate-800 text-center">
            <Share2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              No remote branches registered. Add a satellite clinic or mobile camp to begin multi-facility replication.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {overview.nodes.map((node) => (
              <div
                key={node.id}
                className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                      node.status === 'ACTIVE'
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        : node.status === 'SYNCING'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{node.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {node.branchType}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {node.endpointUrl} <span className="text-slate-600">({node.nodeId})</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Last Sync:{' '}
                        {node.lastSyncAt
                          ? new Date(node.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </span>
                      {node.latencyMs !== undefined && node.latencyMs > 0 && (
                        <span className="flex items-center gap-1 font-mono text-blue-400">
                          <Radio className="w-3 h-3" />
                          {node.latencyMs} ms
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        Outbox: {node.pendingOutboxCount} queued
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncNode(node)}
                    disabled={isPending || activeSyncingNode === node.nodeId}
                    className="border-blue-800/60 bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 text-xs h-8"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 mr-1.5 ${
                        activeSyncingNode === node.nodeId ? 'animate-spin text-blue-400' : ''
                      }`}
                    />
                    Sync Now
                  </Button>

                  {isDoctor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNode(node.nodeId, node.name)}
                      disabled={isPending}
                      className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 h-8 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Branch Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-400" />
              Register Remote Clinic Branch
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Configure a peer clinic node to enable automated bidirectional delta replication.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterNode} className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-slate-300">Branch Facility Name</Label>
              <Input
                placeholder="e.g. Pune Rural Clinic or Mobile Medical Van 1"
                value={newNodeName}
                onChange={(e) => {
                  setNewNodeName(e.target.value);
                  if (!newNodeId) {
                    setNewNodeId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                  }
                }}
                className="mt-1 bg-slate-950 border-slate-800 text-xs text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-300">Node Identifier</Label>
                <Input
                  placeholder="e.g. branch_pune"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 font-mono text-xs text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Branch Type</Label>
                <select
                  value={newBranchType}
                  onChange={(e) => setNewBranchType(e.target.value as MeshNodeBranchType)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                >
                  <option value="SATELLITE">SATELLITE</option>
                  <option value="HUB">HUB</option>
                  <option value="MOBILE_CAMP">MOBILE_CAMP</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-300">Endpoint URL (WAN or VPN)</Label>
              <Input
                placeholder="https://branch-pune.clinic.net:3000 or https://192.168.10.50:3000"
                value={newEndpointUrl}
                onChange={(e) => setNewEndpointUrl(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-800 font-mono text-xs text-white"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-xs text-slate-300">Pre-Shared Cluster Secret (PSK)</Label>
                <button
                  type="button"
                  onClick={() => handleCopySecret(newSecret)}
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                >
                  {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedSecret ? 'Copied' : 'Copy'}
                </button>
              </div>
              <Input
                placeholder="Leave blank to auto-generate a 256-bit PSK"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-800 font-mono text-xs text-white"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                Save & Connect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
