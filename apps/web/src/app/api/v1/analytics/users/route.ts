import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validate';
import { requireAdmin } from '@/lib/api/auth';
import { getActiveUsers } from '@/lib/repositories/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/** GET /api/v1/analytics/users — top active users by event count today. */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { limit } = parseQuery(req, querySchema);
  const users = await getActiveUsers(limit);
  return ok(users);
});
