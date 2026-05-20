import type { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseBody } from '@/lib/api/validate';
import { requireIngestKey } from '@/lib/api/auth';
import { clientIp, rateLimit } from '@/lib/api/rate-limit';
import { hashIp } from '@/lib/api/hash';
import { trackEventBatchSchema } from '@/lib/schemas/events';
import {
  ensureSessionsForBatch,
  insertEventsBatch,
} from '@/lib/repositories/events';
import { RUNTIME } from '@/config/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/events
 * Bulk event ingestion. Called by every portal SDK.
 *
 *  - Auth: `x-ncpl-api-key` shared secret
 *  - Rate limit: 100 req/s burst per IP
 *  - Body:   { "events": TrackEventInput[] }
 *  - Result: { ok: true, data: { inserted: N } }
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  rateLimit(req, {
    capacity: RUNTIME.ingest.burstPerSecond,
    refillPerSec: RUNTIME.ingest.sustainedPerSecond,
  });
  requireIngestKey(req);

  const { events } = await parseBody(req, trackEventBatchSchema, {
    maxBytes: RUNTIME.ingest.maxBodyBytes,
  });

  const ip = clientIp(req);
  const ipHash = ip === 'unknown' ? null : hashIp(ip);
  const userAgent = req.headers.get('user-agent');

  await ensureSessionsForBatch(events, { ipHash, userAgent });
  const { inserted } = await insertEventsBatch(events, { ipHash, userAgent });

  return ok({ inserted });
});
