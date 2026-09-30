import { describe, it, expect } from 'vitest';
import {
  calculateNews2Score,
  evaluateClinicalAlerts,
  parseHl7Pcd01Telemetry,
  generateRealisticTelemetryTick,
  DEFAULT_THRESHOLDS,
} from '../device-telemetry-engine';
import { canDo } from '../role-scope';

describe('ICU & IPD Medical Device Telemetry Engine', () => {
  describe('NEWS2 Clinical Deterioration Scoring', () => {
    it('returns score 0 and LOW risk for normal physiological vitals', () => {
      const result = calculateNews2Score({
        heartRate: 72,
        respiratoryRate: 16,
        spo2: 98,
        systolicBp: 120,
        bodyTemperature: 36.8,
      });

      expect(result.score).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.subscores.heartRate).toBe(0);
      expect(result.subscores.spo2).toBe(0);
      expect(result.subscores.systolicBp).toBe(0);
    });

    it('identifies MEDIUM risk with appropriate clinical escalation prompt', () => {
      const result = calculateNews2Score({
        heartRate: 105, // 1 pt (91-110)
        respiratoryRate: 22, // 2 pt (21-24)
        spo2: 93, // 2 pt (92-93)
        systolicBp: 115, // 0 pt
        bodyTemperature: 37.2, // 0 pt
      });

      expect(result.score).toBe(5);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.actionPrompt).toContain('URGENT');
    });

    it('triggers HIGH emergency ICU escalation score for multi-system collapse', () => {
      const result = calculateNews2Score({
        heartRate: 138, // 3 pt (>=131)
        respiratoryRate: 28, // 3 pt (>=25)
        spo2: 89, // 3 pt (<=91)
        systolicBp: 82, // 3 pt (<=90)
        bodyTemperature: 39.4, // 2 pt (>=39.1)
      });

      expect(result.score).toBe(14);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.actionPrompt).toContain('EMERGENCY');
    });
  });

  describe('Clinical Alarm Evaluation', () => {
    it('flags LIFE_THREATENING severe hypoxemia when SpO2 < 85%', () => {
      const alarms = evaluateClinicalAlerts({
        spo2: 82,
        heartRate: 80,
        systolicBp: 120,
      });

      const hypoxemia = alarms.find((a) => a.title.includes('Severe Hypoxemia'));
      expect(hypoxemia).toBeDefined();
      expect(hypoxemia?.severity).toBe('LIFE_THREATENING');
    });

    it('flags LIFE_THREATENING critical bradycardia when HR < 40 bpm', () => {
      const alarms = evaluateClinicalAlerts({
        heartRate: 36,
        spo2: 97,
        systolicBp: 110,
      });

      const brady = alarms.find((a) => a.title.includes('Critical Bradycardia'));
      expect(brady).toBeDefined();
      expect(brady?.severity).toBe('LIFE_THREATENING');
    });

    it('detects mechanical ventilator high peak inspiratory pressure (PIP > 34 cmH2O)', () => {
      const alarms = evaluateClinicalAlerts({
        peakInspiratoryPressure: 38.5,
        heartRate: 85,
        spo2: 95,
      });

      const pipAlarm = alarms.find((a) => a.title.includes('High Airway Pressure'));
      expect(pipAlarm).toBeDefined();
      expect(pipAlarm?.category).toBe('VENTILATOR');
      expect(pipAlarm?.severity).toBe('CRITICAL');
    });

    it('detects infusion syringe pump line occlusion', () => {
      const alarms = evaluateClinicalAlerts({
        infusionStatus: 'OCCLUSION',
        infusionDrug: 'Noradrenaline',
      });

      const pumpAlarm = alarms.find((a) => a.title.includes('Occluded'));
      expect(pumpAlarm).toBeDefined();
      expect(pumpAlarm?.category).toBe('INFUSION');
      expect(pumpAlarm?.severity).toBe('CRITICAL');
    });
  });

  describe('HL7 PCD-01 Telemetry Parser', () => {
    it('parses standard HL7 v2.x OBX segments into structured parameters', () => {
      const hl7Message = `MSH|^~\\&|MINDRAY_GATEWAY|ICU_01|MEDSCRIPT|CENTRAL|20261001050000||ORU^R01|MSG001|P|2.3
PID|||PAT001||DOE^JOHN||19800101|M
OBR|1|||PCD_TELEMETRY
OBX|1|NM|8867-4^HEART_RATE^LN||82|bpm||||F
OBX|2|NM|2708-6^SPO2^LN||98|%||||F
OBX|3|NM|8480-6^BP_SYS^LN||124|mmHg||||F
OBX|4|NM|8462-4^BP_DIA^LN||78|mmHg||||F
OBX|5|NM|9279-1^RESP_RATE^LN||16|/min||||F
OBX|6|NM|8310-5^TEMP^LN||37.1|C||||F`;

      const parsed = parseHl7Pcd01Telemetry(hl7Message);

      expect(parsed.heartRate).toBe(82);
      expect(parsed.spo2).toBe(98);
      expect(parsed.systolicBp).toBe(124);
      expect(parsed.diastolicBp).toBe(78);
      expect(parsed.respiratoryRate).toBe(16);
      expect(parsed.bodyTemperature).toBe(37.1);
    });
  });

  describe('Simulation Generator', () => {
    it('generates hemodynamically unstable vitals in SEPSIS scenario', () => {
      const tick = generateRealisticTelemetryTick('patient_monitor', {}, 'SEPSIS');
      expect(tick.heartRate).toBeGreaterThanOrEqual(115); // Tachycardia
      expect(tick.systolicBp).toBeLessThanOrEqual(95); // Hypotension
      expect(tick.bodyTemperature).toBeGreaterThan(38.0); // Febrile
    });

    it('generates high PIP and low SpO2 in ARDS ventilator scenario', () => {
      const ventTick = generateRealisticTelemetryTick('ventilator', {}, 'ARDS');
      expect(ventTick.peakInspiratoryPressure).toBeGreaterThanOrEqual(34.0);
      expect(ventTick.fio2).toBe(70);

      const monTick = generateRealisticTelemetryTick('patient_monitor', {}, 'ARDS');
      expect(monTick.spo2).toBeLessThanOrEqual(91); // Desaturation
    });
  });

  describe('RBAC Role Scopes for Medical Devices', () => {
    it('grants doctors and nurses device monitoring and management permissions', () => {
      expect(canDo('doctor', 'device:view')).toBe(true);
      expect(canDo('doctor', 'device:manage')).toBe(true);
      expect(canDo('doctor', 'device:telemetry')).toBe(true);

      expect(canDo('nurse', 'device:view')).toBe(true);
      expect(canDo('nurse', 'device:manage')).toBe(true);
      expect(canDo('nurse', 'device:telemetry')).toBe(true);

      expect(canDo('admin_doctor', 'device:view')).toBe(true);
      expect(canDo('admin_doctor', 'device:manage')).toBe(true);
      expect(canDo('admin_doctor', 'device:telemetry')).toBe(true);
    });

    it('restricts device management from receptionists and lab techs', () => {
      expect(canDo('receptionist', 'device:manage')).toBe(false);
      expect(canDo('lab_technician', 'device:manage')).toBe(false);
    });
  });
});
