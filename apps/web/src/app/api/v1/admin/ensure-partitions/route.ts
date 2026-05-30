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
 * POST /api/v1/admin/ensure-partitions
 * Calls the SQL `ensure_events_partition(p_month)` for the current month
 * and the next N (RUNTIME.partitions.leadMonths). Idempotent — existing
 * partitions are skipped. Schedule monthly via Vercel Cron.
 */
// BUG-005 fix: Vercel Cron sends GET; export both so cron works and manual POST still works.
async function handler(req: NextRequest) {
  requireCronSecret(req);
  const admin = getSupabaseAdmin();
  const ensured: string[] = [];
  const now = new Date();
  for (let i = 0; i <= RUNTIME.partitions.leadMonths; i++) {
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const iso = target.toISOString().slice(0, 10);
    const { error } = await admin.rpc('ensure_events_partition', { p_month: iso });
    if (error) throw new AppError('PARTITION_ENSURE_FAILED', `${iso}: ${error.message}`, 500);
    ensured.push(iso);
  }
  return ok({ ensured });
}

export const GET  = withApiHandler(handler);
export const POST = withApiHandler(handler);
