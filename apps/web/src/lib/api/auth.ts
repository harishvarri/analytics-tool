import 'server-only';
import type { NextRequest } from 'next/server';
import { env } from '../env';
import { AuthError, ForbiddenError } from './errors';
import { getSupabaseServer } from '../supabase/server';

/**
 * Constant-time-ish string comparison. Avoids early-exit timing leaks on
 * the API key check. Not cryptographically perfect, but good enough for
 * a shared secret authn header.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies the `x-ncpl-api-key` header on portal-to-platform ingestion.
 * Throws AuthError if missing or wrong; succeeds silently otherwise.
 */
export function requireIngestKey(req: NextRequest): void {
  if (!env.INGEST_API_KEY) {
    // Soft-fail in environments without a configured key (dev). We still
    // require *some* value so consumers wire their SDK correctly.
    if (!req.headers.get('x-ncpl-api-key')) {
      throw new AuthError('Missing x-ncpl-api-key header');
    }
    return;
  }
  const provided = req.headers.get('x-ncpl-api-key');
  if (!provided || !safeEqual(provided, env.INGEST_API_KEY)) {
    throw new AuthError('Invalid x-ncpl-api-key');
  }
}

/**
 * Verifies the `x-cron-secret` (or `authorization: Bearer …`) header used to
 * gate admin maintenance endpoints. Vercel Cron stamps this automatically.
 */
export function requireCronSecret(req: NextRequest): void {
  if (!env.CRON_SECRET) {
    throw new AuthError('CRON_SECRET not configured on the server');
  }
  const header =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null;
  if (!header || !safeEqual(header, env.CRON_SECRET)) {
    throw new AuthError('Invalid cron secret');
  }
}

/**
 * Requires the caller to be an authenticated analytics admin (role in
 * {'admin','owner'} on analytics_users). Used by every dashboard read API.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await getSupabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new AuthError();
  const userId = userData.user.id;

  const { data, error } = await supabase.rpc('is_analytics_admin');
  if (error) throw new ForbiddenError('Failed to verify admin role');
  if (!data) throw new ForbiddenError();
  return { userId };
}
