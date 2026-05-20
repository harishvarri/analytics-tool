import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validate';
import { requireAdmin } from '@/lib/api/auth';
import { getRecentSessions } from '@/lib/repositories/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/** GET /api/v1/analytics/sessions — recent sessions, newest first. */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { limit } = parseQuery(req, querySchema);
  const sessions = await getRecentSessions(limit);
  return ok(sessions);
});
