import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseBody } from '@/lib/api/validate';
import { requireIngestKey } from '@/lib/api/auth';
import { clientIp, rateLimit } from '@/lib/api/rate-limit';
import { hashIp } from '@/lib/api/hash';
import { trackEventBatchSchema, trackEventSchema } from '@/lib/schemas/events';
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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/v1/events
 *
 * BUG-006 fix: requireIngestKey now returns the authorized project slug.
 *   - global key → null (any portalId allowed, same behaviour as before)
 *   - per-project key → "sentinel-project" (portalId must match)
 *
 * BUG-008 fix: events with a client-supplied id use upsert (ignoreDuplicates)
 *   so retries are safe and never error with 500.
 *
 * BUG-009 fix: validate events individually; return partial results instead of
 *   rejecting the whole batch for one bad event.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  rateLimit(req, {
    capacity: RUNTIME.ingest.burstPerSecond,
    refillPerSec: RUNTIME.ingest.sustainedPerSecond,
  });

  // BUG-006: get the authorized project slug (null = global key, any portalId ok)
  const authorizedSlug = await requireIngestKey(req);

  const { events: rawEvents } = await parseBody(req, trackEventBatchSchema, {
    maxBytes: RUNTIME.ingest.maxBodyBytes,
  });

  // BUG-009: validate each event individually — accept valid ones, skip invalid.
  const valid = [];
  const invalid = [];
  for (const e of rawEvents) {
    const parsed = trackEventSchema.safeParse(e);
    if (!parsed.success) {
      invalid.push({ event: e, error: parsed.error.flatten().fieldErrors });
      continue;
    }
    // BUG-006: per-project key — enforce portalId matches the key's project.
    if (authorizedSlug && parsed.data.portalId !== authorizedSlug) {
      invalid.push({ event: e, error: { portalId: [`key is authorized for "${authorizedSlug}" only`] } });
      continue;
    }
    valid.push(parsed.data);
  }

  if (valid.length === 0) {
    const res = NextResponse.json(
      { ok: false, error: { code: 'ALL_EVENTS_INVALID', message: 'No valid events in batch', details: invalid } },
      { status: 400 },
    );
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const ip = clientIp(req);
  const ipHash = ip === 'unknown' ? null : hashIp(ip);
  const userAgent = req.headers.get('user-agent');

  const resolved = await resolveUserIds(valid);
  await ensureSessionsForBatch(valid, { ipHash, userAgent }, resolved);
  const { inserted } = await insertEventsBatch(valid, { ipHash, userAgent }, resolved);

  const responseData: Record<string, unknown> = { inserted };
  if (invalid.length > 0) responseData['skipped'] = invalid.length;

  const res = ok(responseData);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
});
