import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import type { RealtimeActivityRow } from '@/types/database';
import type { TrackEventInput } from '../schemas/events';
import type { RealtimeActivityItem } from '@/types/analytics';

interface InsertContext {
  ipHash?: string | null;
  userAgent?: string | null;
}

/**
 * Bulk-insert events using the service-role client (bypasses RLS).
 * Maps SDK camelCase → DB snake_case at the boundary; ingest is the only
 * place that translation happens.
 */
export async function insertEventsBatch(
  events: TrackEventInput[],
  ctx: InsertContext = {},
): Promise<{ inserted: number }> {
  if (events.length === 0) return { inserted: 0 };

  const rows = events.map((e) => ({
    ...(e.id !== undefined ? { id: e.id } : {}),
    portal_id: e.portalId,
    category: e.category,
    name: e.name,
    source: e.source ?? 'web',
    user_id: e.userId ?? null,
    session_id: e.sessionId ?? null,
    url: e.url ?? null,
    referrer: e.referrer ?? null,
    metadata: {
      ...(e.metadata ?? {}),
      ...(ctx.ipHash ? { _ip_hash: ctx.ipHash } : {}),
      ...(ctx.userAgent ? { _ua: ctx.userAgent } : {}),
    },
    occurred_at: e.occurredAt ?? new Date().toISOString(),
  }));

  const { error, count } = await getSupabaseAdmin()
    .from('analytics_events')
    .insert(rows, { count: 'exact' });

  if (error) {
    throw new AppError('INGEST_FAILED', `Event insert failed: ${error.message}`, 500);
  }
  return { inserted: count ?? rows.length };
}

/**
 * Upsert any user IDs from the batch into analytics_users so the FK on
 * analytics_events.user_id is satisfied. Portals use their own Supabase auth;
 * migration 0005 removed the FK that once required analytics_users.id to exist
 * in auth.users, so any UUID is now valid.
 */
async function ensureUsersForBatch(events: TrackEventInput[]): Promise<void> {
  const userIds = [...new Set(events.map((e) => e.userId).filter((id): id is string => !!id))];
  if (userIds.length === 0) return;

  const rows = userIds.map((id) => ({ id }));
  const { error } = await getSupabaseAdmin()
    .from('analytics_users')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  // Non-fatal: if this fails (e.g. FK still in place before migration runs),
  // we log and continue — insertEventsBatch will null out user_ids below.
  if (error) {
    console.warn('[analytics] ensureUsersForBatch failed — user_id will be omitted:', error.message);
  }
}

/**
 * Upsert sessions referenced by an event batch. Only inserts brand-new
 * sessions; existing rows are touched by the per-event trigger.
 */
export async function ensureSessionsForBatch(
  events: TrackEventInput[],
  ctx: InsertContext = {},
): Promise<void> {
  // Upsert users first so the FK on analytics_sessions.user_id is satisfied.
  await ensureUsersForBatch(events);

  const sessions = new Map<string, { user_id: string | null; portal_id: string }>();
  for (const e of events) {
    if (e.sessionId) {
      sessions.set(e.sessionId, { user_id: e.userId ?? null, portal_id: e.portalId });
    }
  }
  if (sessions.size === 0) return;

  const rows = Array.from(sessions.entries()).map(([id, v]) => ({
    id,
    user_id: v.user_id,
    portal_id: v.portal_id,
    ip_hash: ctx.ipHash ?? null,
    user_agent: ctx.userAgent ?? null,
  }));

  const { error } = await getSupabaseAdmin()
    .from('analytics_sessions')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    throw new AppError('SESSION_UPSERT_FAILED', error.message, 500);
  }
}

/**
 * Recent activity feed (last 5 minutes, capped to `limit`). Reads the
 * realtime view, which already enriches user + portal joins.
 */
export async function getRealtimeActivity(limit = 100): Promise<RealtimeActivityItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_realtime_activity')
    .select('*')
    .limit(limit);
  if (error) throw new AppError('REALTIME_QUERY_FAILED', error.message, 500);
  const rows = (data ?? []) as RealtimeActivityRow[];
  return rows.map((r) => ({
    id: r.id,
    portalId: r.portal_id,
    portalName: r.portal_name,
    category: r.category,
    eventName: r.event_name,
    userId: r.user_id,
    userEmail: r.user_email,
    userDisplayName: r.user_display_name,
    sessionId: r.session_id,
    url: r.url,
    occurredAt: r.occurred_at,
  }));
}
