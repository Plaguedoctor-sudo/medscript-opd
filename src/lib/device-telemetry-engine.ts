/**
 * MedScript OPD / IPD - Clinical Medical Device Telemetry & Scoring Engine
 * Standards-compliant: NEWS2 (National Early Warning Score 2), HL7 PCD-01, IEEE 11073 Point-of-Care
 */

export interface VitalsInput {
  heartRate?: number | null;
  respiratoryRate?: number | null;
  spo2?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  bodyTemperature?: number | null;
  isSupplementalOxygen?: boolean;
}

export interface News2Result {
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  actionPrompt: string;
  subscores: {
    respiratoryRate: number;
    spo2: number;
    systolicBp: number;
    heartRate: number;
    temperature: number;
  };
}

/**
 * Calculates official NHS National Early Warning Score 2 (NEWS2).
 * Validated clinical protocol for inpatient deterioration surveillance.
 */
export function calculateNews2Score(vitals: VitalsInput): News2Result {
  let score = 0;
  const subscores = {
    respiratoryRate: 0,
    spo2: 0,
    systolicBp: 0,
    heartRate: 0,
    temperature: 0,
  };

  // 1. Respiratory Rate
  if (vitals.respiratoryRate != null) {
    const rr = vitals.respiratoryRate;
    if (rr <= 8) subscores.respiratoryRate = 3;
    else if (rr >= 9 && rr <= 11) subscores.respiratoryRate = 1;
    else if (rr >= 12 && rr <= 20) subscores.respiratoryRate = 0;
    else if (rr >= 21 && rr <= 24) subscores.respiratoryRate = 2;
    else if (rr >= 25) subscores.respiratoryRate = 3;
  }

  // 2. Oxygen Saturation (SpO2 Scale 1)
  if (vitals.spo2 != null) {
    const s = vitals.spo2;
    if (s <= 91) subscores.spo2 = 3;
    else if (s >= 92 && s <= 93) subscores.spo2 = 2;
    else if (s >= 94 && s <= 95) subscores.spo2 = 1;
    else if (s >= 96) subscores.spo2 = 0;
  }

  // 3. Systolic Blood Pressure
  if (vitals.systolicBp != null) {
    const sbp = vitals.systolicBp;
    if (sbp <= 90) subscores.systolicBp = 3;
    else if (sbp >= 91 && sbp <= 100) subscores.systolicBp = 2;
    else if (sbp >= 101 && sbp <= 110) subscores.systolicBp = 1;
    else if (sbp >= 111 && sbp <= 219) subscores.systolicBp = 0;
    else if (sbp >= 220) subscores.systolicBp = 3;
  }

  // 4. Heart Rate / Pulse
  if (vitals.heartRate != null) {
    const hr = vitals.heartRate;
    if (hr <= 40) subscores.heartRate = 3;
    else if (hr >= 41 && hr <= 50) subscores.heartRate = 1;
    else if (hr >= 51 && hr <= 90) subscores.heartRate = 0;
    else if (hr >= 91 && hr <= 110) subscores.heartRate = 1;
    else if (hr >= 111 && hr <= 130) subscores.heartRate = 2;
    else if (hr >= 131) subscores.heartRate = 3;
  }

  // 5. Body Temperature (°C)
  if (vitals.bodyTemperature != null) {
    const t = vitals.bodyTemperature;
    if (t <= 35.0) subscores.temperature = 3;
    else if (t >= 35.1 && t <= 36.0) subscores.temperature = 1;
    else if (t >= 36.1 && t <= 38.0) subscores.temperature = 0;
    else if (t >= 38.1 && t <= 39.0) subscores.temperature = 1;
    else if (t >= 39.1) subscores.temperature = 2;
  }

  score =
    subscores.respiratoryRate +
    subscores.spo2 +
    subscores.systolicBp +
    subscores.heartRate +
    subscores.temperature;

  const hasExtremeSingleScore = Object.values(subscores).some((val) => val === 3);

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let actionPrompt = 'Ward-based monitoring every 4-6 hours.';

  if (score >= 7) {
    riskLevel = 'HIGH';
    actionPrompt = 'EMERGENCY: Immediate clinical review by ICU team / Medical Registrar.';
  } else if (score >= 5 || hasExtremeSingleScore) {
    riskLevel = 'MEDIUM';
    actionPrompt = 'URGENT: Urgent bedside assessment by attending doctor / HDU transfer evaluation.';
  } else if (score >= 1) {
    riskLevel = 'LOW';
    actionPrompt = 'Targeted nursing observation: monitor vitals every 2-4 hours.';
  }

  return {
    score,
    riskLevel,
    actionPrompt,
    subscores,
  };
}

export interface DeviceThresholds {
  hrLow?: number;
  hrHigh?: number;
  spo2Low?: number;
  sysLow?: number;
  sysHigh?: number;
  rrLow?: number;
  rrHigh?: number;
  pipHigh?: number;
  tempHigh?: number;
}

export const DEFAULT_THRESHOLDS: DeviceThresholds = {
  hrLow: 48,
  hrHigh: 125,
  spo2Low: 91,
  sysLow: 90,
  sysHigh: 165,
  rrLow: 9,
  rrHigh: 28,
  pipHigh: 34,
  tempHigh: 38.8,
};

export interface ClinicalAlarm {
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'LIFE_THREATENING';
  category: 'VITALS' | 'VENTILATOR' | 'INFUSION' | 'TECHNICAL' | 'LEADS_OFF';
  title: string;
  description: string;
}

/**
 * Checks incoming telemetry against configured physiological alarm limits.
 */
export function evaluateClinicalAlerts(
  telemetry: {
    heartRate?: number | null;
    spo2?: number | null;
    systolicBp?: number | null;
    diastolicBp?: number | null;
    respiratoryRate?: number | null;
    bodyTemperature?: number | null;
    peakInspiratoryPressure?: number | null;
    infusionStatus?: string | null;
    infusionDrug?: string | null;
  },
  thresholds: DeviceThresholds = DEFAULT_THRESHOLDS
): ClinicalAlarm[] {
  const alerts: ClinicalAlarm[] = [];

  // SpO2
  if (telemetry.spo2 != null && telemetry.spo2 > 0) {
    if (telemetry.spo2 < 85) {
      alerts.push({
        severity: 'LIFE_THREATENING',
        category: 'VITALS',
        title: 'Severe Hypoxemia',
        description: `SpO2 critically low at ${telemetry.spo2}%. Immediate airway & oxygen review required!`,
      });
    } else if (telemetry.spo2 < (thresholds.spo2Low ?? 91)) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'VITALS',
        title: 'Desaturation Alert',
        description: `SpO2 ${telemetry.spo2}% dropped below threshold (${thresholds.spo2Low ?? 91}%).`,
      });
    }
  }

  // Heart Rate
  if (telemetry.heartRate != null && telemetry.heartRate > 0) {
    if (telemetry.heartRate < 40) {
      alerts.push({
        severity: 'LIFE_THREATENING',
        category: 'VITALS',
        title: 'Critical Bradycardia',
        description: `Heart rate severely low at ${telemetry.heartRate} bpm. Prepare Atropine/Pacing.`,
      });
    } else if (telemetry.heartRate < (thresholds.hrLow ?? 48)) {
      alerts.push({
        severity: 'WARNING',
        category: 'VITALS',
        title: 'Bradycardia',
        description: `Heart rate ${telemetry.heartRate} bpm below low limit (${thresholds.hrLow ?? 48} bpm).`,
      });
    } else if (telemetry.heartRate > 150) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'VITALS',
        title: 'Severe Tachycardia',
        description: `Heart rate ${telemetry.heartRate} bpm. Evaluate for SVT/VT/Sepsis.`,
      });
    } else if (telemetry.heartRate > (thresholds.hrHigh ?? 125)) {
      alerts.push({
        severity: 'WARNING',
        category: 'VITALS',
        title: 'Tachycardia',
        description: `Heart rate ${telemetry.heartRate} bpm exceeds threshold (${thresholds.hrHigh ?? 125} bpm).`,
      });
    }
  }

  // Blood Pressure
  if (telemetry.systolicBp != null && telemetry.systolicBp > 0) {
    if (telemetry.systolicBp < 80) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'VITALS',
        title: 'Hypotensive Shock',
        description: `Systolic BP ${telemetry.systolicBp} mmHg severely depressed. Check fluid response/pressors.`,
      });
    } else if (telemetry.systolicBp < (thresholds.sysLow ?? 90)) {
      alerts.push({
        severity: 'WARNING',
        category: 'VITALS',
        title: 'Hypotension',
        description: `Systolic BP ${telemetry.systolicBp} mmHg below ${thresholds.sysLow ?? 90} mmHg.`,
      });
    } else if (telemetry.systolicBp > (thresholds.sysHigh ?? 165)) {
      alerts.push({
        severity: 'WARNING',
        category: 'VITALS',
        title: 'Hypertensive Peak',
        description: `Systolic BP ${telemetry.systolicBp} mmHg exceeds ${thresholds.sysHigh ?? 165} mmHg.`,
      });
    }
  }

  // Ventilator Peak Inspiratory Pressure
  if (telemetry.peakInspiratoryPressure != null && telemetry.peakInspiratoryPressure > (thresholds.pipHigh ?? 34)) {
    alerts.push({
      severity: 'CRITICAL',
      category: 'VENTILATOR',
      title: 'High Airway Pressure (PIP)',
      description: `Peak inspiratory pressure ${telemetry.peakInspiratoryPressure} cmH2O exceeds ${thresholds.pipHigh ?? 34} cmH2O. Check for bronchospasm, secretions, or pneumothorax!`,
    });
  }

  // Infusion Pump Occlusion
  if (telemetry.infusionStatus === 'OCCLUSION') {
    alerts.push({
      severity: 'CRITICAL',
      category: 'INFUSION',
      title: 'Infusion Line Occluded',
      description: `Line occlusion detected for ${telemetry.infusionDrug || 'infusion line'}. Drug delivery halted.`,
    });
  }

  return alerts;
}

/**
 * Parses standard HL7 v2.x ORU^R01 / PCD-01 message (IHE Patient Care Device profile)
 */
export function parseHl7Pcd01Telemetry(hl7Text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = hl7Text.trim().split(/\r?\n/);

  for (const line of lines) {
    const fields = line.split('|');
    const segment = fields[0];

    if (segment === 'OBX') {
      // OBX|idx|NM|Code^Desc|...|Value|Units|...
      const identifier = fields[3] || '';
      const value = fields[5];
      const numVal = parseFloat(value);

      if (identifier.includes('HR') || identifier.includes('PULSE') || identifier.includes('8867-4')) {
        result.heartRate = Math.round(numVal);
        result.pulseRate = Math.round(numVal);
      } else if (identifier.includes('SPO2') || identifier.includes('2708-6')) {
        result.spo2 = Math.round(numVal);
      } else if (identifier.includes('SYS') || identifier.includes('8480-6')) {
        result.systolicBp = Math.round(numVal);
      } else if (identifier.includes('DIA') || identifier.includes('8462-4')) {
        result.diastolicBp = Math.round(numVal);
      } else if (identifier.includes('MAP') || identifier.includes('8478-0')) {
        result.meanArterialPressure = Math.round(numVal);
      } else if (identifier.includes('RESP') || identifier.includes('9279-1')) {
        result.respiratoryRate = Math.round(numVal);
      } else if (identifier.includes('TEMP') || identifier.includes('8310-5')) {
        result.bodyTemperature = Number(numVal.toFixed(1));
      } else if (identifier.includes('PIP') || identifier.includes('AIRWAY_PRESS')) {
        result.peakInspiratoryPressure = Number(numVal.toFixed(1));
      }
    }
  }

  return result;
}

/**
 * Realistic Physiological Telemetry Generator for clinical simulation & testing
 */
export function generateRealisticTelemetryTick(
  deviceType: string,
  current: any = {},
  scenario: 'STABLE' | 'SEPSIS' | 'ARDS' | 'ARRHYTHMIA' = 'STABLE'
) {
  const jitter = (range: number) => (Math.random() - 0.5) * range;

  if (deviceType === 'ventilator') {
    if (scenario === 'ARDS') {
      return {
        ventilatorMode: 'PCV',
        fio2: 70,
        peep: 14.0,
        tidalVolume: Math.round(380 + jitter(20)),
        peakInspiratoryPressure: Number((36.5 + jitter(2.0)).toFixed(1)), // Triggers High PIP alert
        minuteVentilation: Number((8.8 + jitter(0.4)).toFixed(1)),
        respiratoryRate: 24,
      };
    }
    return {
      ventilatorMode: 'SIMV+PS',
      fio2: 40,
      peep: 5.0,
      tidalVolume: Math.round(460 + jitter(25)),
      peakInspiratoryPressure: Number((19.5 + jitter(1.5)).toFixed(1)),
      minuteVentilation: Number((7.2 + jitter(0.3)).toFixed(1)),
      respiratoryRate: 14,
    };
  }

  if (deviceType === 'infusion_pump') {
    if (scenario === 'SEPSIS') {
      const baseInfused = (current.totalVolumeInfused ?? 45.0) + 0.15;
      return {
        infusionDrug: 'Noradrenaline (4mg / 50mL)',
        infusionRate: 12.0,
        infusionDose: '0.16 mcg/kg/min',
        totalVolumeInfused: Number(baseInfused.toFixed(1)),
        infusionStatus: 'INFUSING',
      };
    }
    const baseInfused = (current.totalVolumeInfused ?? 120.0) + 0.05;
    return {
      infusionDrug: 'Pantoprazole 40mg Infusion',
      infusionRate: 4.0,
      infusionDose: '4 mL/h',
      totalVolumeInfused: Number(baseInfused.toFixed(1)),
      infusionStatus: 'INFUSING',
    };
  }

  // Standard Multi-parameter Bedside Patient Monitor
  switch (scenario) {
    case 'SEPSIS': {
      const hr = Math.round(Math.min(145, Math.max(115, (current.heartRate || 124) + jitter(4))));
      const sys = Math.round(Math.min(95, Math.max(76, (current.systolicBp || 84) + jitter(3))));
      const dia = Math.round(Math.min(58, Math.max(42, (current.diastolicBp || 48) + jitter(2))));
      const map = Math.round((sys + 2 * dia) / 3);
      const spo2 = Math.round(Math.min(96, Math.max(92, (current.spo2 || 94) + jitter(1.5))));
      const rr = Math.round(Math.min(32, Math.max(24, (current.respiratoryRate || 26) + jitter(2))));
      const temp = Number((38.9 + jitter(0.4)).toFixed(1));
      return {
        heartRate: hr,
        pulseRate: hr,
        spo2,
        systolicBp: sys,
        diastolicBp: dia,
        meanArterialPressure: map,
        respiratoryRate: rr,
        bodyTemperature: temp,
        etco2: 32,
      };
    }

    case 'ARDS': {
      const hr = Math.round(Math.min(120, Math.max(95, (current.heartRate || 108) + jitter(3))));
      const sys = Math.round(Math.min(135, Math.max(105, (current.systolicBp || 118) + jitter(4))));
      const dia = Math.round(Math.min(85, Math.max(65, (current.diastolicBp || 74) + jitter(3))));
      const map = Math.round((sys + 2 * dia) / 3);
      const spo2 = Math.round(Math.min(91, Math.max(86, (current.spo2 || 88) + jitter(2)))); // Desaturation
      const rr = Math.round(Math.min(28, Math.max(20, (current.respiratoryRate || 24) + jitter(1))));
      const temp = Number((37.6 + jitter(0.2)).toFixed(1));
      return {
        heartRate: hr,
        pulseRate: hr,
        spo2,
        systolicBp: sys,
        diastolicBp: dia,
        meanArterialPressure: map,
        respiratoryRate: rr,
        bodyTemperature: temp,
        etco2: 44,
      };
    }

    case 'ARRHYTHMIA': {
      // Sudden tachycardia / ectopic spikes
      const hr = Math.round(Math.min(160, Math.max(130, (current.heartRate || 142) + jitter(6))));
      const sys = Math.round(Math.min(125, Math.max(90, (current.systolicBp || 105) + jitter(5))));
      const dia = Math.round(Math.min(80, Math.max(55, (current.diastolicBp || 66) + jitter(3))));
      const map = Math.round((sys + 2 * dia) / 3);
      const spo2 = Math.round(Math.min(97, Math.max(93, (current.spo2 || 95) + jitter(1))));
      const rr = Math.round(Math.min(22, Math.max(16, (current.respiratoryRate || 18) + jitter(1))));
      const temp = Number((37.0 + jitter(0.2)).toFixed(1));
      return {
        heartRate: hr,
        pulseRate: hr,
        spo2,
        systolicBp: sys,
        diastolicBp: dia,
        meanArterialPressure: map,
        respiratoryRate: rr,
        bodyTemperature: temp,
        etco2: 36,
      };
    }

    case 'STABLE':
    default: {
      const hr = Math.round(Math.min(84, Math.max(68, (current.heartRate || 74) + jitter(2))));
      const sys = Math.round(Math.min(128, Math.max(114, (current.systolicBp || 120) + jitter(3))));
      const dia = Math.round(Math.min(82, Math.max(72, (current.diastolicBp || 78) + jitter(2))));
      const map = Math.round((sys + 2 * dia) / 3);
      const spo2 = Math.round(Math.min(100, Math.max(97, (current.spo2 || 98) + jitter(1))));
      const rr = Math.round(Math.min(18, Math.max(14, (current.respiratoryRate || 16) + jitter(1))));
      const temp = Number((36.8 + jitter(0.2)).toFixed(1));
      return {
        heartRate: hr,
        pulseRate: hr,
        spo2,
        systolicBp: sys,
        diastolicBp: dia,
        meanArterialPressure: map,
        respiratoryRate: rr,
        bodyTemperature: temp,
        etco2: 38,
      };
    }
  }
}
