import 'server-only';
import type { NextRequest } from 'next/server';
import { RateLimitError } from './errors';

interface Bucket {
  tokens: number;
  refilledAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Bucket capacity (max burst). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSec: number;
  /** Unique bucket key (default: IP). */
  key?: string;
}

/**
 * Best-effort in-memory token-bucket limiter. Per-instance (no cross-region
 * coordination). Good enough as a first line of defense against runaway
 * clients; pair with Vercel WAF / Supabase Edge limits for hardened prod.
 */
export function rateLimit(req: NextRequest, opts: RateLimitOptions): void {
  const now = Date.now();
  const key = opts.key ?? clientIp(req);
  const existing = buckets.get(key);
  const refillRate = opts.refillPerSec / 1000;

  if (!existing) {
    buckets.set(key, { tokens: opts.capacity - 1, refilledAt: now });
    return;
  }

  const refill = (now - existing.refilledAt) * refillRate;
  existing.tokens = Math.min(opts.capacity, existing.tokens + refill);
  existing.refilledAt = now;

  if (existing.tokens < 1) {
    throw new RateLimitError(`Rate limit exceeded (${opts.capacity}/s burst)`);
  }
  existing.tokens -= 1;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() ?? 'unknown';
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
