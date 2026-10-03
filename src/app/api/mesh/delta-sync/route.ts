import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/db';
import {
  MESH_TOKEN_HEADER,
  MESH_SIGNATURE_HEADER,
  MESH_NODE_ID_HEADER,
  verifyMeshToken,
  verifyMeshSignature,
  applyInboundDeltas,
  getPendingOutboxDeltas,
  getLocalNodeIdentity,
} from '@/lib/mesh-replication';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const token = req.headers.get(MESH_TOKEN_HEADER);
    const signature = req.headers.get(MESH_SIGNATURE_HEADER);
    const sendingNodeId = req.headers.get(MESH_NODE_ID_HEADER);

    if (!sendingNodeId || !token || !signature) {
      return NextResponse.json(
        { error: 'Missing mesh authentication headers' },
        { status: 401 }
      );
    }

    // Look up registered node & secret
    const node = sqlite
      .prepare('SELECT cluster_secret, status FROM mesh_nodes WHERE node_id = ?')
      .get(sendingNodeId) as { cluster_secret?: string; status?: string } | undefined;

    if (!node || !node.cluster_secret || node.status === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Node is not registered or is suspended in this clinic mesh' },
        { status: 403 }
      );
    }

    // Verify token using constant-time comparison
    if (!verifyMeshToken(token, node.cluster_secret)) {
      return NextResponse.json(
        { error: 'Invalid cluster replication token' },
        { status: 401 }
      );
    }

    // Verify HMAC-SHA256 signature
    if (!verifyMeshSignature(rawBody, signature, node.cluster_secret)) {
      return NextResponse.json(
        { error: 'Invalid mesh delta signature (payload tampered or key mismatch)' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const inboundDeltas = payload.deltas || [];

    // Reconcile inbound deltas
    const reconciliation = applyInboundDeltas(sendingNodeId, inboundDeltas);

    // Get any outbound deltas destined for this sender node (bidirectional exchange)
    const outboundDeltas = getPendingOutboxDeltas(sendingNodeId, 50);
    const local = getLocalNodeIdentity();

    await logAuditEvent({
      action: 'DATA_EXPORT_PATIENTS',
      actorRole: 'SYSTEM_MESH_REPLICATION',
      details: `Mesh delta sync from ${sendingNodeId}: ${reconciliation.appliedCount} applied, ${reconciliation.conflictCount} conflicts, ${outboundDeltas.length} outbound returned`,
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      appliedCount: reconciliation.appliedCount,
      conflictCount: reconciliation.conflictCount,
      conflictsResolved: reconciliation.conflictsResolved,
      localVectorClock: local.vectorClock,
      inboundDeltas: outboundDeltas,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal mesh sync error';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
