import { db } from '@/db';
import { auditLogs, securityAlerts } from '@/db/schema';
import { desc, isNull, and, gte, eq } from 'drizzle-orm';
import type { AuditAction, ActorRole, AuditStatus } from './audit';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertCategory =
  | 'BRUTE_FORCE'
  | 'BREAK_GLASS'
  | 'UNUSUAL_TRANSFER'
  | 'ACCESS_VIOLATION'
  | 'INTEGRITY_TAMPER';

export interface SecurityAlertItem {
  id: number;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  ipAddress: string | null;
  metadata?: string | null;
  createdAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
}

export interface SecurityAlertStats {
  totalActive: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  alerts: SecurityAlertItem[];
}

/**
 * Creates a security alert in the database, with automatic 5-minute deduplication
 * to prevent alert storms from repeated events.
 */
export async function createSecurityAlert({
  severity,
  category,
  title,
  description,
  ipAddress,
  metadata,
}: {
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Check for recent unacknowledged duplicate alert with same category and title
    const existing = await db
      .select({ id: securityAlerts.id })
      .from(securityAlerts)
      .where(
        and(
          eq(securityAlerts.category, category),
          eq(securityAlerts.title, title),
          isNull(securityAlerts.acknowledgedAt),
          gte(securityAlerts.createdAt, fiveMinutesAgo)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Duplicate alert already exists recently; avoid alert storming
      return;
    }

    await db.insert(securityAlerts).values({
      severity,
      category,
      title,
      description,
      ipAddress: ipAddress || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to create security alert:', err);
  }
}

/**
 * Real-time anomaly detection engine. Evaluates audit logs as they happen
 * and triggers doctor security alerts when suspicious patterns are detected.
 */
export async function evaluateAuditAnomaly({
  action,
  actorRole = 'DOCTOR',
  details,
  status = 'SUCCESS',
  ipAddress,
}: {
  action: AuditAction | string;
  actorRole?: ActorRole | string;
  details?: string | null;
  status?: AuditStatus | string;
  ipAddress?: string;
}): Promise<void> {
  try {
    const safeIp = ipAddress || 'Localhost/Internal';
    const now = new Date();

    // ------------------------------------------------------------------------
    // Heuristic 1: Brute-Force Desk Lockout
    // ------------------------------------------------------------------------
    if (action === 'AUTH_LOCKOUT') {
      await createSecurityAlert({
        severity: 'CRITICAL',
        category: 'BRUTE_FORCE',
        title: 'Brute-Force Lockout Activated',
        description: `Desk security lockout triggered for IP ${safeIp} after repeated invalid PIN entries. Access is temporarily frozen to prevent credential brute-forcing.`,
        ipAddress: safeIp,
        metadata: { action, details, timestamp: now.toISOString() },
      });
      return;
    }

    // ------------------------------------------------------------------------
    // Heuristic 2: Multiple Consecutive Failed Logins in 15 Minutes
    // ------------------------------------------------------------------------
    if (action === 'AUTH_LOGIN_FAILURE') {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentFailures = await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, 'AUTH_LOGIN_FAILURE'),
            gte(auditLogs.timestamp, fifteenMinutesAgo)
          )
        );

      if (recentFailures.length >= 3) {
        await createSecurityAlert({
          severity: 'CRITICAL',
          category: 'BRUTE_FORCE',
          title: 'Multiple Failed PIN Attempts Detected',
          description: `${recentFailures.length} failed login attempts registered within the last 15 minutes from IP ${safeIp}. Possible unauthorized access attempt or brute-force attack.`,
          ipAddress: safeIp,
          metadata: { failureCount: recentFailures.length, ip: safeIp },
        });
      }
      return;
    }

    // ------------------------------------------------------------------------
    // Heuristic 3: Emergency Break-Glass Triage Activated
    // ------------------------------------------------------------------------
    const isBreakGlass =
      (action === 'AUTH_LOGIN_SUCCESS' && actorRole === 'SYSTEM') ||
      (details && /break-glass|emergency triage/i.test(details));

    if (isBreakGlass) {
      await createSecurityAlert({
        severity: 'WARNING',
        category: 'BREAK_GLASS',
        title: 'Emergency Break-Glass Triage Activated',
        description: `Break-glass emergency triage mode was activated without standard Doctor PIN verification. Reason provided: "${details || 'Unspecified emergency'}". Doctor verification required.`,
        ipAddress: safeIp,
        metadata: { reason: details, actorRole, ip: safeIp },
      });
      return;
    }

    // ------------------------------------------------------------------------
    // Heuristic 4: Full Database Snapshot Exfiltration
    // ------------------------------------------------------------------------
    if (action === 'BACKUP_SNAPSHOT_DOWNLOADED') {
      await createSecurityAlert({
        severity: 'CRITICAL',
        category: 'UNUSUAL_TRANSFER',
        title: 'Full Database Snapshot Downloaded',
        description: `A complete raw copy of the clinic SQLite database was exported and downloaded by ${actorRole} from IP ${safeIp}. Verify this data transfer was authorized.`,
        ipAddress: safeIp,
        metadata: { actorRole, action, ip: safeIp },
      });
      return;
    }

    // ------------------------------------------------------------------------
    // Heuristic 5: Unusual Bulk Data Transfer / Exfiltration
    // ------------------------------------------------------------------------
    const exportActions = [
      'DATA_EXPORT_PATIENTS',
      'DATA_EXPORT_CONSULTATIONS',
      'AUDIT_LOG_EXPORTED',
      'BACKUP_SNAPSHOT_DOWNLOADED',
    ];

    if (exportActions.includes(action)) {
      // Check 5a: Off-hours bulk export (between 9:00 PM and 7:00 AM)
      const currentHour = now.getHours();
      const isOffHours = currentHour >= 21 || currentHour < 7;
      if (isOffHours) {
        await createSecurityAlert({
          severity: 'WARNING',
          category: 'UNUSUAL_TRANSFER',
          title: 'Off-Hours Bulk Data Transfer Detected',
          description: `Bulk data export (${action.replace(/_/g, ' ')}) requested outside normal clinic working hours (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) by ${actorRole} from IP ${safeIp}.`,
          ipAddress: safeIp,
          metadata: { action, actorRole, hour: currentHour },
        });
      }

      // Check 5b: Rapid successive exports (2+ in 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentExports = await db
        .select({ id: auditLogs.id, action: auditLogs.action })
        .from(auditLogs)
        .where(gte(auditLogs.timestamp, thirtyMinutesAgo));

      const bulkCount = recentExports.filter((e) =>
        exportActions.includes(e.action)
      ).length;

      if (bulkCount >= 2) {
        await createSecurityAlert({
          severity: 'CRITICAL',
          category: 'UNUSUAL_TRANSFER',
          title: 'High-Frequency Bulk Data Export (Possible Exfiltration)',
          description: `${bulkCount} bulk clinic exports were performed within 30 minutes from IP ${safeIp}. Verify that patient data is not being exfiltrated.`,
          ipAddress: safeIp,
          metadata: { bulkCount, recentActions: recentExports.map((e) => e.action) },
        });
      }
    }

    // ------------------------------------------------------------------------
    // Heuristic 6: RBAC & Access Control Violations
    // ------------------------------------------------------------------------
    const isAccessViolation =
      action === 'RBAC_ACCESS_DENIED' ||
      (status === 'FAILURE' &&
        details &&
        /forbidden|unauthorized|doctor role required|privilege/i.test(details));

    if (isAccessViolation) {
      await createSecurityAlert({
        severity: 'CRITICAL',
        category: 'ACCESS_VIOLATION',
        title: 'Unauthorized Privilege Escalation Attempt',
        description: `Actor role ${actorRole} attempted a restricted clinical action: "${details}". Blocked by Role-Based Access Control.`,
        ipAddress: safeIp,
        metadata: { actorRole, action, details },
      });
      return;
    }

    // ------------------------------------------------------------------------
    // Heuristic 7: Prescription Cryptographic Seal Tamper Detection
    // ------------------------------------------------------------------------
    if (action === 'PRESCRIPTION_TAMPER_DETECTED') {
      await createSecurityAlert({
        severity: 'CRITICAL',
        category: 'INTEGRITY_TAMPER',
        title: 'Prescription Digital Seal Tamper Warning',
        description: `Cryptographic HMAC-SHA256 signature verification failed for clinical prescription record. The data may have been altered or corrupted outside MedScript.`,
        ipAddress: safeIp,
        metadata: { details },
      });
    }
  } catch (err) {
    console.error('Error evaluating audit anomaly:', err);
  }
}

/**
 * Retrieves unacknowledged or all security alerts with aggregated counts.
 */
export async function getSecurityAlerts(options?: {
  unacknowledgedOnly?: boolean;
  limit?: number;
}): Promise<SecurityAlertStats> {
  try {
    const unackOnly = options?.unacknowledgedOnly ?? true;
    const limit = options?.limit ?? 50;

    const query = db
      .select()
      .from(securityAlerts)
      .orderBy(desc(securityAlerts.createdAt))
      .limit(limit);

    let rows = await query;

    if (unackOnly) {
      rows = rows.filter((r) => r.acknowledgedAt === null);
    }

    const items: SecurityAlertItem[] = rows.map((r) => ({
      id: r.id,
      severity: r.severity as AlertSeverity,
      category: r.category as AlertCategory,
      title: r.title,
      description: r.description,
      ipAddress: r.ipAddress,
      metadata: r.metadata,
      createdAt: r.createdAt,
      acknowledgedAt: r.acknowledgedAt,
      acknowledgedBy: r.acknowledgedBy,
    }));

    const activeList = items.filter((a) => a.acknowledgedAt === null);

    return {
      totalActive: activeList.length,
      criticalCount: activeList.filter((a) => a.severity === 'CRITICAL').length,
      warningCount: activeList.filter((a) => a.severity === 'WARNING').length,
      infoCount: activeList.filter((a) => a.severity === 'INFO').length,
      alerts: items,
    };
  } catch (err) {
    console.error('Failed to get security alerts:', err);
    return {
      totalActive: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      alerts: [],
    };
  }
}

/**
 * Acknowledges a single security alert.
 */
export async function acknowledgeAlert(
  id: number,
  acknowledgedBy = 'Doctor'
): Promise<boolean> {
  try {
    await db
      .update(securityAlerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy,
      })
      .where(eq(securityAlerts.id, id));
    return true;
  } catch (err) {
    console.error('Failed to acknowledge alert:', err);
    return false;
  }
}

/**
 * Acknowledges all currently unacknowledged security alerts.
 */
export async function acknowledgeAllAlerts(
  acknowledgedBy = 'Doctor'
): Promise<boolean> {
  try {
    await db
      .update(securityAlerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy,
      })
      .where(isNull(securityAlerts.acknowledgedAt));
    return true;
  } catch (err) {
    console.error('Failed to acknowledge all alerts:', err);
    return false;
  }
}

/**
 * Helper to trigger a realistic simulated security incident for testing & verification.
 */
export async function triggerSecurityTestIncident(
  type: 'brute_force' | 'data_transfer' | 'break_glass' | 'tamper_seal',
  ipAddress = '192.168.1.105'
): Promise<void> {
  if (type === 'brute_force') {
    await createSecurityAlert({
      severity: 'CRITICAL',
      category: 'BRUTE_FORCE',
      title: 'Brute-Force Lockout Activated (Simulated)',
      description: `Desk security lockout triggered for IP ${ipAddress} after 5 consecutive failed PIN entries. Desk access frozen for 15 minutes.`,
      ipAddress,
      metadata: { test: true, simulationTime: new Date().toISOString() },
    });
  } else if (type === 'data_transfer') {
    await createSecurityAlert({
      severity: 'CRITICAL',
      category: 'UNUSUAL_TRANSFER',
      title: 'High-Frequency Bulk Data Export (Simulated Exfiltration)',
      description: `3 bulk clinic data exports (1,450 records) initiated in under 5 minutes from IP ${ipAddress}. Verify data handler authorization.`,
      ipAddress,
      metadata: { test: true, exportCount: 3, recordsExported: 1450 },
    });
  } else if (type === 'break_glass') {
    await createSecurityAlert({
      severity: 'WARNING',
      category: 'BREAK_GLASS',
      title: 'Emergency Break-Glass Triage Activated (Simulated)',
      description: `Emergency break-glass triage access invoked at front desk without doctor PIN. Justification: "Acute trauma patient emergency intake".`,
      ipAddress,
      metadata: { test: true, justification: 'Acute trauma patient emergency intake' },
    });
  } else if (type === 'tamper_seal') {
    await createSecurityAlert({
      severity: 'CRITICAL',
      category: 'INTEGRITY_TAMPER',
      title: 'Prescription Tamper Seal Mismatch (Simulated)',
      description: `Cryptographic HMAC-SHA256 signature verification failed for Rx #1042. Clinical medication records do not match the digital seal.`,
      ipAddress,
      metadata: { test: true, rxId: 1042 },
    });
  }
}
