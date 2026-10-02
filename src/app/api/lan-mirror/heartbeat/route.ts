import { NextResponse } from 'next/server';
import {
  getLanMirrorConfig,
  verifyClusterToken,
  computeDatabaseHash,
  HA_TOKEN_HEADER,
} from '@/lib/lan-mirroring';

export async function GET(request: Request) {
  return handleHeartbeat(request);
}

export async function POST(request: Request) {
  return handleHeartbeat(request);
}

async function handleHeartbeat(request: Request) {
  const config = getLanMirrorConfig();
  const incomingToken = request.headers.get(HA_TOKEN_HEADER);

  if (!verifyClusterToken(incomingToken, config.clusterSecret)) {
    return NextResponse.json(
      { error: 'INVALID_CLUSTER_TOKEN', message: 'Unauthorized cluster communication attempt' },
      { status: 401 }
    );
  }

  const dbHash = computeDatabaseHash();

  return NextResponse.json({
    status: 'ONLINE',
    role: config.role,
    nodeName: config.nodeName,
    dbHash,
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
  });
}
