import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
  resolveUserIds,
} from '@/lib/repositories/events';
import { RUNTIME } from '@/config/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-ncpl-api-key',
  'Access-Control-Max-Age': '86400',
};

/** Handle CORS preflight — browsers send this before the real POST. */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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
  await requireIngestKey(req);

  const { events } = await parseBody(req, trackEventBatchSchema, {
    maxBytes: RUNTIME.ingest.maxBodyBytes,
  });

  const ip = clientIp(req);
  const ipHash = ip === 'unknown' ? null : hashIp(ip);
  const userAgent = req.headers.get('user-agent');

  // Resolve each event to a central user_id (uuid as-is / email-resolved / minted),
  // ensuring the user rows exist before sessions + events reference them.
  const resolved = await resolveUserIds(events);
  await ensureSessionsForBatch(events, { ipHash, userAgent }, resolved);
  const { inserted } = await insertEventsBatch(events, { ipHash, userAgent }, resolved);

  const res = ok({ inserted });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
});
