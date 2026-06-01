import type { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/auth';
import { AppError } from '@/lib/api/errors';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RUNTIME } from '@/config/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET/POST /api/v1/admin/enforce-retention
 *
 * Calls the SQL `enforce_event_retention(p_raw_days)` which archives
 * business-critical events from partitions older than the retention window,
 * then detaches + drops those partitions. Cheap, idempotent.
 *
 * Schedule daily via GitHub Actions cron (see refresh-aggregates.yml) or pg_cron.
 * Guarded by the shared cron secret like every other /admin route.
 */
async function handler(req: NextRequest) {
  requireCronSecret(req);
  const rawDays = RUNTIME.retention?.rawDays ?? 90;
  const { data, error } = await getSupabaseAdmin().rpc('enforce_event_retention', {
    p_raw_days: rawDays,
  });
  if (error) throw new AppError('RETENTION_ENFORCE_FAILED', error.message, 500);
  return ok({ droppedPartitions: data ?? 0, rawDays });
}

export const GET = withApiHandler(handler);
export const POST = withApiHandler(handler);
