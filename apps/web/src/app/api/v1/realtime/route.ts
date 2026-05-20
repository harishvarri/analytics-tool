import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validate';
import { requireAdmin } from '@/lib/api/auth';
import { getRealtimeActivity } from '@/lib/repositories/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/** GET /api/v1/realtime — last 5 minutes of activity, newest first. */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { limit } = parseQuery(req, querySchema);
  const items = await getRealtimeActivity(limit);
  return ok(items);
});
