import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/api/auth';
import { getPortalSummaries } from '@/lib/repositories/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/v1/analytics/portals — per-portal 24h aggregates. */
export const GET = withApiHandler(async () => {
  await requireAdmin();
  const summaries = await getPortalSummaries();
  return ok(summaries);
});
