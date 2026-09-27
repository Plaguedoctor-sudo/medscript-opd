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
  | 'IPD_ADMISSION_CREATED'
  | 'IPD_ADMISSION_UPDATED'
  | 'IPD_PATIENT_DISCHARGED'
  | 'IPD_ROUND_ADDED'
  | 'IPD_ROUND_DELETED'
  | 'LAB_REPORT_CREATED'
  | 'LAB_REPORT_UPDATED'
  | 'LAB_REPORT_COMPLETED'
  | 'LAB_REPORT_DELETED'
  | 'LAB_REPORT_PRINTED'
  | 'LAB_REPORT_DISPATCHED'
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
  | 'DECEPTION_MODE_TOGGLED'
  | 'STAFF_USER_CREATED'
  | 'STAFF_USER_UPDATED'
  | 'STAFF_USER_DELETED'
  | 'STAFF_PASSWORD_RESET';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'WARNING';

export type ActorRole = 'ADMIN_DOCTOR' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'LAB_TECHNICIAN' | 'SYSTEM' | string;

export interface AuditLogItem {
  id: number;
  timestamp: Date | null;
  action: string;
  actorRole?: string | null;
  details: string | null;
  ipAddress: string | null;
  status: string;
}

export function formatActorRole(role?: string | null): ActorRole {
  if (!role) return 'DOCTOR';
  switch (role.toLowerCase()) {
    case 'admin_doctor':
      return 'ADMIN_DOCTOR';
    case 'doctor':
      return 'DOCTOR';
    case 'nurse':
      return 'NURSE';
    case 'receptionist':
      return 'RECEPTIONIST';
    case 'lab_technician':
      return 'LAB_TECHNICIAN';
    default:
      return role.toUpperCase();
  }
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
    const normalizedRole = formatActorRole(actorRole);

    await db.insert(auditLogs).values({
      timestamp: new Date(),
      action,
      actorRole: normalizedRole,
      details: details ? details.slice(0, 1000) : null,
      ipAddress: ip,
      status,
    });

    // Evaluate in real-time for security anomalies and threat alerts
    const { evaluateAuditAnomaly } = await import('./security-engine');
    await evaluateAuditAnomaly({
      action,
      actorRole: normalizedRole,
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
