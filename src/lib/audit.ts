import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { getClientIp } from './rate-limiter';

export type AuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOCKOUT'
  | 'AUTH_LOGOUT'
  | 'SECURITY_SETTINGS_UPDATED'
  | 'PRESCRIPTION_CREATED'
  | 'PRESCRIPTION_UPDATED'
  | 'PRESCRIPTION_DELETED'
  | 'PATIENT_CREATED'
  | 'PATIENT_UPDATED'
  | 'PATIENT_DELETED'
  | 'DATA_EXPORT_CONSULTATIONS'
  | 'DATA_EXPORT_PATIENTS'
  | 'BACKUP_SNAPSHOT_DOWNLOADED'
  | 'BACKUP_SNAPSHOT_CREATED'
  | 'SETTINGS_SAVED';

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
