'use server';

import crypto from 'crypto';
import { requirePermission, isDoctor } from '@/lib/auth';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import {
  getMeshClusterOverview,
  syncWithPeerNode,
  getLocalNodeIdentity,
} from '@/lib/mesh-replication';
import {
  MeshNode,
  MeshNodeBranchType,
  MeshNodeStatus,
  MeshClusterOverview,
} from '@/types';

/**
 * Returns comprehensive cluster overview for all registered mesh branch nodes.
 */
export async function getMeshClusterOverviewAction(): Promise<{
  success: boolean;
  data?: MeshClusterOverview;
  error?: string;
}> {
  await requirePermission('settings:clinic');

  try {
    const overview = getMeshClusterOverview();
    return { success: true, data: overview };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve mesh cluster overview';
    return { success: false, error: msg };
  }
}

/**
 * Registers or updates a remote clinic branch node in the replication mesh.
 */
export async function registerMeshNodeAction(nodeData: {
  nodeId: string;
  name: string;
  branchType: MeshNodeBranchType;
  endpointUrl: string;
  clusterSecret?: string;
}): Promise<{ success: boolean; error?: string }> {
  const role = await requirePermission('settings:clinic');

  const cleanNodeId = nodeData.nodeId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const cleanName = nodeData.name.trim();
  const cleanUrl = nodeData.endpointUrl.trim().replace(/\/+$/, '');
  const secret = nodeData.clusterSecret?.trim() || crypto.randomBytes(32).toString('hex');

  if (!cleanNodeId || !cleanName || !cleanUrl) {
    return { success: false, error: 'Node ID, Name, and Endpoint URL are required.' };
  }

  const local = getLocalNodeIdentity();
  if (cleanNodeId === local.nodeId) {
    return { success: false, error: 'Cannot register local node as a remote peer.' };
  }

  try {
    const now = Date.now();
    sqlite
      .prepare(`
        INSERT INTO mesh_nodes (
          node_id, name, branch_type, endpoint_url, cluster_secret, status,
          vector_clock, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', '{}', ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET
          name = excluded.name,
          branch_type = excluded.branch_type,
          endpoint_url = excluded.endpoint_url,
          cluster_secret = COALESCE(NULLIF(excluded.cluster_secret, ''), mesh_nodes.cluster_secret),
          updated_at = excluded.updated_at
      `)
      .run(cleanNodeId, cleanName, nodeData.branchType, cleanUrl, secret, now, now);

    await logAuditEvent({
      action: 'SETTINGS_SAVED',
      actorRole: role.toUpperCase(),
      details: `Registered/updated mesh branch node: ${cleanName} (${cleanNodeId}) at ${cleanUrl}`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to register mesh node';
    return { success: false, error: msg };
  }
}

/**
 * Updates status (ACTIVE, SUSPENDED, OFFLINE) of a registered mesh branch node.
 */
export async function updateMeshNodeStatusAction(
  nodeId: string,
  status: MeshNodeStatus
): Promise<{ success: boolean; error?: string }> {
  const role = await requirePermission('settings:clinic');

  try {
    sqlite
      .prepare('UPDATE mesh_nodes SET status = ?, updated_at = ? WHERE node_id = ?')
      .run(status, Date.now(), nodeId);

    await logAuditEvent({
      action: 'SECURITY_SETTINGS_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Updated mesh node status for ${nodeId} to ${status}`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update node status';
    return { success: false, error: msg };
  }
}

/**
 * Decommissions a mesh branch node and purges its outbox queue.
 */
export async function deleteMeshNodeAction(
  nodeId: string
): Promise<{ success: boolean; error?: string }> {
  const role = await requirePermission('settings:clinic');

  try {
    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM mesh_outbox_queue WHERE target_node_id = ?').run(nodeId);
      sqlite.prepare('DELETE FROM mesh_nodes WHERE node_id = ?').run(nodeId);
    })();

    await logAuditEvent({
      action: 'SECURITY_SETTINGS_UPDATED',
      actorRole: role.toUpperCase(),
      details: `Decommissioned mesh branch node ${nodeId} and purged outbox queue`,
      status: 'SUCCESS',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete mesh node';
    return { success: false, error: msg };
  }
}

/**
 * Manually triggers a delta sync with a specific remote mesh branch node.
 */
export async function triggerPeerSyncAction(
  nodeId: string
): Promise<{ success: boolean; pushedCount?: number; receivedCount?: number; error?: string }> {
  await requirePermission('settings:clinic');

  const row = sqlite
    .prepare(`
      SELECT 
        id, node_id, name, branch_type, endpoint_url, status,
        vector_clock, last_seen_at, last_sync_at, last_sync_status, latency_ms,
        created_at, updated_at
      FROM mesh_nodes WHERE node_id = ?
    `)
    .get(nodeId) as {
      id: number;
      node_id: string;
      name: string;
      branch_type: string;
      endpoint_url: string;
      status: string;
      vector_clock: string;
      last_seen_at: number | null;
      last_sync_at: number | null;
      last_sync_status: string | null;
      latency_ms: number;
      created_at: number;
      updated_at: number;
    } | undefined;

  if (!row) {
    return { success: false, error: 'Mesh node not found' };
  }

  const node: MeshNode = {
    id: row.id,
    nodeId: row.node_id,
    name: row.name,
    branchType: row.branch_type as MeshNodeBranchType,
    endpointUrl: row.endpoint_url,
    status: row.status as MeshNodeStatus,
    vectorClock: row.vector_clock ? JSON.parse(row.vector_clock) : {},
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
    lastSyncStatus: row.last_sync_status,
    latencyMs: row.latency_ms,
    pendingOutboxCount: 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  const result = await syncWithPeerNode(node);
  return result;
}

/**
 * Purges acknowledged deltas older than 7 days to conserve disk space.
 */
export async function purgeAcknowledgedDeltasAction(): Promise<{ success: boolean; purgedCount: number; error?: string }> {
  const role = await requirePermission('settings:clinic');
  const cutoff = Date.now() - 7 * 86400000;

  try {
    const result = sqlite
      .prepare("DELETE FROM mesh_outbox_queue WHERE status = 'ACKNOWLEDGED' AND created_at < ?")
      .run(cutoff);

    await logAuditEvent({
      action: 'BACKUP_SNAPSHOT_CREATED',
      actorRole: role.toUpperCase(),
      details: `Purged ${result.changes} acknowledged mesh replication outbox entries`,
      status: 'SUCCESS',
    });

    return { success: true, purgedCount: result.changes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to purge outbox records';
    return { success: false, purgedCount: 0, error: msg };
  }
}
