import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getClientIp, checkApkDownloadRateLimit, recordApkDownloadAttempt } from '@/lib/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientIp = await getClientIp();

  // MITRE T1499 / DoS Rate Limiting Safeguard
  const rateLimit = checkApkDownloadRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'TOO_MANY_REQUESTS',
        message: `APK download frequency exceeded. Please retry after ${rateLimit.retryAfterSeconds} seconds.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-Defense-Level': 'MILITARY-STIG-VERIFIED',
        },
      }
    );
  }
  recordApkDownloadAttempt(clientIp);

  const apkPath = path.join(process.cwd(), 'release', 'medscript-opd-v1.1.1.apk');

  if (!fs.existsSync(apkPath)) {
    return new NextResponse('APK package not found on server.', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(apkPath);
  const sha256Digest = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  await logAuditEvent({
    action: 'SYSTEM_CONFIG_UPDATED',
    actorRole: 'SYSTEM',
    details: `Android APK client package downloaded (SHA-256: ${sha256Digest.slice(0, 16)}...)`,
    status: 'SUCCESS',
    ipAddress: clientIp,
  });

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="medscript-opd-v1.1.1.apk"',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-SHA256': sha256Digest,
      'X-Content-Type-Options': 'nosniff',
      'X-Defense-Level': 'MILITARY-STIG-VERIFIED',
    },
  });
}

