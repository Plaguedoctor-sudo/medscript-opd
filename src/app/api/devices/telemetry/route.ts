import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { medicalDevices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  ingestDeviceTelemetryAction,
} from '@/app/ipd/device-actions';
import { parseHl7Pcd01Telemetry } from '@/lib/device-telemetry-engine';

/**
 * Standard Medical Device Telemetry Ingest API Route
 * Accepts JSON or HL7 PCD-01 formatted telemetry from bedside monitors, ventilators, and pumps.
 * 
 * Headers:
 *   Content-Type: application/json OR text/plain (HL7)
 *   X-Device-Id: DEV-ICU-MON-01 (or inside JSON body)
 *   X-Device-Secret: optional authorization key
 */
export async function POST(req: NextRequest) {
  try {
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
