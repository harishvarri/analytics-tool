import type { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/auth';
import { snapshotReliabilityHealth } from '@/lib/repositories/reliabilityHealth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/admin/snapshot-health  (Vercel Cron sends GET)
 * POST kept for manual triggers.
 *
 * Persists today's reliability score for every product into health_history,
 * powering the Daily / Weekly / Monthly Health Evolution trends. Idempotent —
 * safe to run multiple times per day. Wire this to a daily Vercel Cron in
 * vercel.json; until then the Health dashboard snapshots opportunistically on
 * view, so trends still build from real usage.
 */
async function handler(req: NextRequest) {
  requireCronSecret(req);
  const result = await snapshotReliabilityHealth();
  return ok(result);
}

export const GET  = withApiHandler(handler);
export const POST = withApiHandler(handler);
