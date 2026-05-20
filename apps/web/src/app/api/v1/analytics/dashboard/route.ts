import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/api/auth';
import { getDashboardKpis } from '@/lib/repositories/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/v1/analytics/dashboard — KPI tiles for the overview page. */
export const GET = withApiHandler(async () => {
  await requireAdmin();
  const kpis = await getDashboardKpis();
  return ok(kpis);
});
