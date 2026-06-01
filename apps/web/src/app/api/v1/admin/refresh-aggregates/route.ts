import type { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/auth';
import { AppError } from '@/lib/api/errors';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/admin/refresh-aggregates  (BUG-005 fix: Vercel Cron sends GET)
 * POST kept for manual triggers / backwards compatibility.
 * Refreshes every materialized view (concurrently, via the SQL function).
 * Migration 0026 makes the function self-healing for empty MVs.
 */
async function handler(req: NextRequest) {
  requireCronSecret(req);
  const { error } = await getSupabaseAdmin().rpc('refresh_analytics_aggregates');
  if (error) throw new AppError('AGGREGATE_REFRESH_FAILED', error.message, 500);
  return ok({ refreshed: true });
}

export const GET  = withApiHandler(handler);
export const POST = withApiHandler(handler);
