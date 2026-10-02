import { NextResponse } from 'next/server';
import {
  getLanMirrorConfig,
  verifyClusterToken,
  createReplicationPackage,
  applyReplicationSnapshot,
  HA_TOKEN_HEADER,
  HA_SIGNATURE_HEADER,
} from '@/lib/lan-mirroring';

export async function GET(request: Request) {
  const config = getLanMirrorConfig();
  const incomingToken = request.headers.get(HA_TOKEN_HEADER);

  if (!verifyClusterToken(incomingToken, config.clusterSecret)) {
    return NextResponse.json(
      { error: 'INVALID_CLUSTER_TOKEN', message: 'Unauthorized cluster communication attempt' },
      { status: 401 }
    );
  }

  try {
    const pkg = await createReplicationPackage(config.clusterSecret);

    return new NextResponse(new Uint8Array(pkg.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': 'attachment; filename="lan-mirror-sync.db"',
        [HA_SIGNATURE_HEADER]: pkg.signature,
        'x-medscript-ha-hash': pkg.sha256,
        'x-medscript-ha-timestamp': String(pkg.timestamp),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate sync package';
    return NextResponse.json({ error: 'SNAPSHOT_EXPORT_FAILED', message: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const config = getLanMirrorConfig();
  const incomingToken = request.headers.get(HA_TOKEN_HEADER);

  if (!verifyClusterToken(incomingToken, config.clusterSecret)) {
    return NextResponse.json(
      { error: 'INVALID_CLUSTER_TOKEN', message: 'Unauthorized cluster communication attempt' },
      { status: 401 }
    );
  }

  const signature = request.headers.get(HA_SIGNATURE_HEADER);
  if (!signature) {
    return NextResponse.json(
      { error: 'MISSING_SIGNATURE', message: 'Replication payload is missing HMAC signature' },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'LAN_PEER';
    const result = await applyReplicationSnapshot(buffer, signature, config.clusterSecret, clientIp);

    return NextResponse.json({
      success: true,
      message: 'Replication snapshot applied successfully',
      hash: result.hash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to apply snapshot';
    return NextResponse.json({ error: 'SNAPSHOT_APPLY_FAILED', message: msg }, { status: 500 });
  }
}
