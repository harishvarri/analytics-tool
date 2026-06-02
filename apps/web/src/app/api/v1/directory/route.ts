import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseBody } from '@/lib/api/validate';
import { requireIngestKey } from '@/lib/api/auth';
import { ForbiddenError } from '@/lib/api/errors';
import { syncDirectorySchema } from '@/lib/schemas/directory';
import { syncDirectory } from '@/lib/repositories/operational';

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

export const POST = withApiHandler(async (req: NextRequest) => {
  // 1. Authenticate with requireIngestKey
  const authorizedSlug = await requireIngestKey(req);

  // 2. Reject project-specific keys; only allow the global key (authorizedSlug === null)
  if (authorizedSlug !== null) {
    throw new ForbiddenError('Only the global API key can update the directory');
  }

  // 3. Parse and validate the directory sync payload
  const { users } = await parseBody(req, syncDirectorySchema);

  // 4. Sync with repository
  const result = await syncDirectory(users);

  // 5. Build and return response
  const res = ok(result);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
});
