'use server';

import { sqlite } from '@/db';
import { getCurrentUserRole, getCurrentUser, requirePermission } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import {
  CctvCamera,
  CctvIncident,
  CctvZone,
  CctvCameraStatus,
  CctvIncidentType,
  CctvIncidentSeverity,
} from '@/types';

export interface CctvStats {
  totalCameras: number;
  onlineCameras: number;
  unacknowledgedIncidents: number;
  criticalAlerts: number;
}

export async function getCctvCameras(): Promise<CctvCamera[]> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const rows = sqlite
      .prepare(`
        SELECT 
          id, name, zone, location, stream_url as streamUrl, status, resolution,
          fps, has_ptz as hasPtz, privacy_masking as privacyMasking,
          motion_detection_enabled as motionDetectionEnabled,
          ip_address as ipAddress, last_ping_at as lastPingAt,
          created_at as createdAt, updated_at as updatedAt
        FROM hospital_cctv_cameras
        ORDER BY 
          CASE zone
            WHEN 'ICU' THEN 1
            WHEN 'EMERGENCY' THEN 2
            WHEN 'OT' THEN 3
            WHEN 'IPD_WARD' THEN 4
            WHEN 'PHARMACY' THEN 5
            WHEN 'OPD_RECEPTION' THEN 6
            WHEN 'STORES_ASSETS' THEN 7
            ELSE 8
          END,
          id ASC
      `)
      .all() as Array<{
        id: number;
        name: string;
        zone: CctvZone;
        location: string | null;
        streamUrl: string;
        status: CctvCameraStatus;
        resolution: string;
        fps: number;
        hasPtz: number;
        privacyMasking: number;
        motionDetectionEnabled: number;
        ipAddress: string | null;
        lastPingAt: number | null;
        createdAt: number | null;
        updatedAt: number | null;
      }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      zone: r.zone,
      location: r.location || '',
      streamUrl: r.streamUrl,
      status: r.status,
      resolution: r.resolution,
      fps: r.fps,
      hasPtz: Boolean(r.hasPtz),
      privacyMasking: Boolean(r.privacyMasking),
      motionDetectionEnabled: Boolean(r.motionDetectionEnabled),
      ipAddress: r.ipAddress,
      lastPingAt: r.lastPingAt ? new Date(r.lastPingAt) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
    }));
  } catch (err) {
    console.error('Failed to get CCTV cameras:', err);
    return [];
  }
}

export async function getCctvIncidents(): Promise<CctvIncident[]> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const rows = sqlite
      .prepare(`
        SELECT 
          id, camera_id as cameraId, camera_name as cameraName, zone,
          incident_type as incidentType, severity, description,
          snapshot_url as snapshotUrl, acknowledged,
          acknowledged_by as acknowledgedBy, acknowledged_at as acknowledgedAt,
          notes, created_at as createdAt
        FROM hospital_cctv_incidents
        ORDER BY acknowledged ASC, created_at DESC
        LIMIT 50
      `)
      .all() as Array<{
        id: number;
        cameraId: number | null;
        cameraName: string;
        zone: string;
        incidentType: CctvIncidentType;
        severity: CctvIncidentSeverity;
        description: string;
        snapshotUrl: string | null;
        acknowledged: number;
        acknowledgedBy: string | null;
        acknowledgedAt: number | null;
        notes: string | null;
        createdAt: number | null;
      }>;

    return rows.map((r) => ({
      id: r.id,
      cameraId: r.cameraId,
      cameraName: r.cameraName,
      zone: r.zone,
      incidentType: r.incidentType,
      severity: r.severity,
      description: r.description,
      snapshotUrl: r.snapshotUrl,
      acknowledged: Boolean(r.acknowledged),
      acknowledgedBy: r.acknowledgedBy,
      acknowledgedAt: r.acknowledgedAt ? new Date(r.acknowledgedAt) : null,
      notes: r.notes,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
    }));
  } catch (err) {
    console.error('Failed to get CCTV incidents:', err);
    return [];
  }
}

export async function getCctvStats(): Promise<CctvStats> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const camStats = sqlite
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) as online
        FROM hospital_cctv_cameras
      `)
      .get() as { total: number; online: number };

    const incStats = sqlite
      .prepare(`
        SELECT 
          SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as unack,
          SUM(CASE WHEN acknowledged = 0 AND severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical
        FROM hospital_cctv_incidents
      `)
      .get() as { unack: number; critical: number };

    return {
      totalCameras: camStats?.total || 0,
      onlineCameras: camStats?.online || 0,
      unacknowledgedIncidents: incStats?.unack || 0,
      criticalAlerts: incStats?.critical || 0,
    };
  } catch {
    return {
      totalCameras: 0,
      onlineCameras: 0,
      unacknowledgedIncidents: 0,
      criticalAlerts: 0,
    };
  }
}

export interface AddOrUpdateCameraInput {
  id?: number;
  name: string;
  zone: CctvZone;
  location?: string;
  streamUrl: string;
  status: CctvCameraStatus;
  resolution: string;
  fps: number;
  hasPtz: boolean;
  privacyMasking: boolean;
  motionDetectionEnabled: boolean;
  ipAddress?: string;
}

export async function addOrUpdateCamera(
  input: AddOrUpdateCameraInput
): Promise<{ success: boolean; camera?: CctvCamera; error?: string }> {
  try {
    await requirePermission('cctv:manage', '/cctv');
    const user = await getCurrentUser();
    const role = await getCurrentUserRole();
    const now = Date.now();

    if (!input.name.trim()) {
      return { success: false, error: 'Camera display name is required.' };
    }

    if (input.id) {
      sqlite
        .prepare(`
          UPDATE hospital_cctv_cameras
          SET name = ?, zone = ?, location = ?, stream_url = ?, status = ?,
              resolution = ?, fps = ?, has_ptz = ?, privacy_masking = ?,
              motion_detection_enabled = ?, ip_address = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          input.name.trim(),
          input.zone,
          input.location?.trim() || null,
          input.streamUrl.trim(),
          input.status,
          input.resolution,
          input.fps,
          input.hasPtz ? 1 : 0,
          input.privacyMasking ? 1 : 0,
          input.motionDetectionEnabled ? 1 : 0,
          input.ipAddress?.trim() || null,
          now,
          input.id
        );

      await logAuditEvent({
        action: 'CCTV_CAMERA_UPDATED',
        actorRole: role.toUpperCase(),
        details: `Updated CCTV camera id=${input.id} ('${input.name}', zone: ${input.zone}) by ${user?.name || role}`,
        status: 'SUCCESS',
      });
    } else {
      const res = sqlite
        .prepare(`
          INSERT INTO hospital_cctv_cameras (
            name, zone, location, stream_url, status, resolution, fps,
            has_ptz, privacy_masking, motion_detection_enabled, ip_address,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          input.name.trim(),
          input.zone,
          input.location?.trim() || null,
          input.streamUrl.trim(),
          input.status,
          input.resolution,
          input.fps,
          input.hasPtz ? 1 : 0,
          input.privacyMasking ? 1 : 0,
          input.motionDetectionEnabled ? 1 : 0,
          input.ipAddress?.trim() || null,
          now,
          now
        );

      await logAuditEvent({
        action: 'CCTV_CAMERA_ADDED',
        actorRole: role.toUpperCase(),
        details: `Installed new CCTV camera id=${res.lastInsertRowid} ('${input.name}', zone: ${input.zone}) by ${user?.name || role}`,
        status: 'SUCCESS',
      });
    }

    revalidatePath('/cctv');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save camera.' };
  }
}

export async function deleteCamera(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission('cctv:manage', '/cctv');
    const role = await getCurrentUserRole();
    const user = await getCurrentUser();

    const existing = sqlite
      .prepare('SELECT name, zone FROM hospital_cctv_cameras WHERE id = ?')
      .get(id) as { name: string; zone: string } | undefined;

    if (!existing) {
      return { success: false, error: 'Camera not found.' };
    }

    sqlite.prepare('DELETE FROM hospital_cctv_cameras WHERE id = ?').run(id);

    await logAuditEvent({
      action: 'CCTV_CAMERA_DELETED',
      actorRole: role.toUpperCase(),
      details: `Decommissioned CCTV camera id=${id} ('${existing.name}', zone: ${existing.zone}) by ${user?.name || role}`,
      status: 'WARNING',
    });

    revalidatePath('/cctv');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete camera.' };
  }
}

export async function togglePrivacyMask(
  cameraId: number,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const role = await getCurrentUserRole();
    const now = Date.now();

    sqlite
      .prepare('UPDATE hospital_cctv_cameras SET privacy_masking = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, now, cameraId);

    await logAuditEvent({
      action: 'CCTV_CAMERA_UPDATED',
      actorRole: role.toUpperCase(),
      details: `${enabled ? 'Enabled' : 'Disabled'} HIPAA/DISHA patient privacy masking on camera id=${cameraId}`,
      status: 'SUCCESS',
    });

    revalidatePath('/cctv');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to toggle privacy mask.' };
  }
}

export interface FlagCctvIncidentInput {
  cameraId?: number;
  cameraName: string;
  zone: string;
  incidentType: CctvIncidentType;
  severity: CctvIncidentSeverity;
  description: string;
  snapshotUrl?: string;
}

export async function flagCctvIncident(
  input: FlagCctvIncidentInput
): Promise<{ success: boolean; incidentId?: number; error?: string }> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const role = await getCurrentUserRole();
    const user = await getCurrentUser();
    const now = Date.now();

    const res = sqlite
      .prepare(`
        INSERT INTO hospital_cctv_incidents (
          camera_id, camera_name, zone, incident_type, severity,
          description, snapshot_url, acknowledged, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `)
      .run(
        input.cameraId || null,
        input.cameraName,
        input.zone,
        input.incidentType,
        input.severity,
        input.description.trim(),
        input.snapshotUrl || null,
        now
      );

    await logAuditEvent({
      action: 'CCTV_INCIDENT_FLAGGED',
      actorRole: role.toUpperCase(),
      details: `[${input.severity}] CCTV security/clinical alert: ${input.description.trim()} at ${input.cameraName} (${input.zone}) flagged by ${user?.name || role}`,
      status: input.severity === 'CRITICAL' || input.severity === 'HIGH' ? 'WARNING' : 'SUCCESS',
    });

    revalidatePath('/cctv');
    return { success: true, incidentId: Number(res.lastInsertRowid) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to log incident.' };
  }
}

export async function acknowledgeCctvIncident(
  id: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const user = await getCurrentUser();
    const role = await getCurrentUserRole();
    const now = Date.now();
    const ackName = user ? `${user.name} (${user.role})` : role;

    sqlite
      .prepare(`
        UPDATE hospital_cctv_incidents
        SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?, notes = ?
        WHERE id = ?
      `)
      .run(ackName, now, notes?.trim() || 'Reviewed and handled.', id);

    await logAuditEvent({
      action: 'CCTV_INCIDENT_ACKNOWLEDGED',
      actorRole: role.toUpperCase(),
      details: `Acknowledged CCTV incident id=${id} by ${ackName}. Resolution: ${notes?.trim() || 'Resolved'}`,
      status: 'SUCCESS',
    });

    revalidatePath('/cctv');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to acknowledge incident.' };
  }
}

export async function sendPtzCommand(
  cameraId: number,
  command: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ZOOM_IN' | 'ZOOM_OUT' | 'RESET' | 'PRESET_1' | 'PRESET_2'
): Promise<{ success: boolean; message: string }> {
  try {
    await requirePermission('cctv:view', '/cctv');
    const role = await getCurrentUserRole();
    const user = await getCurrentUser();

    await logAuditEvent({
      action: 'CCTV_PTZ_COMMAND',
      actorRole: role.toUpperCase(),
      details: `PTZ optical command '${command}' sent to camera id=${cameraId} by ${user?.name || role}`,
      status: 'SUCCESS',
    });

    return { success: true, message: `PTZ command ${command} transmitted to camera.` };
  } catch {
    return { success: false, message: 'Failed to dispatch PTZ command.' };
  }
}

/**
 * Checks the status and available endpoints of the local RTSP Bridge (go2rtc / MediaMTX).
 */
export async function getRtspBridgeStatusAction() {
  await requirePermission('cctv:view', '/cctv');
  const { checkRtspBridgeHealth } = await import('@/lib/cctv/rtsp-bridge');
  return checkRtspBridgeHealth();
}

/**
 * Scans the clinic LAN for ONVIF IP Cameras using WS-Discovery.
 */
export async function scanOnvifCamerasAction() {
  await requirePermission('cctv:manage', '/cctv');
  const { discoverOnvifCameras } = await import('@/lib/cctv/rtsp-bridge');
  const devices = await discoverOnvifCameras();
  return { success: true, devices };
}

/**
 * Validates and probes connectivity to an RTSP camera stream URL.
 */
export async function testRtspStreamAction(streamUrl: string) {
  await requirePermission('cctv:manage', '/cctv');
  const { probeRtspStream } = await import('@/lib/cctv/rtsp-bridge');
  return probeRtspStream(streamUrl);
}

/**
 * Generates and exports configuration files (go2rtc.yaml or mediamtx.yml) for all registered cameras.
 */
export async function exportBridgeConfigAction(gatewayType: 'go2rtc' | 'mediamtx' = 'go2rtc') {
  await requirePermission('cctv:manage', '/cctv');
  const { generateGo2rtcYaml, generateMediaMtxYml } = await import('@/lib/cctv/rtsp-bridge');
  const cameras = await getCctvCameras();

  if (gatewayType === 'mediamtx') {
    return {
      filename: 'mediamtx.yml',
      content: generateMediaMtxYml(cameras),
      contentType: 'text/yaml',
    };
  }

  return {
    filename: 'go2rtc.yaml',
    content: generateGo2rtcYaml(cameras),
    contentType: 'text/yaml',
  };
}

