import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sqlite } from '@/db';
import { logAuditEvent } from '@/lib/audit';

export type LanMirrorRole = 'PRIMARY_MASTER' | 'STANDBY_REPLICA' | 'STANDALONE';
export type LanClusterHealth = 'HEALTHY' | 'SYNCING' | 'LAGGING' | 'PEER_UNREACHABLE' | 'DEGRADED' | 'STANDALONE';

export const HA_TOKEN_HEADER = 'x-medscript-ha-token';
export const HA_SIGNATURE_HEADER = 'x-medscript-ha-signature';

export interface LanMirrorConfig {
  role: LanMirrorRole;
  nodeName: string;
  peerUrl: string;
  clusterSecret: string;
  autoFailover: boolean;
  heartbeatIntervalSec: number;
  lastSyncAt: Date | null;
  lastSyncStatus: string;
  lastSyncHash: string | null;
}

export interface LanMirrorStatus {
  configured: boolean;
  role: LanMirrorRole;
  nodeName: string;
  peerUrl: string;
  autoFailover: boolean;
  heartbeatIntervalSec: number;
  health: LanClusterHealth;
  lastSyncAt: Date | null;
  lastSyncStatus: string;
  lastSyncHash: string | null;
  currentLocalHash: string;
  peerReachable?: boolean;
  peerRole?: LanMirrorRole;
  peerNodeName?: string;
  peerDatabaseHash?: string;
  peerLatencyMs?: number;
  lastError?: string;
}

/**
 * Constant-time token verification to prevent timing attacks.
 */
export function verifyClusterToken(clientToken?: string | null, expectedSecret?: string | null): boolean {
  if (!clientToken || !expectedSecret) return false;
  const clientBuf = Buffer.from(clientToken.trim());
  const expectedBuf = Buffer.from(expectedSecret.trim());
  if (clientBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(clientBuf, expectedBuf);
}

/**
 * Computes a deterministic SHA-256 seal of the current SQLite database file.
 */
export function computeDatabaseHash(): string {
  try {
    sqlite.pragma('wal_checkpoint(PASSIVE)');
  } catch {
    // Ignore checkpoint errors if another transaction is writing
  }

  const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'sqlite.db');
  if (!fs.existsSync(dbPath)) return '';

  const fileBuffer = fs.readFileSync(dbPath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Retrieves the LAN Mirroring configuration from clinic_settings.
 * If clusterSecret is not yet set, automatically generates a secure 256-bit PSK.
 */
export function getLanMirrorConfig(): LanMirrorConfig {
  try {
    const row = sqlite
      .prepare(`
        SELECT 
          lan_mirror_role,
          lan_mirror_peer_url,
          lan_mirror_cluster_secret,
          lan_mirror_node_name,
          lan_mirror_auto_failover,
          lan_mirror_last_sync_at,
          lan_mirror_last_sync_status,
          lan_mirror_last_sync_hash,
          lan_mirror_heartbeat_interval_sec
        FROM clinic_settings 
        WHERE id = 1
      `)
      .get() as {
        lan_mirror_role?: string;
        lan_mirror_peer_url?: string;
        lan_mirror_cluster_secret?: string;
        lan_mirror_node_name?: string;
        lan_mirror_auto_failover?: number;
        lan_mirror_last_sync_at?: number;
        lan_mirror_last_sync_status?: string;
        lan_mirror_last_sync_hash?: string;
        lan_mirror_heartbeat_interval_sec?: number;
      } | undefined;

    let secret = row?.lan_mirror_cluster_secret;
    if (!secret || secret.trim().length < 16) {
      secret = crypto.randomBytes(32).toString('hex');
      try {
        sqlite
          .prepare('UPDATE clinic_settings SET lan_mirror_cluster_secret = ? WHERE id = 1')
          .run(secret);
      } catch {
        // Fallback in memory
      }
    }

    return {
      role: (row?.lan_mirror_role as LanMirrorRole) || 'STANDALONE',
      nodeName: row?.lan_mirror_node_name || 'Doctor Desk (Primary)',
      peerUrl: row?.lan_mirror_peer_url || '',
      clusterSecret: secret,
      autoFailover: Boolean(row?.lan_mirror_auto_failover),
      heartbeatIntervalSec: row?.lan_mirror_heartbeat_interval_sec || 15,
      lastSyncAt: row?.lan_mirror_last_sync_at ? new Date(row.lan_mirror_last_sync_at) : null,
      lastSyncStatus: row?.lan_mirror_last_sync_status || 'IDLE',
      lastSyncHash: row?.lan_mirror_last_sync_hash || null,
    };
  } catch (err) {
    console.error('Failed to get LAN mirror config:', err);
    return {
      role: 'STANDALONE',
      nodeName: 'Doctor Desk (Primary)',
      peerUrl: '',
      clusterSecret: crypto.randomBytes(32).toString('hex'),
      autoFailover: false,
      heartbeatIntervalSec: 15,
      lastSyncAt: null,
      lastSyncStatus: 'IDLE',
      lastSyncHash: null,
    };
  }
}

/**
 * Saves updated LAN Mirroring configuration to clinic_settings.
 */
export async function saveLanMirrorConfig(
  config: Partial<LanMirrorConfig>,
  actorRole: string = 'DOCTOR'
): Promise<void> {
  const current = getLanMirrorConfig();
  const role = config.role ?? current.role;
  const nodeName = config.nodeName ?? current.nodeName;
  const peerUrl = config.peerUrl !== undefined ? config.peerUrl.trim() : current.peerUrl;
  const clusterSecret = config.clusterSecret ? config.clusterSecret.trim() : current.clusterSecret;
  const autoFailover = config.autoFailover !== undefined ? (config.autoFailover ? 1 : 0) : (current.autoFailover ? 1 : 0);
  const heartbeatIntervalSec = config.heartbeatIntervalSec ?? current.heartbeatIntervalSec;

  sqlite
    .prepare(`
      UPDATE clinic_settings 
      SET 
        lan_mirror_role = ?,
        lan_mirror_node_name = ?,
        lan_mirror_peer_url = ?,
        lan_mirror_cluster_secret = ?,
        lan_mirror_auto_failover = ?,
        lan_mirror_heartbeat_interval_sec = ?
      WHERE id = 1
    `)
    .run(role, nodeName, peerUrl, clusterSecret, autoFailover, heartbeatIntervalSec);

  await logAuditEvent({
    action: 'SYSTEM_CONFIG_UPDATED',
    actorRole,
    details: `Updated High Availability LAN Mirroring config: Role=${role}, Node='${nodeName}', Peer='${peerUrl}', AutoFailover=${Boolean(autoFailover)}`,
    status: 'SUCCESS',
  });
}

/**
 * Creates a signed snapshot package of the SQLite database for LAN peer replication.
 */
export async function createReplicationPackage(clusterSecret: string): Promise<{
  buffer: Buffer;
  sha256: string;
  signature: string;
  timestamp: number;
}> {
  const tempDir = path.join(process.cwd(), 'backups', 'lan_temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
  }

  const tempFile = path.join(tempDir, `snap-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.db`);

  try {
    await sqlite.backup(tempFile);
    const buffer = fs.readFileSync(tempFile);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const signature = crypto.createHmac('sha256', clusterSecret).update(buffer).digest('hex');

    return {
      buffer,
      sha256,
      signature,
      timestamp: Date.now(),
    };
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        // Zero out temp file before deletion (NIST SP 800-88)
        fs.writeFileSync(tempFile, Buffer.alloc(fs.statSync(tempFile).size, 0));
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Validates HMAC signature and applies a replicated snapshot onto this node.
 * Implements pre-sync safety backup and automatic rollback on verification failure.
 */
export async function applyReplicationSnapshot(
  snapshotBuffer: Buffer,
  signature: string,
  clusterSecret: string,
  sourcePeerUrl: string = 'LAN_PEER',
  customDbPath?: string
): Promise<{ success: boolean; hash: string; error?: string }> {
  // 1. Verify HMAC signature using constant-time comparison
  const expectedSig = crypto.createHmac('sha256', clusterSecret).update(snapshotBuffer).digest('hex');
  const sigMatch = crypto.timingSafeEqual(Buffer.from(signature.trim()), Buffer.from(expectedSig));
  if (!sigMatch) {
    const errMsg = 'HMAC signature verification failed: Snapshot altered or incorrect cluster secret';
    try {
      sqlite.prepare(`
        INSERT INTO lan_mirror_audit (timestamp, event_type, peer_url, direction, status, bytes_transferred, error_message)
        VALUES (?, 'SNAPSHOT_PULL', ?, 'INBOUND', 'FAILURE', ?, ?)
      `).run(Date.now(), sourcePeerUrl, snapshotBuffer.length, errMsg);
    } catch {
      // Ignore audit db insert error
    }
    throw new Error(errMsg);
  }

  const newHash = crypto.createHash('sha256').update(snapshotBuffer).digest('hex');

  // If testing against an isolated target database path
  if (customDbPath) {
    fs.writeFileSync(customDbPath, snapshotBuffer);
    const Database = require('better-sqlite3');
    const tempDb = new Database(customDbPath);
    const check = tempDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
    tempDb.close();
    if (!check || !check[0] || check[0].integrity_check !== 'ok') {
      throw new Error(`Integrity check failed: ${check?.[0]?.integrity_check || 'Corrupted'}`);
    }
    return { success: true, hash: newHash };
  }

  const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'sqlite.db');
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
  }

  // 2. Pre-sync safety snapshot
  const preSyncFile = path.join(backupsDir, `medscript-backup-pre-sync-${Date.now()}.db`);
  try {
    await sqlite.backup(preSyncFile);
  } catch (backupErr) {
    console.warn('Failed to take pre-sync safety snapshot, proceeding with caution:', backupErr);
  }

  try {
    // 3. Truncate WAL and write replicated bytes
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Best-effort WAL truncation
    }

    fs.writeFileSync(dbPath, snapshotBuffer);

    // Remove obsolete WAL/SHM files
    try {
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    } catch {
      // Ignore
    }

    // Enforce POSIX 0600
    try {
      fs.chmodSync(dbPath, 0o600);
    } catch {
      // Ignore
    }

    // 4. Verify SQLite block integrity on the newly applied database
    const check = sqlite.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (!check || !check[0] || check[0].integrity_check !== 'ok') {
      const integrityErr = check?.[0]?.integrity_check || 'Database integrity corrupted';
      // Rollback to preSyncFile
      if (fs.existsSync(preSyncFile)) {
        fs.copyFileSync(preSyncFile, dbPath);
      }
      throw new Error(`Integrity check failed after applying snapshot: ${integrityErr}. Reverted to pre-sync backup.`);
    }

    // 5. Update sync metadata in database
    const now = Date.now();
    sqlite
      .prepare(`
        UPDATE clinic_settings 
        SET 
          lan_mirror_last_sync_at = ?,
          lan_mirror_last_sync_status = 'HEALTHY',
          lan_mirror_last_sync_hash = ?
        WHERE id = 1
      `)
      .run(now, newHash);

    // 6. Record replication audit entry
    sqlite.prepare(`
      INSERT INTO lan_mirror_audit (timestamp, event_type, peer_url, direction, status, bytes_transferred, checksum)
      VALUES (?, 'SNAPSHOT_PULL', ?, 'INBOUND', 'SUCCESS', ?, ?)
    `).run(now, sourcePeerUrl, snapshotBuffer.length, newHash);

    await logAuditEvent({
      action: 'SYSTEM_CONFIG_UPDATED',
      actorRole: 'SYSTEM',
      details: `High Availability database replication applied successfully from ${sourcePeerUrl}. Seal: ${newHash.slice(0, 16)}...`,
      status: 'SUCCESS',
    });

    return { success: true, hash: newHash };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    sqlite
      .prepare(`
        UPDATE clinic_settings 
        SET 
          lan_mirror_last_sync_status = 'FAILED'
        WHERE id = 1
      `)
      .run();

    sqlite.prepare(`
      INSERT INTO lan_mirror_audit (timestamp, event_type, peer_url, direction, status, bytes_transferred, error_message)
      VALUES (?, 'SNAPSHOT_PULL', ?, 'INBOUND', 'FAILURE', ?, ?)
    `).run(Date.now(), sourcePeerUrl, snapshotBuffer.length, errorMsg);

    throw err;
  }
}

/**
 * Pings a peer node to inspect health, role, db hash, and measure LAN latency.
 */
export async function checkPeerHeartbeat(
  peerUrl: string,
  clusterSecret: string
): Promise<{
  reachable: boolean;
  latencyMs: number;
  role?: LanMirrorRole;
  nodeName?: string;
  dbHash?: string;
  uptime?: number;
  error?: string;
}> {
  if (!peerUrl || !peerUrl.startsWith('http')) {
    return { reachable: false, latencyMs: 0, error: 'Invalid or missing Peer URL' };
  }

  const cleanUrl = peerUrl.replace(/\/+$/, '');
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${cleanUrl}/api/lan-mirror/heartbeat`, {
      method: 'GET',
      headers: {
        [HA_TOKEN_HEADER]: clusterSecret,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        reachable: false,
        latencyMs,
        error: `Peer returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      reachable: true,
      latencyMs,
      role: data.role,
      nodeName: data.nodeName,
      dbHash: data.dbHash,
      uptime: data.uptime,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : 'Failed to reach peer';
    return {
      reachable: false,
      latencyMs,
      error: msg,
    };
  }
}

/**
 * Standby Replica pulls latest snapshot from Primary Master and applies it.
 */
export async function syncFromPeer(
  peerUrl: string,
  clusterSecret: string
): Promise<{ success: boolean; message: string; hash?: string }> {
  if (!peerUrl || !peerUrl.startsWith('http')) {
    return { success: false, message: 'Invalid peer URL configured.' };
  }

  const cleanUrl = peerUrl.replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s max for snapshot transfer

    const res = await fetch(`${cleanUrl}/api/lan-mirror/sync`, {
      method: 'GET',
      headers: {
        [HA_TOKEN_HEADER]: clusterSecret,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, message: `Peer returned HTTP ${res.status}: ${res.statusText}` };
    }

    const signature = res.headers.get(HA_SIGNATURE_HEADER);
    if (!signature) {
      return { success: false, message: 'Missing cryptographic seal header from peer.' };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await applyReplicationSnapshot(buffer, signature, clusterSecret, cleanUrl);
    return {
      success: true,
      message: `Database synchronized successfully. Verified SHA-256 seal: ${result.hash.slice(0, 16)}...`,
      hash: result.hash,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    return { success: false, message: msg };
  }
}

/**
 * Promotes a Standby Replica node to Primary Master (Emergency Failover).
 */
export async function promoteToPrimary(
  actorRole: string = 'DOCTOR',
  reason: string = 'Manual failover promotion triggered by operator'
): Promise<{ success: boolean; message: string }> {
  try {
    sqlite
      .prepare(`
        UPDATE clinic_settings 
        SET 
          lan_mirror_role = 'PRIMARY_MASTER',
          lan_mirror_last_sync_status = 'HEALTHY'
        WHERE id = 1
      `)
      .run();

    sqlite.prepare(`
      INSERT INTO lan_mirror_audit (timestamp, event_type, status, error_message)
      VALUES (?, 'FAILOVER_PROMOTION', 'SUCCESS', ?)
    `).run(Date.now(), reason);

    await logAuditEvent({
      action: 'SYSTEM_CONFIG_UPDATED',
      actorRole,
      details: `HIGH AVAILABILITY EMERGENCY FAILOVER PROMOTION: Node promoted to PRIMARY_MASTER. Reason: ${reason}`,
      status: 'WARNING',
    });

    return {
      success: true,
      message: 'Node successfully promoted to PRIMARY_MASTER! All write operations are now authorized.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failover promotion failed';
    return { success: false, message: msg };
  }
}

/**
 * Assembles the full status of LAN Mirroring for this node and its peer.
 */
export async function getLanMirrorFullStatus(): Promise<LanMirrorStatus> {
  const config = getLanMirrorConfig();
  const currentLocalHash = computeDatabaseHash();

  if (config.role === 'STANDALONE') {
    return {
      configured: false,
      role: 'STANDALONE',
      nodeName: config.nodeName,
      peerUrl: config.peerUrl,
      autoFailover: config.autoFailover,
      heartbeatIntervalSec: config.heartbeatIntervalSec,
      health: 'STANDALONE',
      lastSyncAt: config.lastSyncAt,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncHash: config.lastSyncHash,
      currentLocalHash,
    };
  }

  let peerReachable = false;
  let peerRole: LanMirrorRole | undefined;
  let peerNodeName: string | undefined;
  let peerDatabaseHash: string | undefined;
  let peerLatencyMs: number | undefined;
  let lastError: string | undefined;

  if (config.peerUrl) {
    const ping = await checkPeerHeartbeat(config.peerUrl, config.clusterSecret);
    peerReachable = ping.reachable;
    peerRole = ping.role;
    peerNodeName = ping.nodeName;
    peerDatabaseHash = ping.dbHash;
    peerLatencyMs = ping.latencyMs;
    lastError = ping.error;
  }

  let health: LanClusterHealth = 'HEALTHY';
  if (!config.peerUrl) {
    health = 'DEGRADED';
  } else if (!peerReachable) {
    health = 'PEER_UNREACHABLE';
  } else if (peerDatabaseHash && peerDatabaseHash !== currentLocalHash) {
    health = 'LAGGING';
  }

  return {
    configured: true,
    role: config.role,
    nodeName: config.nodeName,
    peerUrl: config.peerUrl,
    autoFailover: config.autoFailover,
    heartbeatIntervalSec: config.heartbeatIntervalSec,
    health,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncHash: config.lastSyncHash,
    currentLocalHash,
    peerReachable,
    peerRole,
    peerNodeName,
    peerDatabaseHash,
    peerLatencyMs,
    lastError,
  };
}
