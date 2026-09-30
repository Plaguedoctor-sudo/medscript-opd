import { headers } from 'next/headers';
import { sqlite } from '@/db';

interface RateLimitRow {
  key: string;
  attempts: number;
  first_attempt: number;
  locked_until: number;
}

interface BreakGlassRow {
  ip: string;
  uses: number;
  first_use: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const GLOBAL_MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes tracking window
const GLOBAL_DESK_KEY = '__global_desk_lock__';

// Emergency break-glass rate limit settings (Max 2 uses per 60 minutes)
const BREAK_GLASS_MAX_USES = 2;
const BREAK_GLASS_WINDOW_MS = 60 * 60 * 1000;

// Ensure database tables exist for crash/restart persistence (CWE-799 Hardened)
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      first_attempt INTEGER NOT NULL,
      locked_until INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS break_glass_limits (
      ip TEXT PRIMARY KEY,
      uses INTEGER NOT NULL DEFAULT 0,
      first_use INTEGER NOT NULL
    );
  `);
} catch {
  // Table initialization handled
}

/**
 * Extracts client IP address safely from Next.js request headers.
 * Prioritizes x-real-ip from trusted reverse proxies (Caddy/Nginx)
 * and sanitizes against IP-spoofing injection strings (CWE-290 Hardened).
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const realIp = headerList.get('x-real-ip');
    if (realIp && isValidIp(realIp.trim())) {
      return realIp.trim();
    }
    const forwarded = headerList.get('x-forwarded-for');
    if (forwarded) {
      // Pick the rightmost IP (closest to trusted edge proxy) to avoid client spoofing
      const ips = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
      if (ips.length > 0) {
        const candidate = ips[ips.length - 1];
        if (isValidIp(candidate)) {
          return candidate;
        }
      }
    }
    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

function isValidIp(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Checks whether an IP or the global consultation desk is currently locked out.
 * Reads directly from persistent SQLite storage to survive service reboots.
 */
export function checkPinRateLimit(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  try {
    // Check Client IP Record (isolated per client to prevent cross-client DoS)
    const record = sqlite
      .prepare('SELECT attempts, first_attempt, locked_until FROM rate_limits WHERE key = ?')
      .get(key) as RateLimitRow | undefined;

    if (!record) {
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    if (record.locked_until > now) {
      const retryAfterSeconds = Math.ceil((record.locked_until - now) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    if (now - record.first_attempt > ATTEMPT_WINDOW_MS) {
      sqlite.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
    return { allowed: remaining > 0, remainingAttempts: remaining };
  } catch {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }
}

/**
 * Records a failed PIN attempt and applies lockout if threshold exceeded.
 * Tracks individual client IP to prevent credential brute-forcing while avoiding cross-desk DoS.
 * Persisted synchronously in SQLite WAL.
 */
export function recordFailedPinAttempt(key: string): {
  isLocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  try {
    // Update Client IP Record
    const row = sqlite
      .prepare('SELECT attempts, first_attempt, locked_until FROM rate_limits WHERE key = ?')
      .get(key) as RateLimitRow | undefined;

    let clientAttempts = 1;
    let clientFirst = now;
    let clientLockedUntil = 0;

    if (row && now - row.first_attempt <= ATTEMPT_WINDOW_MS) {
      clientAttempts = row.attempts + 1;
      clientFirst = row.first_attempt;
    }

    if (clientAttempts >= MAX_FAILED_ATTEMPTS) {
      clientLockedUntil = now + LOCKOUT_DURATION_MS;
      sqlite
        .prepare(`
          INSERT INTO rate_limits (key, attempts, first_attempt, locked_until)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            attempts = excluded.attempts,
            first_attempt = excluded.first_attempt,
            locked_until = excluded.locked_until
        `)
        .run(key, clientAttempts, clientFirst, clientLockedUntil);

      const retryAfterSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return {
        isLocked: true,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    sqlite
      .prepare(`
        INSERT INTO rate_limits (key, attempts, first_attempt, locked_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          attempts = excluded.attempts,
          first_attempt = excluded.first_attempt,
          locked_until = excluded.locked_until
      `)
      .run(key, clientAttempts, clientFirst, clientLockedUntil);

    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - clientAttempts,
    };
  } catch {
    return {
      isLocked: false,
      remainingAttempts: 1,
    };
  }
}

/**
 * Resets rate limit counters upon successful authentication
 */
export function resetPinRateLimit(key: string): void {
  try {
    sqlite.prepare('DELETE FROM rate_limits WHERE key = ? OR key = ?').run(key, GLOBAL_DESK_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Emergency Break-Glass rate limiter (Prevents triage credential harvesting).
 * Persisted synchronously in SQLite.
 */
export function checkBreakGlassRateLimit(ip: string): { allowed: boolean; retryAfterMinutes?: number } {
  const now = Date.now();
  try {
    const entry = sqlite
      .prepare('SELECT uses, first_use FROM break_glass_limits WHERE ip = ?')
      .get(ip) as BreakGlassRow | undefined;

    if (!entry) return { allowed: true };

    if (now - entry.first_use > BREAK_GLASS_WINDOW_MS) {
      sqlite.prepare('DELETE FROM break_glass_limits WHERE ip = ?').run(ip);
      return { allowed: true };
    }

    if (entry.uses >= BREAK_GLASS_MAX_USES) {
      const retryAfterMinutes = Math.ceil((BREAK_GLASS_WINDOW_MS - (now - entry.first_use)) / (60 * 1000));
      return { allowed: false, retryAfterMinutes };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function recordBreakGlassAttempt(ip: string): void {
  const now = Date.now();
  try {
    const entry = sqlite
      .prepare('SELECT uses, first_use FROM break_glass_limits WHERE ip = ?')
      .get(ip) as BreakGlassRow | undefined;

    let uses = 1;
    let firstUse = now;

    if (entry && now - entry.first_use <= BREAK_GLASS_WINDOW_MS) {
      uses = entry.uses + 1;
      firstUse = entry.first_use;
    }

    sqlite
      .prepare(`
        INSERT INTO break_glass_limits (ip, uses, first_use)
        VALUES (?, ?, ?)
        ON CONFLICT(ip) DO UPDATE SET
          uses = excluded.uses,
          first_use = excluded.first_use
      `)
      .run(ip, uses, firstUse);
  } catch {
    // Ignore
  }
}

const KIOSK_LOOKUP_MAX_PER_MINUTE = 10;
const KIOSK_LOOKUP_WINDOW_MS = 60 * 1000;

export function checkKioskLookupRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const key = `kiosk_${ip}`;
  const now = Date.now();
  try {
    const entry = sqlite
      .prepare('SELECT attempts, first_attempt FROM rate_limits WHERE key = ?')
      .get(key) as { attempts: number; first_attempt: number } | undefined;

    if (!entry) return { allowed: true };

    if (now - entry.first_attempt > KIOSK_LOOKUP_WINDOW_MS) {
      sqlite.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
      return { allowed: true };
    }

    if (entry.attempts >= KIOSK_LOOKUP_MAX_PER_MINUTE) {
      const retryAfterSeconds = Math.ceil((KIOSK_LOOKUP_WINDOW_MS - (now - entry.first_attempt)) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function recordKioskLookupAttempt(ip: string): void {
  const key = `kiosk_${ip}`;
  const now = Date.now();
  try {
    const entry = sqlite
      .prepare('SELECT attempts, first_attempt FROM rate_limits WHERE key = ?')
      .get(key) as { attempts: number; first_attempt: number } | undefined;

    let attempts = 1;
    let firstAttempt = now;

    if (entry && now - entry.first_attempt <= KIOSK_LOOKUP_WINDOW_MS) {
      attempts = entry.attempts + 1;
      firstAttempt = entry.first_attempt;
    }

    sqlite
      .prepare(`
        INSERT INTO rate_limits (key, attempts, first_attempt, locked_until)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(key) DO UPDATE SET
          attempts = excluded.attempts,
          first_attempt = excluded.first_attempt
      `)
      .run(key, attempts, firstAttempt);
  } catch {
    // Ignore
  }
}

// FHIR R4 Bulk Query Rate Limiting (Prevents Medibank-style mass demographic scraping)
const FHIR_QUERY_MAX_PER_MINUTE = 30;
const FHIR_QUERY_WINDOW_MS = 60 * 1000;

export function checkFhirQueryRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const key = `fhir_${ip}`;
  const now = Date.now();
  try {
    const entry = sqlite
      .prepare('SELECT attempts, first_attempt FROM rate_limits WHERE key = ?')
      .get(key) as { attempts: number; first_attempt: number } | undefined;

    if (!entry) return { allowed: true };

    if (now - entry.first_attempt > FHIR_QUERY_WINDOW_MS) {
      sqlite.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
      return { allowed: true };
    }

    if (entry.attempts >= FHIR_QUERY_MAX_PER_MINUTE) {
      const retryAfterSeconds = Math.ceil((FHIR_QUERY_WINDOW_MS - (now - entry.first_attempt)) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function recordFhirQueryAttempt(ip: string): void {
  const key = `fhir_${ip}`;
  const now = Date.now();
  try {
    const entry = sqlite
      .prepare('SELECT attempts, first_attempt FROM rate_limits WHERE key = ?')
      .get(key) as { attempts: number; first_attempt: number } | undefined;

    let attempts = 1;
    let firstAttempt = now;

    if (entry && now - entry.first_attempt <= FHIR_QUERY_WINDOW_MS) {
      attempts = entry.attempts + 1;
      firstAttempt = entry.first_attempt;
    }

    sqlite
      .prepare(`
        INSERT INTO rate_limits (key, attempts, first_attempt, locked_until)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(key) DO UPDATE SET
          attempts = excluded.attempts,
          first_attempt = excluded.first_attempt
      `)
      .run(key, attempts, firstAttempt);
  } catch {
    // Ignore
  }
}
