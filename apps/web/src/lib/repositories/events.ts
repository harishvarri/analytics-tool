import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import type { RealtimeActivityRow } from '@/types/database';
import type { TrackEventInput } from '../schemas/events';
import type { RealtimeActivityItem } from '@/types/analytics';

interface InsertContext {
  ipHash?: string | null;
  userAgent?: string | null;
}

/** Map of each event → its resolved central user_id (uuid) or null. */
export type ResolvedUsers = Map<TrackEventInput, string | null>;

// ── Deterministic uuid v5 (RFC 4122) so the same email always mints the same id
// (retries/concurrent batches converge on the analytics_users.id PK). ─────────
const UUID_NS = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'; // URL namespace
function uuidv5FromEmail(email: string): string {
  const ns = Buffer.from(UUID_NS.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(ns).update(email).digest();
  const b = h.subarray(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x50; // version 5
  b[8] = (b[8]! & 0x3f) | 0x80; // variant
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Resolve each event to a central user_id and ensure that user row exists
 * (so the FK on analytics_events/analytics_sessions.user_id is satisfied):
 *   - uuid path  → use as-is; enrich email/name only when currently null
 *                  (directory-synced values always win).
 *   - email path → resolve by lower(email); mint a deterministic synthetic user
 *                  (source='event', is_internal=false) if none exists.
 *   - anon path  → the stable anon browser uuid from ncpl.js (unchanged).
 * Best-effort: on any failure the event resolves to null (never breaks ingest).
 */
export async function resolveUserIds(events: TrackEventInput[]): Promise<ResolvedUsers> {
  const admin = getSupabaseAdmin();
  const result: ResolvedUsers = new Map();

  const uuids = new Set<string>();
  const emailTraits = new Map<string, { name?: string }>(); // lower(email) → traits
  for (const e of events) {
    if (e.userId) uuids.add(e.userId);
    else if (e.userEmail) {
      const key = e.userEmail.toLowerCase();
      if (!emailTraits.has(key)) emailTraits.set(key, e.userName ? { name: e.userName } : {});
    }
  }

  // 1. Ensure uuid users exist, then enrich email/name where currently null.
  if (uuids.size) {
    try {
      await admin
        .from('analytics_users')
        .upsert([...uuids].map((id) => ({ id })), { onConflict: 'id', ignoreDuplicates: true });

      const enrich = new Map<string, { email?: string; name?: string }>();
      for (const e of events) {
        if (e.userId && (e.userEmail || e.userName)) {
          const cur = enrich.get(e.userId) ?? {};
          if (e.userEmail && !cur.email) cur.email = e.userEmail.toLowerCase();
          if (e.userName && !cur.name) cur.name = e.userName;
          enrich.set(e.userId, cur);
        }
      }
      for (const [id, t] of enrich) {
        try {
          if (t.email) await admin.from('analytics_users').update({ email: t.email }).eq('id', id).is('email', null);
          if (t.name) await admin.from('analytics_users').update({ display_name: t.name }).eq('id', id).is('display_name', null);
        } catch {
          /* email-collision or other — non-fatal */
        }
      }
    } catch (err) {
      console.warn('[analytics] resolveUserIds uuid path failed:', err instanceof Error ? err.message : err);
    }
  }

  // 2. Resolve / mint email-only users (independent apps).
  const emailToId = new Map<string, string>();
  if (emailTraits.size) {
    const lowered = [...emailTraits.keys()];
    try {
      // Use the safe SQL upsert function (migration 0023) which handles
      // race conditions and duplicate emails correctly.
      for (const email of lowered) {
        try {
          const { data } = await admin.rpc('upsert_user_by_email', {
            p_email: email,
            p_display_name: emailTraits.get(email)?.name ?? null,
            p_source: 'event',
            p_is_internal: false,
          });
          if (data) emailToId.set(email, data as string);
        } catch {
          // Fallback to the JS-mint path if the RPC isn't available yet.
          try {
            const id = uuidv5FromEmail(email);
            await admin.from('analytics_users').upsert({
              id, email,
              display_name: emailTraits.get(email)?.name ?? null,
              source: 'event', is_internal: false,
            }, { onConflict: 'id', ignoreDuplicates: true });
            emailToId.set(email, id);
          } catch {
            console.warn('[analytics] resolveUserIds: could not mint user for', email);
          }
        }
      }
    } catch (err) {
      console.warn('[analytics] resolveUserIds email path failed:', err instanceof Error ? err.message : err);
    }
  }

  for (const e of events) {
    if (e.userId) result.set(e, e.userId);
    else if (e.userEmail) result.set(e, emailToId.get(e.userEmail.toLowerCase()) ?? null);
    else result.set(e, null);
  }
  return result;
}

/**
 * Bulk-insert events using the service-role client (bypasses RLS).
 * Maps SDK camelCase → DB snake_case. `resolved` supplies the central user_id
 * per event (uuid / email-resolved / null).
 */
export async function insertEventsBatch(
  events: TrackEventInput[],
  ctx: InsertContext = {},
  resolved?: ResolvedUsers,
): Promise<{ inserted: number }> {
  if (events.length === 0) return { inserted: 0 };

  const rows = events.map((e) => ({
    ...(e.id !== undefined ? { id: e.id } : {}),
    portal_id: e.portalId,
    category: e.category,
    name: e.name,
    source: e.source ?? 'web',
    user_id: resolved ? (resolved.get(e) ?? null) : (e.userId ?? null),
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

  // BUG-008 fix: use upsert so retries with the same client-supplied id are
  // idempotent rather than throwing a PK violation 500.
  const { error, count } = await getSupabaseAdmin()
    .from('analytics_events')
    .upsert(rows, { onConflict: 'id,occurred_at', ignoreDuplicates: true, count: 'exact' });

  if (error) {
    throw new AppError('INGEST_FAILED', `Event insert failed: ${error.message}`, 500);
  }
  return { inserted: count ?? rows.length };
}

/**
 * Upsert sessions referenced by an event batch. Only inserts brand-new
 * sessions; existing rows are touched by the per-event trigger.
 */
export async function ensureSessionsForBatch(
  events: TrackEventInput[],
  ctx: InsertContext = {},
  resolved?: ResolvedUsers,
): Promise<void> {
  const sessions = new Map<string, { user_id: string | null; portal_id: string }>();
  for (const e of events) {
    if (e.sessionId) {
      const uid = resolved ? (resolved.get(e) ?? null) : (e.userId ?? null);
      sessions.set(e.sessionId, { user_id: uid, portal_id: e.portalId });
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
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  }));
}
