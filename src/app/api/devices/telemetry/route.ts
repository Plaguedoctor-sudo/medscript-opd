import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { medicalDevices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  ingestDeviceTelemetryAction,
} from '@/app/ipd/device-actions';
import { parseHl7Pcd01Telemetry } from '@/lib/device-telemetry-engine';
import { getSessionSecret, parseSessionToken, SESSION_COOKIE_NAME, canDo, safeCompare } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

/**
 * Standard Medical Device Telemetry Ingest API Route
 * Accepts JSON or HL7 PCD-01 formatted telemetry from bedside monitors, ventilators, and pumps.
 * 
 * Headers:
 *   Content-Type: application/json OR text/plain (HL7)
 *   X-Device-Id: DEV-ICU-MON-01 (or inside JSON body)
 *   X-Device-Secret: authorization key (or Authorization: Bearer <secret>)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request:
    // Option A: Active staff session with 'device:telemetry' or 'device:manage'
    // Option B: Valid machine-to-machine Pre-Shared Key via X-Device-Secret or Bearer token
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const parsedSession = parseSessionToken(sessionCookie);
    const hasSessionAuth = parsedSession.valid && canDo(parsedSession.role, 'device:telemetry');

    const headerSecret = req.headers.get('x-device-secret') || '';
    const authHeader = req.headers.get('authorization') || '';
    const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const candidateSecret = (headerSecret || bearerSecret).trim();

    const expectedGlobalSecret = process.env.DEVICE_INGEST_SECRET || getSessionSecret();
    const hasGlobalSecretAuth = candidateSecret ? safeCompare(candidateSecret, expectedGlobalSecret) : false;

    const contentType = req.headers.get('content-type') || '';
    const headerDeviceId = req.headers.get('x-device-id');

    let payload: any = {};

    if (contentType.includes('text/plain') || contentType.includes('application/hl7-v2')) {
      const hl7Text = await req.text();
      const parsed = parseHl7Pcd01Telemetry(hl7Text);
      payload = {
        ...parsed,
        deviceId: headerDeviceId || 'DEV-HL7-INGEST',
        rawPayload: hl7Text,
      };
    } else {
      payload = await req.json();
      if (!payload.deviceId && headerDeviceId) {
        payload.deviceId = headerDeviceId;
      }
    }

    if (!payload.deviceId) {
      return NextResponse.json(
        { error: 'Missing deviceId parameter in payload or X-Device-Id header' },
        { status: 400 }
      );
    }

    // Verify device exists
    const device = await db.query.medicalDevices.findFirst({
      where: eq(medicalDevices.deviceId, payload.deviceId),
    });

    if (!device) {
      return NextResponse.json(
        { error: `Device ${payload.deviceId} is not registered in MedScript` },
        { status: 404 }
      );
    }

    // Check device-specific pre-shared key if configured in device config
    let hasDeviceSpecificAuth = false;
    if (device.config && candidateSecret) {
      try {
        const conf = JSON.parse(device.config);
        if (conf.deviceSecret && typeof conf.deviceSecret === 'string') {
          hasDeviceSpecificAuth = safeCompare(candidateSecret, conf.deviceSecret);
        }
      } catch {}
    }

    if (!hasSessionAuth && !hasGlobalSecretAuth && !hasDeviceSpecificAuth) {
      await logAuditEvent({
        action: 'SECURITY_ALERT_TRIGGERED',
        actorRole: 'ANONYMOUS',
        details: `Unauthorized telemetry injection attempt blocked for device ${payload.deviceId}: invalid or missing device secret`,
        status: 'FAILURE',
      });
      return NextResponse.json(
        { error: 'Unauthorized: Valid X-Device-Secret, Bearer token, or clinical session required.' },
        { status: 401 }
      );
    }

    const result = await ingestDeviceTelemetryAction(payload);

    return NextResponse.json({
      status: 'SUCCESS',
      deviceId: payload.deviceId,
      recordedAt: new Date().toISOString(),
      news2Score: result.news2.score,
      riskLevel: result.news2.riskLevel,
      alertCount: result.alerts.length,
      alerts: result.alerts,
    });
  } catch (error: any) {
    console.error('Device telemetry ingest error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to ingest device telemetry' },
      { status: 500 }
    );
  }
}
