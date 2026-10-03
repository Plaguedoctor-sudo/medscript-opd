import crypto from 'crypto';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';
import {
  MeshNode,
  MeshDelta,
  MeshNodeBranchType,
  MeshNodeStatus,
  MeshDeltaOperation,
  MeshCausalRelation,
  VectorClock,
  MeshReconciliationResult,
  MeshConflictResolution,
  MeshClusterOverview,
} from '@/types';

export const MESH_TOKEN_HEADER = 'x-medscript-mesh-token';
export const MESH_SIGNATURE_HEADER = 'x-medscript-mesh-signature';
export const MESH_NODE_ID_HEADER = 'x-medscript-mesh-node-id';

/**
 * Constant-time token verification to prevent timing attacks.
 */
export function verifyMeshToken(clientToken?: string | null, expectedSecret?: string | null): boolean {
  if (!clientToken || !expectedSecret) return false;
  const clientBuf = Buffer.from(clientToken.trim());
  const expectedBuf = Buffer.from(expectedSecret.trim());
  if (clientBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(clientBuf, expectedBuf);
}

/**
 * Signs a payload string with HMAC-SHA256 using the cluster secret.
 */
export function signMeshPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies the HMAC-SHA256 signature of a payload.
 */
export function verifyMeshSignature(payload: string, signature: string, secret: string): boolean {
  const expected = signMeshPayload(payload, secret);
  const sigBuf = Buffer.from(signature.trim());
  const expBuf = Buffer.from(expected.trim());
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Compares two vector clocks to determine their causal relationship:
 * - BEFORE: v1 happened before v2 (v1 <= v2 for all, v1 < v2 for some)
 * - AFTER: v1 happened after v2 (v1 >= v2 for all, v1 > v2 for some)
 * - EQUAL: v1 and v2 are identical
 * - CONCURRENT: neither dominates the other (concurrent / conflicting updates)
 */
export function compareVectorClocks(v1: VectorClock, v2: VectorClock): MeshCausalRelation {
  const allKeys = Array.from(new Set([...Object.keys(v1), ...Object.keys(v2)]));
  let hasGreater = false;
  let hasLesser = false;

  for (const key of allKeys) {
    const val1 = v1[key] || 0;
    const val2 = v2[key] || 0;

    if (val1 > val2) hasGreater = true;
    if (val1 < val2) hasLesser = true;
  }

  if (hasGreater && hasLesser) return 'CONCURRENT';
  if (hasGreater && !hasLesser) return 'AFTER';
  if (!hasGreater && hasLesser) return 'BEFORE';
  return 'EQUAL';
}

/**
 * Merges two vector clocks by taking the pairwise maximum component.
 */
export function mergeVectorClocks(v1: VectorClock, v2: VectorClock): VectorClock {
  const merged: VectorClock = { ...v1 };
  for (const [nodeId, count] of Object.entries(v2)) {
    merged[nodeId] = Math.max(merged[nodeId] || 0, count);
  }
  return merged;
}

/**
 * Increments the counter for a given node in a vector clock.
 */
export function incrementVectorClock(clock: VectorClock, nodeId: string): VectorClock {
  return {
    ...clock,
    [nodeId]: (clock[nodeId] || 0) + 1,
  };
}

/**
 * Computes deterministic SHA-256 seal for a mesh delta record.
 */
export function computeDeltaChecksum(delta: {
  deltaId: string;
  originNodeId: string;
  targetTable: string;
  recordKey: string;
  operation: MeshDeltaOperation;
  payload: Record<string, unknown>;
  changeTimestamp: number;
}): string {
  const serialized = JSON.stringify({
    deltaId: delta.deltaId,
    originNodeId: delta.originNodeId,
    targetTable: delta.targetTable,
    recordKey: delta.recordKey,
    operation: delta.operation,
    payload: delta.payload,
    changeTimestamp: delta.changeTimestamp,
  });
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Retrieves local node configuration and vector clock.
 */
export function getLocalNodeIdentity(): {
  nodeId: string;
  name: string;
  branchType: MeshNodeBranchType;
  vectorClock: VectorClock;
} {
  const settings = sqlite
    .prepare('SELECT clinic_name, lan_mirror_node_name FROM clinic_settings WHERE id = 1')
    .get() as { clinic_name?: string; lan_mirror_node_name?: string } | undefined;

  const clinicName = settings?.clinic_name || 'Main Hospital';
  const nodeName = settings?.lan_mirror_node_name || 'Branch Central Desk';

  // Deterministic local node ID based on name or env
  const rawId = process.env.MEDSCRIPT_NODE_ID || `branch_${nodeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const nodeId = rawId.replace(/_+/g, '_').replace(/^_|_$/g, '');

  // Read current cumulative vector clock from latest deltas
  let vectorClock: VectorClock = { [nodeId]: 0 };
  try {
    const latestRow = sqlite
      .prepare('SELECT vector_clock FROM mesh_delta_log ORDER BY id DESC LIMIT 1')
      .get() as { vector_clock?: string } | undefined;

    if (latestRow?.vector_clock) {
      vectorClock = JSON.parse(latestRow.vector_clock);
      if (typeof vectorClock[nodeId] !== 'number') {
        vectorClock[nodeId] = 0;
      }
    }
  } catch {}

  return {
    nodeId,
    name: nodeName,
    branchType: (process.env.MEDSCRIPT_BRANCH_TYPE as MeshNodeBranchType) || 'HUB',
    vectorClock,
  };
}

/**
 * Records a local mutation delta and enqueues it for all active remote mesh nodes.
 */
export function recordLocalDelta(
  targetTable: string,
  recordKey: string,
  operation: MeshDeltaOperation,
  payload: Record<string, unknown>
): MeshDelta {
  const local = getLocalNodeIdentity();
  const nextClock = incrementVectorClock(local.vectorClock, local.nodeId);
  const now = Date.now();
  const deltaId = crypto.randomUUID();

  const delta: MeshDelta = {
    deltaId,
    originNodeId: local.nodeId,
    targetTable,
    recordKey,
    operation,
    payload,
    vectorClock: nextClock,
    changeTimestamp: now,
    checksumSha256: computeDeltaChecksum({
      deltaId,
      originNodeId: local.nodeId,
      targetTable,
      recordKey,
      operation,
      payload,
      changeTimestamp: now,
    }),
  };

  sqlite.transaction(() => {
    // 1. Record in mesh_delta_log
    sqlite
      .prepare(`
        INSERT INTO mesh_delta_log (
          delta_id, origin_node_id, target_table, record_key,
          operation, payload, vector_clock, change_timestamp, checksum_sha256, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        delta.deltaId,
        delta.originNodeId,
        delta.targetTable,
        delta.recordKey,
        delta.operation,
        JSON.stringify(delta.payload),
        JSON.stringify(delta.vectorClock),
        delta.changeTimestamp,
        delta.checksumSha256,
        now
      );

    // 2. Enqueue into mesh_outbox_queue for all active remote peers
    const activeNodes = sqlite
      .prepare("SELECT node_id FROM mesh_nodes WHERE status != 'SUSPENDED' AND node_id != ?")
      .all(local.nodeId) as Array<{ node_id: string }>;

    const insertOutbox = sqlite.prepare(`
      INSERT INTO mesh_outbox_queue (target_node_id, delta_id, retry_count, status, created_at)
      VALUES (?, ?, 0, 'PENDING', ?)
    `);

    for (const node of activeNodes) {
      insertOutbox.run(node.node_id, delta.deltaId, now);
    }
  })();

  return delta;
}

/**
 * Merges two comma-separated allergy strings without duplicates.
 * Guarantees that allergies registered at any branch are permanently preserved.
 */
export function mergeAllergies(existing?: string | null, incoming?: string | null): string {
  const parseList = (s?: string | null) =>
    (s || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

  const set = new Set<string>();
  parseList(existing).forEach((a) => set.add(a));
  parseList(incoming).forEach((a) => set.add(a));

  return Array.from(set).join(', ');
}

/**
 * Reconciles and applies inbound deltas from a remote peer using CRDT & LWW resolution.
 */
export function applyInboundDeltas(
  sendingNodeId: string,
  deltas: MeshDelta[]
): MeshReconciliationResult {
  const local = getLocalNodeIdentity();
  let currentClock = { ...local.vectorClock };

  const result: MeshReconciliationResult = {
    appliedCount: 0,
    conflictCount: 0,
    skippedCount: 0,
    conflictsResolved: [],
    updatedVectorClock: currentClock,
  };

  if (!deltas || deltas.length === 0) {
    return result;
  }

  const applyTx = sqlite.transaction(() => {
    for (const delta of deltas) {
      // 1. Verify payload checksum integrity
      const expectedChecksum = computeDeltaChecksum({
        deltaId: delta.deltaId,
        originNodeId: delta.originNodeId,
        targetTable: delta.targetTable,
        recordKey: delta.recordKey,
        operation: delta.operation,
        payload: delta.payload,
        changeTimestamp: delta.changeTimestamp,
      });

      if (expectedChecksum !== delta.checksumSha256) {
        result.skippedCount++;
        continue;
      }

      // 2. Check if this delta was already applied
      const existingDelta = sqlite
        .prepare('SELECT id FROM mesh_delta_log WHERE delta_id = ?')
        .get(delta.deltaId);

      if (existingDelta) {
        result.skippedCount++;
        continue;
      }

      // 3. Find most recent local delta for this target record to determine causality
      const priorDeltaRow = sqlite
        .prepare(`
          SELECT vector_clock, change_timestamp, payload, origin_node_id
          FROM mesh_delta_log 
          WHERE target_table = ? AND record_key = ? 
          ORDER BY change_timestamp DESC, id DESC LIMIT 1
        `)
        .get(delta.targetTable, delta.recordKey) as {
          vector_clock?: string;
          change_timestamp?: number;
          payload?: string;
          origin_node_id?: string;
        } | undefined;

      let resolution: MeshConflictResolution['resolution'] = 'LWW_ACCEPTED';
      let shouldApplyPayload = true;
      let effectivePayload = { ...delta.payload };

      if (priorDeltaRow && priorDeltaRow.vector_clock) {
        const priorClock: VectorClock = JSON.parse(priorDeltaRow.vector_clock);
        const causalRel = compareVectorClocks(priorClock, delta.vectorClock);

        if (causalRel === 'AFTER') {
          // Inbound delta is strictly older than what we already have
          result.skippedCount++;
          resolution = 'LWW_SUPERSEDED';
          shouldApplyPayload = false;
        } else if (causalRel === 'CONCURRENT') {
          // Concurrent conflict!
          result.conflictCount++;

          // Special CRDT merge rule: Allergies are merged as a set union
          if (delta.targetTable === 'patients' && 'allergies' in delta.payload) {
            const priorPayload = priorDeltaRow.payload ? JSON.parse(priorDeltaRow.payload) : {};
            const merged = mergeAllergies(priorPayload.allergies, delta.payload.allergies as string);
            effectivePayload.allergies = merged;
            resolution = 'ALLERGIES_MERGED';
          } else {
            // Standard deterministic Last-Write-Wins (LWW)
            const priorTs = priorDeltaRow.change_timestamp || 0;
            if (delta.changeTimestamp < priorTs) {
              shouldApplyPayload = false;
              resolution = 'LWW_SUPERSEDED';
            } else if (delta.changeTimestamp === priorTs) {
              // Tie-breaker: lexicographical originNodeId comparison
              if (delta.originNodeId < (priorDeltaRow.origin_node_id || '')) {
                shouldApplyPayload = false;
                resolution = 'LWW_SUPERSEDED';
              } else {
                resolution = 'LWW_ACCEPTED';
              }
            } else {
              resolution = 'LWW_ACCEPTED';
            }
          }

          result.conflictsResolved.push({
            targetTable: delta.targetTable,
            recordKey: delta.recordKey,
            resolution,
            chosenOrigin: shouldApplyPayload ? delta.originNodeId : (priorDeltaRow.origin_node_id || local.nodeId),
            details: `Concurrent edit between ${delta.originNodeId} and ${priorDeltaRow.origin_node_id || 'local'}`,
          });
        }
      }

      // 4. Record inbound delta into mesh_delta_log
      sqlite
        .prepare(`
          INSERT INTO mesh_delta_log (
            delta_id, origin_node_id, target_table, record_key,
            operation, payload, vector_clock, change_timestamp, checksum_sha256, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          delta.deltaId,
          delta.originNodeId,
          delta.targetTable,
          delta.recordKey,
          delta.operation,
          JSON.stringify(effectivePayload),
          JSON.stringify(delta.vectorClock),
          delta.changeTimestamp,
          delta.checksumSha256,
          Date.now()
        );

      // 5. If payload should be applied, execute table update
      if (shouldApplyPayload) {
        applyPayloadToDatabase(delta.targetTable, delta.operation, effectivePayload);
        result.appliedCount++;
      }

      // 6. Merge vector clocks
      currentClock = mergeVectorClocks(currentClock, delta.vectorClock);
    }

    // 7. Update sending node's recorded vector clock & last seen
    sqlite
      .prepare(`
        UPDATE mesh_nodes 
        SET vector_clock = ?, last_seen_at = ?, last_sync_at = ?, last_sync_status = 'SYNCED', updated_at = ?
        WHERE node_id = ?
      `)
      .run(
        JSON.stringify(currentClock),
        Date.now(),
        Date.now(),
        Date.now(),
        sendingNodeId
      );
  });

  applyTx();
  result.updatedVectorClock = currentClock;
  return result;
}

/**
 * Applies a verified delta payload to the live SQLite table.
 */
function applyPayloadToDatabase(
  targetTable: string,
  operation: MeshDeltaOperation,
  payload: Record<string, unknown>
): void {
  try {
    if (operation === 'DELETE') {
      if (targetTable === 'patients' && payload.id) {
        sqlite.prepare('DELETE FROM patients WHERE id = ?').run(payload.id);
      } else if (targetTable === 'prescriptions' && payload.id) {
        sqlite.prepare('DELETE FROM prescriptions WHERE id = ?').run(payload.id);
      }
      return;
    }

    if (targetTable === 'patients') {
      const p = payload as {
        id?: number;
        name?: string;
        age?: number;
        gender?: string;
        phone?: string;
        reg_no?: string;
        allergies?: string;
        blood_group?: string;
        abha_id?: string;
        abha_address?: string;
      };

      if (p.id) {
        const existing = sqlite.prepare('SELECT id FROM patients WHERE id = ?').get(p.id);
        if (existing) {
          sqlite
            .prepare(`
              UPDATE patients SET
                name = COALESCE(?, name),
                age = COALESCE(?, age),
                gender = COALESCE(?, gender),
                phone = COALESCE(?, phone),
                allergies = COALESCE(?, allergies),
                blood_group = COALESCE(?, blood_group),
                abha_id = COALESCE(?, abha_id),
                abha_address = COALESCE(?, abha_address)
              WHERE id = ?
            `)
            .run(p.name, p.age, p.gender, p.phone, p.allergies, p.blood_group, p.abha_id, p.abha_address, p.id);
        } else {
          sqlite
            .prepare(`
              INSERT INTO patients (id, reg_no, name, age, gender, phone, allergies, blood_group, abha_id, abha_address, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(p.id, p.reg_no || null, p.name || 'Patient', p.age || 0, p.gender || 'Other', p.phone || null, p.allergies || null, p.blood_group || null, p.abha_id || null, p.abha_address || null, Date.now());
        }
      }
    }
  } catch (err) {
    console.error(`[MESH REPLICATION] Failed to apply delta to table ${targetTable}:`, err);
  }
}

/**
 * Retrieves pending outbox deltas for a specific remote node.
 */
export function getPendingOutboxDeltas(targetNodeId: string, limit = 50): MeshDelta[] {
  const rows = sqlite
    .prepare(`
      SELECT 
        l.delta_id, l.origin_node_id, l.target_table, l.record_key,
        l.operation, l.payload, l.vector_clock, l.change_timestamp, l.checksum_sha256
      FROM mesh_outbox_queue q
      JOIN mesh_delta_log l ON q.delta_id = l.delta_id
      WHERE q.target_node_id = ? AND q.status = 'PENDING'
      ORDER BY q.id ASC
      LIMIT ?
    `)
    .all(targetNodeId, limit) as Array<{
      delta_id: string;
      origin_node_id: string;
      target_table: string;
      record_key: string;
      operation: string;
      payload: string;
      vector_clock: string;
      change_timestamp: number;
      checksum_sha256: string;
    }>;

  return rows.map((r) => ({
    deltaId: r.delta_id,
    originNodeId: r.origin_node_id,
    targetTable: r.target_table,
    recordKey: r.record_key,
    operation: r.operation as MeshDeltaOperation,
    payload: JSON.parse(r.payload),
    vectorClock: JSON.parse(r.vector_clock),
    changeTimestamp: r.change_timestamp,
    checksumSha256: r.checksum_sha256,
  }));
}

/**
 * Acknowledges deltas successfully transferred to a remote peer.
 */
export function acknowledgeOutboxDeltas(targetNodeId: string, deltaIds: string[]): void {
  if (!deltaIds || deltaIds.length === 0) return;
  const placeholders = deltaIds.map(() => '?').join(',');
  sqlite
    .prepare(`
      UPDATE mesh_outbox_queue 
      SET status = 'ACKNOWLEDGED' 
      WHERE target_node_id = ? AND delta_id IN (${placeholders})
    `)
    .run(targetNodeId, ...deltaIds);
}

/**
 * Marks failed outbox items for exponential backoff retry.
 */
export function markOutboxRetry(targetNodeId: string, deltaIds: string[], errorMessage: string): void {
  if (!deltaIds || deltaIds.length === 0) return;
  const placeholders = deltaIds.map(() => '?').join(',');
  const nextRetry = Date.now() + 60000; // Retry in 1 minute
  sqlite
    .prepare(`
      UPDATE mesh_outbox_queue 
      SET retry_count = retry_count + 1, next_retry_at = ?, status = 'PENDING', last_error = ?
      WHERE target_node_id = ? AND delta_id IN (${placeholders})
    `)
    .run(nextRetry, errorMessage, targetNodeId, ...deltaIds);
}

/**
 * Synchronizes with a remote peer over an intermittent WAN link.
 */
export async function syncWithPeerNode(
  node: MeshNode
): Promise<{ success: boolean; pushedCount: number; receivedCount: number; error?: string }> {
  const local = getLocalNodeIdentity();
  const pendingDeltas = getPendingOutboxDeltas(node.nodeId, 50);

  const syncPayload = JSON.stringify({
    sendingNodeId: local.nodeId,
    sendingNodeName: local.name,
    vectorClock: local.vectorClock,
    deltas: pendingDeltas,
  });

  const row = sqlite
    .prepare('SELECT cluster_secret FROM mesh_nodes WHERE node_id = ?')
    .get(node.nodeId) as { cluster_secret?: string } | undefined;

  const secret = row?.cluster_secret || 'medscript-default-mesh-secret';
  const signature = signMeshPayload(syncPayload, secret);

  const start = Date.now();
  try {
    const res = await fetch(`${node.endpointUrl}/api/mesh/delta-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [MESH_TOKEN_HEADER]: secret,
        [MESH_SIGNATURE_HEADER]: signature,
        [MESH_NODE_ID_HEADER]: local.nodeId,
      },
      body: syncPayload,
      signal: AbortSignal.timeout(10000), // 10s WAN timeout
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      throw new Error(`Remote peer rejected sync with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const deltaIds = pendingDeltas.map((d) => d.deltaId);
    acknowledgeOutboxDeltas(node.nodeId, deltaIds);

    // If peer returned inbound deltas to apply
    let receivedCount = 0;
    if (data.inboundDeltas && Array.isArray(data.inboundDeltas)) {
      const reconResult = applyInboundDeltas(node.nodeId, data.inboundDeltas);
      receivedCount = reconResult.appliedCount;
    }

    // Update node status
    sqlite
      .prepare(`
        UPDATE mesh_nodes 
        SET status = 'ACTIVE', last_seen_at = ?, last_sync_at = ?, last_sync_status = 'SYNCED', latency_ms = ?
        WHERE node_id = ?
      `)
      .run(Date.now(), Date.now(), latency, node.nodeId);

    return {
      success: true,
      pushedCount: pendingDeltas.length,
      receivedCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Mesh WAN peer unreachable';
    markOutboxRetry(node.nodeId, pendingDeltas.map((d) => d.deltaId), msg);

    sqlite
      .prepare(`
        UPDATE mesh_nodes 
        SET status = 'OFFLINE', last_sync_status = ?, updated_at = ?
        WHERE node_id = ?
      `)
      .run(`ERROR: ${msg.slice(0, 100)}`, Date.now(), node.nodeId);

    return {
      success: false,
      pushedCount: 0,
      receivedCount: 0,
      error: msg,
    };
  }
}

/**
 * Returns comprehensive cluster overview for all registered mesh branch nodes.
 */
export function getMeshClusterOverview(): MeshClusterOverview {
  const local = getLocalNodeIdentity();

  const nodeRows = sqlite
    .prepare(`
      SELECT 
        n.id, n.node_id, n.name, n.branch_type, n.endpoint_url, n.status,
        n.vector_clock, n.last_seen_at, n.last_sync_at, n.last_sync_status,
        n.latency_ms, n.created_at, n.updated_at,
        COUNT(CASE WHEN q.status = 'PENDING' THEN 1 END) as pending_outbox_count
      FROM mesh_nodes n
      LEFT JOIN mesh_outbox_queue q ON n.node_id = q.target_node_id
      GROUP BY n.id
      ORDER BY n.name ASC
    `)
    .all() as Array<{
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
      pending_outbox_count: number;
    }>;

  const nodes: MeshNode[] = nodeRows.map((r) => ({
    id: r.id,
    nodeId: r.node_id,
    name: r.name,
    branchType: r.branch_type as MeshNodeBranchType,
    endpointUrl: r.endpoint_url,
    status: r.status as MeshNodeStatus,
    vectorClock: r.vector_clock ? JSON.parse(r.vector_clock) : {},
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : null,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at) : null,
    lastSyncStatus: r.last_sync_status,
    latencyMs: r.latency_ms,
    pendingOutboxCount: r.pending_outbox_count || 0,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }));

  const totalPending = nodes.reduce((sum, n) => sum + n.pendingOutboxCount, 0);

  const lastSyncRow = sqlite
    .prepare('SELECT MAX(last_sync_at) as max_sync FROM mesh_nodes')
    .get() as { max_sync?: number } | undefined;

  return {
    localNodeId: local.nodeId,
    localNodeName: local.name,
    localBranchType: local.branchType,
    localVectorClock: local.vectorClock,
    nodes,
    totalPendingOutbox: totalPending,
    lastMeshSyncAt: lastSyncRow?.max_sync ? new Date(lastSyncRow.max_sync) : null,
  };
}
