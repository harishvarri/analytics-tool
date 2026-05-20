import type { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/auth';
import { AppError } from '@/lib/api/errors';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/admin/refresh-aggregates
 * Refreshes every materialized view (concurrently, via the SQL function).
 * Schedule via Vercel Cron — see vercel.json.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  requireCronSecret(req);
  const { error } = await getSupabaseAdmin().rpc('refresh_analytics_aggregates');
  if (error) throw new AppError('AGGREGATE_REFRESH_FAILED', error.message, 500);
  return ok({ refreshed: true });
});
