import { headers } from 'next/headers';

interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes tracking window

// In-memory rate limiting store (isolated per Node.js process)
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Extracts client IP address safely from Next.js request headers
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    const realIp = headerList.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Checks whether an IP or identifier is currently locked out
 */
export function checkPinRateLimit(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // Check if currently locked out
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // If lockout expired or tracking window passed, reset
  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    rateLimitMap.delete(key);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

/**
 * Records a failed PIN attempt and applies lockout if threshold exceeded
 */
export function recordFailedPinAttempt(key: string): {
  isLocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
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

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
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
}
