import { headers } from 'next/headers';

interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const GLOBAL_MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes tracking window
const GLOBAL_DESK_KEY = '__global_desk_lock__';

// Emergency break-glass rate limit settings (Max 2 uses per 60 minutes)
const BREAK_GLASS_MAX_USES = 2;
const BREAK_GLASS_WINDOW_MS = 60 * 60 * 1000;
const breakGlassMap = new Map<string, { uses: number; firstUse: number }>();

// In-memory rate limiting store (isolated per Node.js process)
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Extracts client IP address safely from Next.js request headers.
 * Prioritizes x-real-ip from trusted reverse proxies (Caddy/Nginx)
 * and sanitizes against IP-spoofing injection strings.
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
      const candidate = forwarded.split(',')[0].trim();
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

function isValidIp(ip: string): boolean {
  // Simple check for valid IPv4 or IPv6 format
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Checks whether an IP or the global consultation desk is currently locked out
 */
export function checkPinRateLimit(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  // 1. Check Global Desk Lockout (Defends against IP-rotation header spoofing attacks)
  const globalRecord = rateLimitMap.get(GLOBAL_DESK_KEY);
  if (globalRecord && globalRecord.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((globalRecord.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // 2. Check Specific Client IP Record
  const record = rateLimitMap.get(key);
  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    rateLimitMap.delete(key);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

/**
 * Records a failed PIN attempt and applies lockout if threshold exceeded.
 * Tracks both the individual client IP and the overall consultation desk.
 */
export function recordFailedPinAttempt(key: string): {
  isLocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  // 1. Update Global Desk Record
  let globalRecord = rateLimitMap.get(GLOBAL_DESK_KEY);
  if (!globalRecord || now - globalRecord.firstAttempt > ATTEMPT_WINDOW_MS) {
    globalRecord = { attempts: 1, firstAttempt: now, lockedUntil: 0 };
  } else {
    globalRecord.attempts += 1;
  }
  if (globalRecord.attempts >= GLOBAL_MAX_FAILED_ATTEMPTS) {
    globalRecord.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  rateLimitMap.set(GLOBAL_DESK_KEY, globalRecord);

  // 2. Update Client IP Record
  let record = rateLimitMap.get(key);
  if (!record || now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    record = {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: 0,
    };
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= MAX_FAILED_ATTEMPTS || globalRecord.lockedUntil > now) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitMap.set(key, record);
    const retryAfterSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return {
      isLocked: true,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  rateLimitMap.set(key, record);
  return {
    isLocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.attempts,
  };
}

/**
 * Resets rate limit counters upon successful authentication
 */
export function resetPinRateLimit(key: string): void {
  rateLimitMap.delete(key);
  rateLimitMap.delete(GLOBAL_DESK_KEY);
}

/**
 * Emergency Break-Glass rate limiter (Prevents triage credential harvesting)
 */
export function checkBreakGlassRateLimit(ip: string): { allowed: boolean; retryAfterMinutes?: number } {
  const now = Date.now();
  const entry = breakGlassMap.get(ip);
  if (!entry) return { allowed: true };

  if (now - entry.firstUse > BREAK_GLASS_WINDOW_MS) {
    breakGlassMap.delete(ip);
    return { allowed: true };
  }

  if (entry.uses >= BREAK_GLASS_MAX_USES) {
    const retryAfterMinutes = Math.ceil((BREAK_GLASS_WINDOW_MS - (now - entry.firstUse)) / (60 * 1000));
    return { allowed: false, retryAfterMinutes };
  }

  return { allowed: true };
}

export function recordBreakGlassAttempt(ip: string): void {
  const now = Date.now();
  const entry = breakGlassMap.get(ip);
  if (!entry || now - entry.firstUse > BREAK_GLASS_WINDOW_MS) {
    breakGlassMap.set(ip, { uses: 1, firstUse: now });
  } else {
    entry.uses += 1;
    breakGlassMap.set(ip, entry);
  }
}
