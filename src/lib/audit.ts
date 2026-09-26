import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { getClientIp } from './rate-limiter';

export type AuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOCKOUT'
  | 'AUTH_LOGOUT'
  | 'MFA_SETUP'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'PASSWORD_ROTATED'
  | 'SECURITY_SETTINGS_UPDATED'
  | 'PRESCRIPTION_CREATED'
  | 'PRESCRIPTION_UPDATED'
  | 'PRESCRIPTION_DELETED'
  | 'PRESCRIPTION_VIEWED'
  | 'PRESCRIPTION_PRINTED'
  | 'PRESCRIPTION_PDF_DOWNLOADED'
  | 'PRESCRIPTION_DISPATCHED_WHATSAPP'
  | 'PRESCRIPTION_DISPATCHED_SMS'
  | 'PATIENT_CREATED'
  | 'PATIENT_UPDATED'
  | 'PATIENT_DELETED'
  | 'PATIENT_VIEWED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_DELETED'
  | 'DATA_EXPORT_CONSULTATIONS'
  | 'DATA_EXPORT_PATIENTS'
  | 'AUDIT_LOG_EXPORTED'
  | 'BACKUP_SNAPSHOT_DOWNLOADED'
  | 'BACKUP_SNAPSHOT_CREATED'
  | 'SETTINGS_SAVED'
  | 'RBAC_ACCESS_DENIED'
  | 'PRESCRIPTION_TAMPER_DETECTED'
  | 'SECURITY_ALERT_TRIGGERED'
  | 'SECURITY_ALERT_ACKNOWLEDGED'
  | 'SECURITY_LOCKDOWN_TRIGGERED'
  | 'SECURITY_LOCKDOWN_LIFTED'
  | 'DECEPTION_DATA_SERVED'
  | 'DECEPTION_MODE_TOGGLED';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'WARNING';

export type ActorRole = 'DOCTOR' | 'RECEPTIONIST' | 'SYSTEM';

export interface AuditLogItem {
  id: number;
  timestamp: Date | null;
  action: string;
  actorRole?: string | null;
  details: string | null;
  ipAddress: string | null;
  status: string;
}

export async function logAuditEvent({
  action,
  actorRole = 'DOCTOR',
  details,
  status = 'SUCCESS',
  ipAddress,
}: {
  action: AuditAction;
  actorRole?: ActorRole;
  details?: string;
  status?: AuditStatus;
  ipAddress?: string;
}): Promise<void> {
  try {
    const ip = ipAddress || (await getClientIp());

    await db.insert(auditLogs).values({
      timestamp: new Date(),
      action,
      actorRole,
      details: details ? details.slice(0, 1000) : null,
      ipAddress: ip,
      status,
    });

    // Evaluate in real-time for security anomalies and threat alerts
    const { evaluateAuditAnomaly } = await import('./security-engine');
    await evaluateAuditAnomaly({
      action,
      actorRole,
      details,
      status,
      ipAddress: ip,
    });
  } catch (err) {
    // Audit logging should not crash the main thread, but log to stderr
    console.error('Failed to write audit log:', err);
  }
}

export async function getRecentAuditLogs(limit = 20): Promise<AuditLogItem[]> {
  try {
    const records = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return records.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      action: r.action,
      actorRole: r.actorRole,
      details: r.details,
      ipAddress: r.ipAddress,
      status: r.status,
    }));
  } catch {
    return [];
  }
}
