import 'server-only';
import type { NextRequest } from 'next/server';
import { RateLimitError } from './errors';

interface Bucket {
  tokens: number;
  refilledAt: number;
}

// BUG-017 fix — two improvements to the in-memory token bucket:
//   1. Periodic cleanup so the Map never grows unboundedly (memory leak fix).
//   2. retryAfterSec on the error so the events route can send Retry-After.
//
// Honest note: this remains per-instance. For multi-region pair with Upstash.
// Cleanup runs every 5 minutes and evicts buckets idle > 10 minutes.
const buckets = new Map<string, Bucket>();
const IDLE_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now - b.refilledAt > IDLE_TTL_MS) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    (cleanupTimer as { unref: () => void }).unref();
  }
}

export interface RateLimitOptions {
  capacity: number;
  refillPerSec: number;
  key?: string;
}

export function rateLimit(req: NextRequest, opts: RateLimitOptions): void {
  ensureCleanup();
  const now = Date.now();
  const key = opts.key ?? clientIp(req);
  const refillRate = opts.refillPerSec / 1000;
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, { tokens: opts.capacity - 1, refilledAt: now });
    return;
  }

  const refill = (now - existing.refilledAt) * refillRate;
  existing.tokens = Math.min(opts.capacity, existing.tokens + refill);
  existing.refilledAt = now;

  if (existing.tokens < 1) {
    const retryAfterSec = Math.ceil((1 - existing.tokens) / opts.refillPerSec);
    throw new RateLimitError(`Rate limit exceeded — retry after ${retryAfterSec}s`);
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
