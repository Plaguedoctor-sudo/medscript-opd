'use server';

import { db, sqlite } from '@/db';
import {
  medicalDevices,
  deviceTelemetryRecords,
  deviceAlerts,
  ipdAdmissions,
  patients,
  ipdRounds,
} from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requirePermission, getCurrentUserRole, getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import {
  calculateNews2Score,
  evaluateClinicalAlerts,
  generateRealisticTelemetryTick,
  DeviceThresholds,
  DEFAULT_THRESHOLDS,
} from '@/lib/device-telemetry-engine';

export interface DeviceWithPatientInfo {
  id: number;
  deviceId: string;
  name: string;
  deviceType: string;
  model: string | null;
  serialNumber: string | null;
  locationWard: string;
  assignedBed: string | null;
  currentAdmissionId: number | null;
  status: string;
  ipAddress: string | null;
  macAddress: string | null;
  protocol: string | null;
  batteryPercent: number | null;
  lastTelemetryAt: Date | null;
  config: string | null;
  createdAt: Date | null;
  patient?: {
    id: number;
    name: string;
    regNo: string | null;
    gender: string;
    age: number;
    admissionNo: string;
    ward: string;
    bedNo: string;
  } | null;
  latestTelemetry?: any | null;
  activeAlertCount?: number;
}

/**
 * Returns all medical devices with attached patient information and latest telemetry snapshot.
 */
export async function getHospitalDevicesAction(): Promise<DeviceWithPatientInfo[]> {
  await requirePermission('device:view');

  // Seed demo devices if none exist
  await seedDemoIcuDevicesAction();

  const devices = await db.select().from(medicalDevices).orderBy(medicalDevices.locationWard, medicalDevices.assignedBed);

  const results: DeviceWithPatientInfo[] = [];

  for (const dev of devices) {
    let patientInfo = null;

    if (dev.currentAdmissionId) {
      const admissionRow = sqlite
        .prepare(`
          SELECT a.id as admissionId, a.admission_no, a.ward, a.bed_no,
                 p.id as patientId, p.name, p.reg_no, p.gender, p.age
          FROM ipd_admissions a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.id = ?
        `)
        .get(dev.currentAdmissionId) as any;

      if (admissionRow) {
        patientInfo = {
          id: admissionRow.patientId,
          name: admissionRow.name,
          regNo: admissionRow.reg_no,
          gender: admissionRow.gender,
          age: admissionRow.age,
          admissionNo: admissionRow.admission_no,
          ward: admissionRow.ward,
          bedNo: admissionRow.bed_no,
        };
      }
    }

    // Get latest telemetry record
    const latestTele = sqlite
      .prepare(`
        SELECT * FROM device_telemetry_records
        WHERE device_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
      `)
      .get(dev.deviceId) as any;

    // Get unacknowledged alerts count
    const alertCountRow = sqlite
      .prepare(`
        SELECT COUNT(*) as count FROM device_alerts
        WHERE device_id = ? AND is_acknowledged = 0
      `)
      .get(dev.deviceId) as { count: number };

    results.push({
      ...dev,
      patient: patientInfo,
      latestTelemetry: latestTele || null,
      activeAlertCount: alertCountRow?.count ?? 0,
    });
  }

  return results;
}

/**
 * Attaches a medical device to an active patient admission bed.
 */
export async function attachDeviceToPatientAction(
  deviceId: string,
  admissionId: number,
  assignedBed?: string
) {
  await requirePermission('device:manage');
  const user = await getCurrentUser();

  const admission = await db.query.ipdAdmissions.findFirst({
    where: eq(ipdAdmissions.id, admissionId),
  });

  if (!admission) {
    throw new Error('Patient admission record not found.');
  }

  const bed = assignedBed || admission.bedNo;

  await db
    .update(medicalDevices)
    .set({
      currentAdmissionId: admissionId,
      assignedBed: bed,
      locationWard: admission.ward,
      status: 'STREAMING',
    })
    .where(eq(medicalDevices.deviceId, deviceId));

  await logAuditEvent({
    action: 'DEVICE_ATTACHED',
    actorRole: user?.role || 'STAFF',
    details: `Medical device ${deviceId} attached to Admission #${admission.admissionNo} (Bed: ${bed}) by ${user?.name || 'Staff'}`,
    status: 'SUCCESS',
  });

  revalidatePath('/ipd');
  revalidatePath(`/ipd/${admissionId}`);
  revalidatePath('/ipd/monitoring');
  return { success: true };
}

/**
 * Detaches a device from a patient (e.g. on patient transfer or discharge).
 */
export async function detachDeviceFromPatientAction(deviceId: string) {
  await requirePermission('device:manage');
  const user = await getCurrentUser();

  const dev = await db.query.medicalDevices.findFirst({
    where: eq(medicalDevices.deviceId, deviceId),
  });

  if (!dev) {
    throw new Error('Device not found.');
  }

  await db
    .update(medicalDevices)
    .set({
      currentAdmissionId: null,
      status: 'STANDBY',
    })
    .where(eq(medicalDevices.deviceId, deviceId));

  await logAuditEvent({
    action: 'DEVICE_DETACHED',
    actorRole: user?.role || 'STAFF',
    details: `Device ${deviceId} detached from admission #${dev.currentAdmissionId || 'None'} by ${user?.name || 'Staff'}`,
    status: 'SUCCESS',
  });

  revalidatePath('/ipd');
  revalidatePath('/ipd/monitoring');
  return { success: true };
}

/**
 * Registers a new medical device in the hospital inventory.
 */
export async function registerDeviceAction(data: {
  deviceId: string;
  name: string;
  deviceType: string;
  model?: string;
  serialNumber?: string;
  locationWard: string;
  assignedBed?: string;
  ipAddress?: string;
  macAddress?: string;
  protocol?: string;
}) {
  await requirePermission('device:manage');
  const user = await getCurrentUser();

  const existing = await db.query.medicalDevices.findFirst({
    where: eq(medicalDevices.deviceId, data.deviceId),
  });

  if (existing) {
    throw new Error(`Device ID ${data.deviceId} already registered.`);
  }

  await db.insert(medicalDevices).values({
    deviceId: data.deviceId,
    name: data.name,
    deviceType: data.deviceType,
    model: data.model || null,
    serialNumber: data.serialNumber || null,
    locationWard: data.locationWard,
    assignedBed: data.assignedBed || null,
    ipAddress: data.ipAddress || null,
    macAddress: data.macAddress || null,
    protocol: data.protocol || 'HL7_V2_ORU',
    status: 'STANDBY',
    config: JSON.stringify(DEFAULT_THRESHOLDS),
  });

  await logAuditEvent({
    action: 'DEVICE_REGISTERED',
    actorRole: user?.role || 'STAFF',
    details: `New medical device ${data.name} (${data.deviceId}) added to ${data.locationWard}`,
    status: 'SUCCESS',
  });

  revalidatePath('/ipd/monitoring');
  return { success: true };
}

/**
 * Updates alarm limits and thresholds for a specific medical device.
 */
export async function updateDeviceThresholdsAction(deviceId: string, thresholds: DeviceThresholds) {
  await requirePermission('device:manage');
  const user = await getCurrentUser();

  await db
    .update(medicalDevices)
    .set({
      config: JSON.stringify(thresholds),
    })
    .where(eq(medicalDevices.deviceId, deviceId));

  await logAuditEvent({
    action: 'DEVICE_THRESHOLDS_UPDATED',
    actorRole: user?.role || 'STAFF',
    details: `Clinical alarm limits modified for device ${deviceId} by ${user?.name || 'Staff'}`,
    status: 'SUCCESS',
  });

  revalidatePath('/ipd/monitoring');
  return { success: true };
}

/**
 * Ingests a telemetry payload, calculates NEWS2, evaluates clinical alarms,
 * records telemetry into time-series, and generates alerts if thresholds breached.
 */
export async function ingestDeviceTelemetryAction(payload: {
  deviceId: string;
  heartRate?: number;
  pulseRate?: number;
  spo2?: number;
  systolicBp?: number;
  diastolicBp?: number;
  meanArterialPressure?: number;
  respiratoryRate?: number;
  bodyTemperature?: number;
  etco2?: number;
  ventilatorMode?: string;
  fio2?: number;
  peep?: number;
  tidalVolume?: number;
  peakInspiratoryPressure?: number;
  minuteVentilation?: number;
  infusionDrug?: string;
  infusionRate?: number;
  infusionDose?: string;
  totalVolumeInfused?: number;
  infusionStatus?: string;
  rawPayload?: string;
}) {
  const dev = await db.query.medicalDevices.findFirst({
    where: eq(medicalDevices.deviceId, payload.deviceId),
  });

  if (!dev) {
    throw new Error(`Device ${payload.deviceId} is not registered in the system.`);
  }

  // Parse thresholds
  let thresholds = DEFAULT_THRESHOLDS;
  if (dev.config) {
    try {
      thresholds = { ...DEFAULT_THRESHOLDS, ...JSON.parse(dev.config) };
    } catch {
      // Use defaults
    }
  }

  // Compute NEWS2 Score
  const news2 = calculateNews2Score({
    heartRate: payload.heartRate,
    respiratoryRate: payload.respiratoryRate,
    spo2: payload.spo2,
    systolicBp: payload.systolicBp,
    bodyTemperature: payload.bodyTemperature,
  });

  // Evaluate clinical alarms
  const alarms = evaluateClinicalAlerts(payload, thresholds);

  let alertLevel = 'NORMAL';
  if (alarms.some((a) => a.severity === 'LIFE_THREATENING')) {
    alertLevel = 'CRITICAL';
  } else if (alarms.some((a) => a.severity === 'CRITICAL')) {
    alertLevel = 'HIGH';
  } else if (alarms.length > 0 || news2.score >= 5) {
    alertLevel = 'MEDIUM';
  } else if (news2.score > 0) {
    alertLevel = 'LOW';
  }

  // Insert Telemetry Record
  const now = new Date();
  await db.insert(deviceTelemetryRecords).values({
    deviceId: payload.deviceId,
    admissionId: dev.currentAdmissionId,
    heartRate: payload.heartRate,
    pulseRate: payload.pulseRate || payload.heartRate,
    spo2: payload.spo2,
    systolicBp: payload.systolicBp,
    diastolicBp: payload.diastolicBp,
    meanArterialPressure:
      payload.meanArterialPressure ||
      (payload.systolicBp && payload.diastolicBp
        ? Math.round((payload.systolicBp + 2 * payload.diastolicBp) / 3)
        : null),
    respiratoryRate: payload.respiratoryRate,
    bodyTemperature: payload.bodyTemperature,
    etco2: payload.etco2,
    ventilatorMode: payload.ventilatorMode,
    fio2: payload.fio2,
    peep: payload.peep,
    tidalVolume: payload.tidalVolume,
    peakInspiratoryPressure: payload.peakInspiratoryPressure,
    minuteVentilation: payload.minuteVentilation,
    infusionDrug: payload.infusionDrug,
    infusionRate: payload.infusionRate,
    infusionDose: payload.infusionDose,
    totalVolumeInfused: payload.totalVolumeInfused,
    infusionStatus: payload.infusionStatus,
    news2Score: news2.score,
    alertLevel,
    activeAlerts: JSON.stringify(alarms.map((a) => `${a.title}: ${a.description}`)),
    rawPayload: payload.rawPayload || null,
    recordedAt: now,
  });

  // Update device status and ping
  await db
    .update(medicalDevices)
    .set({
      lastTelemetryAt: now,
      status: alarms.length > 0 ? 'ALARM' : 'STREAMING',
    })
    .where(eq(medicalDevices.deviceId, payload.deviceId));

  // Record alarms into device_alerts table
  for (const alarm of alarms) {
    await db.insert(deviceAlerts).values({
      deviceId: payload.deviceId,
      admissionId: dev.currentAdmissionId,
      severity: alarm.severity,
      category: alarm.category,
      title: alarm.title,
      description: alarm.description,
      isAcknowledged: false,
      createdAt: now,
    });
  }

  return { success: true, news2, alerts: alarms, alertLevel };
}

/**
 * 1-Click Sync to Official Nursing Vitals Chart:
 * Takes the live telemetry parameters and records an official clinical IPD Round entry.
 */
export async function syncTelemetryToNursingVitalsAction(
  admissionId: number,
  telemetrySnapshot: {
    heartRate?: number;
    spo2?: number;
    systolicBp?: number;
    diastolicBp?: number;
    respiratoryRate?: number;
    bodyTemperature?: number;
    news2Score?: number;
  }
) {
  await requirePermission('ipd:nursing_notes');
  const user = await getCurrentUser();

  const admission = await db.query.ipdAdmissions.findFirst({
    where: eq(ipdAdmissions.id, admissionId),
  });

  if (!admission) {
    throw new Error('Patient admission not found.');
  }

  const bpString =
    telemetrySnapshot.systolicBp && telemetrySnapshot.diastolicBp
      ? `${telemetrySnapshot.systolicBp}/${telemetrySnapshot.diastolicBp}`
      : undefined;

  const vitalsObj = {
    bp: bpString,
    pulse: telemetrySnapshot.heartRate ? String(telemetrySnapshot.heartRate) : undefined,
    temp: telemetrySnapshot.bodyTemperature ? String(telemetrySnapshot.bodyTemperature) : undefined,
    spo2: telemetrySnapshot.spo2 ? String(telemetrySnapshot.spo2) : undefined,
    rr: telemetrySnapshot.respiratoryRate ? String(telemetrySnapshot.respiratoryRate) : undefined,
    news2: telemetrySnapshot.news2Score,
  };

  const notes = `[AUTOMATED TELEMETRY CAPTURE] Continuous bedside device stream captured. NEWS2 Score: ${
    telemetrySnapshot.news2Score ?? 'N/A'
  }. Vitals stable as per bedside monitor.`;

  await db.insert(ipdRounds).values({
    admissionId,
    roundDate: new Date(),
    doctorOrStaff: user?.name || 'Staff Nurse',
    role: user?.role === 'doctor' || user?.role === 'admin_doctor' ? 'DOCTOR' : 'NURSE',
    notes,
    vitals: JSON.stringify(vitalsObj),
  });

  await logAuditEvent({
    action: 'TELEMETRY_SYNCED_TO_CHART',
    actorRole: user?.role || 'STAFF',
    details: `Bedside telemetry snapshot synced to Admission #${admission.admissionNo} flow chart by ${user?.name}`,
    status: 'SUCCESS',
  });

  revalidatePath(`/ipd/${admissionId}`);
  revalidatePath('/ipd');
  return { success: true };
}

/**
 * Acknowledges / silences a clinical alarm.
 */
export async function acknowledgeDeviceAlertAction(alertId: number) {
  await requirePermission('device:manage');
  const user = await getCurrentUser();

  await db
    .update(deviceAlerts)
    .set({
      isAcknowledged: true,
      acknowledgedBy: user?.name || 'Staff',
      acknowledgedAt: new Date(),
    })
    .where(eq(deviceAlerts.id, alertId));

  revalidatePath('/ipd/monitoring');
  return { success: true };
}

/**
 * Returns historical telemetry trends for trend lines & analytics.
 */
export async function getDeviceTelemetryHistoryAction(deviceId: string, limit = 50) {
  await requirePermission('device:view');

  const records = await db
    .select()
    .from(deviceTelemetryRecords)
    .where(eq(deviceTelemetryRecords.deviceId, deviceId))
    .orderBy(desc(deviceTelemetryRecords.recordedAt))
    .limit(limit);

  return records.reverse();
}

/**
 * Returns live devices and telemetry attached to a specific admission.
 */
export async function getPatientLiveDeviceTelemetryAction(admissionId: number) {
  await requirePermission('device:view');

  const devices = await db
    .select()
    .from(medicalDevices)
    .where(eq(medicalDevices.currentAdmissionId, admissionId));

  const enriched = [];
  for (const d of devices) {
    const latest = sqlite
      .prepare(`
        SELECT * FROM device_telemetry_records
        WHERE device_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
      `)
      .get(d.deviceId);

    const alerts = sqlite
      .prepare(`
        SELECT * FROM device_alerts
        WHERE device_id = ? AND is_acknowledged = 0
        ORDER BY created_at DESC
        LIMIT 5
      `)
      .all(d.deviceId);

    enriched.push({
      ...d,
      latestTelemetry: latest || null,
      activeAlerts: alerts || [],
    });
  }

  return enriched;
}

/**
 * Ticks the simulation engine: generates a synchronized telemetry update
 * for all active devices according to the requested clinical scenario.
 */
export async function simulateTelemetryTickAction(
  scenario: 'STABLE' | 'SEPSIS' | 'ARDS' | 'ARRHYTHMIA' = 'STABLE'
) {
  await requirePermission('device:telemetry');

  const devices = await db.select().from(medicalDevices);

  for (const dev of devices) {
    if (dev.status === 'OFFLINE' || dev.status === 'MAINTENANCE') continue;

    const latest = sqlite
      .prepare(`
        SELECT * FROM device_telemetry_records
        WHERE device_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
      `)
      .get(dev.deviceId) as any;

    const tickData = generateRealisticTelemetryTick(dev.deviceType, latest || {}, scenario);

    await ingestDeviceTelemetryAction({
      deviceId: dev.deviceId,
      ...tickData,
    });
  }

  revalidatePath('/ipd/monitoring');
  return { success: true };
}

/**
 * Seeds pre-configured hospital ICU and IPD devices if none exist.
 */
export async function seedDemoIcuDevicesAction() {
  const existingCount = sqlite.prepare('SELECT COUNT(*) as count FROM medical_devices').get() as { count: number };
  if (existingCount && existingCount.count > 0) return;

  // Find active admissions to auto-attach if available
  const activeAdmissions = sqlite
    .prepare("SELECT id, bed_no, ward FROM ipd_admissions WHERE status = 'ADMITTED' LIMIT 5")
    .all() as any[];

  const getAdmissionForBed = (bed: string) => {
    return activeAdmissions.find((a) => a.bed_no.toLowerCase().includes(bed.toLowerCase()))?.id || null;
  };

  const defaultDevices = [
    {
      deviceId: 'DEV-ICU-MON-01',
      name: 'Mindray BeneVision N17 Patient Monitor',
      deviceType: 'patient_monitor',
      model: 'BeneVision N17',
      serialNumber: 'MR-BV17-9821',
      locationWard: 'ICU',
      assignedBed: 'ICU-01',
      currentAdmissionId: getAdmissionForBed('ICU-01') || activeAdmissions[0]?.id || null,
      status: 'STREAMING',
      ipAddress: '192.168.10.101',
      macAddress: '00:1A:2B:3C:4D:01',
      protocol: 'HL7_V2_ORU',
      batteryPercent: 100,
      config: JSON.stringify(DEFAULT_THRESHOLDS),
    },
    {
      deviceId: 'DEV-ICU-VENT-01',
      name: 'Hamilton-C6 Intensive Care Ventilator',
      deviceType: 'ventilator',
      model: 'Hamilton-C6',
      serialNumber: 'HM-C6-4412',
      locationWard: 'ICU',
      assignedBed: 'ICU-01',
      currentAdmissionId: getAdmissionForBed('ICU-01') || activeAdmissions[0]?.id || null,
      status: 'STREAMING',
      ipAddress: '192.168.10.102',
      macAddress: '00:1A:2B:3C:4D:02',
      protocol: 'IEEE_11073',
      batteryPercent: 98,
      config: JSON.stringify(DEFAULT_THRESHOLDS),
    },
    {
      deviceId: 'DEV-ICU-PUMP-01',
      name: 'B. Braun Space Syringe Infusion Pump',
      deviceType: 'infusion_pump',
      model: 'Perfusor Space',
      serialNumber: 'BB-SP-7711',
      locationWard: 'ICU',
      assignedBed: 'ICU-01',
      currentAdmissionId: getAdmissionForBed('ICU-01') || activeAdmissions[0]?.id || null,
      status: 'STREAMING',
      ipAddress: '192.168.10.103',
      macAddress: '00:1A:2B:3C:4D:03',
      protocol: 'REST_JSON',
      batteryPercent: 100,
      config: JSON.stringify(DEFAULT_THRESHOLDS),
    },
    {
      deviceId: 'DEV-ICU-MON-02',
      name: 'Philips IntelliVue MX750 Monitor',
      deviceType: 'patient_monitor',
      model: 'IntelliVue MX750',
      serialNumber: 'PH-MX75-1092',
      locationWard: 'ICU',
      assignedBed: 'ICU-02',
      currentAdmissionId: getAdmissionForBed('ICU-02') || activeAdmissions[1]?.id || null,
      status: 'STREAMING',
      ipAddress: '192.168.10.104',
      macAddress: '00:1A:2B:3C:4D:04',
      protocol: 'HL7_V2_ORU',
      batteryPercent: 95,
      config: JSON.stringify(DEFAULT_THRESHOLDS),
    },
    {
      deviceId: 'DEV-HDU-MON-01',
      name: 'GE Healthcare Carescape B650',
      deviceType: 'patient_monitor',
      model: 'Carescape B650',
      serialNumber: 'GE-CS65-5519',
      locationWard: 'HDU',
      assignedBed: 'HDU-01',
      currentAdmissionId: getAdmissionForBed('HDU-01') || activeAdmissions[2]?.id || null,
      status: 'STREAMING',
      ipAddress: '192.168.10.105',
      macAddress: '00:1A:2B:3C:4D:05',
      protocol: 'HL7_V2_ORU',
      batteryPercent: 100,
      config: JSON.stringify(DEFAULT_THRESHOLDS),
    },
    {
      deviceId: 'DEV-WARD-MON-01',
      name: 'Contec CMS8000 Multi-Parameter Monitor',
      deviceType: 'patient_monitor',
      model: 'CMS8000',
      serialNumber: 'CT-8000-3321',
      locationWard: 'General Ward',
      assignedBed: 'Bed-01',
      currentAdmissionId: getAdmissionForBed('Bed-01') || activeAdmissions[3]?.id || null,
      status: 'STREAMING',
      ipAddress: '192.168.10.106',
      macAddress: '00:1A:2B:3C:4D:06',
      protocol: 'REST_JSON',
      batteryPercent: 88,
      config: JSON.stringify(DEFAULT_THRESHOLDS),
    },
  ];

  for (const d of defaultDevices) {
    await db.insert(medicalDevices).values(d);
  }

  // Pre-seed an initial telemetry tick for each device
  for (const d of defaultDevices) {
    const tick = generateRealisticTelemetryTick(d.deviceType, {}, 'STABLE');
    const news2 = calculateNews2Score({
      heartRate: tick.heartRate,
      respiratoryRate: tick.respiratoryRate,
      spo2: tick.spo2,
      systolicBp: tick.systolicBp,
      bodyTemperature: tick.bodyTemperature,
    });

    await db.insert(deviceTelemetryRecords).values({
      deviceId: d.deviceId,
      admissionId: d.currentAdmissionId,
      ...tick,
      news2Score: news2.score,
      alertLevel: 'NORMAL',
      recordedAt: new Date(),
    });
  }
}
