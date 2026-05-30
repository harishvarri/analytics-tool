import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import type {
  AnalyticsSessionRow,
  PortalDailyRow,
} from '@/types/database';
import type {
  DashboardKpis,
  PortalSummary,
  SessionSummary,
  PortalId,
  EventCategory,
} from '@/types/analytics';
import type { TimePoint } from '../mock/dashboard';

/** 24-hour KPIs for the overview dashboard. */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [eventsRes, sessionsRes, usersRes, errorsRes] = await Promise.all([
    admin.from('analytics_events').select('id', { count: 'exact', head: true }).gte('occurred_at', since),
    admin.from('analytics_sessions').select('id', { count: 'exact', head: true }).gte('started_at', since),
    admin.from('analytics_events').select('user_id').gte('occurred_at', since).not('user_id', 'is', null),
    admin.from('analytics_events').select('id', { count: 'exact', head: true })
      .eq('category', 'error').gte('occurred_at', since),
  ]);

  for (const r of [eventsRes, sessionsRes, usersRes, errorsRes]) {
    if (r.error) throw new AppError('KPI_QUERY_FAILED', r.error.message, 500);
  }

  const totalEvents = eventsRes.count ?? 0;
  const totalSessions = sessionsRes.count ?? 0;
  const userIds = ((usersRes.data ?? []) as { user_id: string | null }[])
    .map((r) => r.user_id)
    .filter((id): id is string => id !== null);
  const activeUsers = new Set(userIds).size;
  const errors = errorsRes.count ?? 0;

  return {
    activeUsers,
    totalSessions,
    totalEvents,
    errorRate: totalEvents > 0 ? errors / totalEvents : 0,
  };
}

/** Per-portal 24h summary. Prefers the daily MV; falls back to direct aggregation. */
export async function getPortalSummaries(): Promise<PortalSummary[]> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Try the materialized view first (fast, refreshed every 5 min by cron).
  const { data: mvData, error: mvError } = await admin
    .from('mv_portal_daily')
    .select('*')
    .eq('day', today);

  if (!mvError && mvData && mvData.length > 0) {
    const rows = mvData as PortalDailyRow[];
    return rows.map((r) => ({
      portalId: r.portal_id,
      events24h: r.events,
      users24h: r.users,
      sessions24h: r.sessions,
      errors24h: r.errors,
    }));
  }

  // MV empty or error → aggregate directly from analytics_events (slightly slower but always fresh).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('analytics_events')
    .select('portal_id, user_id, session_id, category')
    .gte('occurred_at', since);

  if (error) throw new AppError('PORTAL_QUERY_FAILED', error.message, 500);

  const map = new Map<string, { events: number; users: Set<string>; sessions: Set<string>; errors: number }>();
  for (const row of (data ?? []) as { portal_id: string; user_id: string | null; session_id: string | null; category: string }[]) {
    if (!map.has(row.portal_id)) {
      map.set(row.portal_id, { events: 0, users: new Set(), sessions: new Set(), errors: 0 });
    }
    const p = map.get(row.portal_id)!;
    p.events++;
    if (row.user_id) p.users.add(row.user_id);
    if (row.session_id) p.sessions.add(row.session_id);
    if (row.category === 'error') p.errors++;
  }

  return Array.from(map.entries()).map(([portalId, p]) => ({
    portalId: portalId as PortalId,
    events24h: p.events,
    users24h: p.users.size,
    sessions24h: p.sessions.size,
    errors24h: p.errors,
  }));
}

/** Recent sessions list, newest first. */
export async function getRecentSessions(limit = 50): Promise<SessionSummary[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('analytics_sessions')
    .select('id, user_id, portal_id, started_at, last_seen_at, ended_at, event_count')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new AppError('SESSIONS_QUERY_FAILED', error.message, 500);
  const rows = (data ?? []) as Pick<
    AnalyticsSessionRow,
    'id' | 'user_id' | 'portal_id' | 'started_at' | 'last_seen_at' | 'ended_at' | 'event_count'
  >[];
  return rows.map((r) => ({
    sessionId: r.id,
    userId: r.user_id,
    portalId: r.portal_id,
    startedAt: r.started_at,
    lastSeenAt: r.last_seen_at,
    endedAt: r.ended_at,
    eventCount: r.event_count,
  }));
}

export interface UserActivityRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  lastSeenAt: string | null;
  events24h: number;
}

/**
 * Hourly events + active-users time series for the last N hours.
 * Groups rows in JS so we don't need a stored function.
 */
export async function getEventsTimeSeries(hours = 24): Promise<TimePoint[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('analytics_events')
    .select('occurred_at, user_id')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true });

  if (error) throw new AppError('TIMESERIES_QUERY_FAILED', error.message, 500);

  // Build hour buckets aligned to the current hour
  const buckets = new Map<string, { events: number; users: Set<string> }>();
  const now = Date.now();
  for (let i = hours - 1; i >= 0; i--) {
    const ts = new Date(now - i * 60 * 60 * 1000);
    ts.setMinutes(0, 0, 0);
    ts.setMilliseconds(0);
    buckets.set(ts.toISOString(), { events: 0, users: new Set() });
  }

  for (const row of (data ?? []) as { occurred_at: string; user_id: string | null }[]) {
    const ts = new Date(row.occurred_at);
    ts.setMinutes(0, 0, 0);
    ts.setMilliseconds(0);
    const key = ts.toISOString();
    if (buckets.has(key)) {
      const b = buckets.get(key)!;
      b.events++;
      if (row.user_id) b.users.add(row.user_id);
    }
  }

  return Array.from(buckets.entries()).map(([ts, b]) => ({
    ts,
    events: b.events,
    users: b.users.size,
  }));
}

/** Category breakdown for the last 24h — direct from analytics_events. */
export async function getCategoryBreakdown(): Promise<{ category: EventCategory; events: number }[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('analytics_events')
    .select('category')
    .gte('occurred_at', since);

  if (error) throw new AppError('CATEGORY_QUERY_FAILED', error.message, 500);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { category: string }[]) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([category, events]) => ({
    category: category as EventCategory,
    events,
  }));
}

/**
 * Top active users over the last 30 days.
 *
 * Reads LIVE from analytics_events (not a materialized view), so it never goes
 * stale waiting on a cron refresh and reflects events the moment they arrive.
 * Aggregates per user_id in JS over the most recent rows, then joins
 * analytics_users for names.
 */
/**
 * BUG-010 fix: the old implementation pulled 10k rows then aggregated in JS,
 * which produced wrong rankings (users with many older events dropped off the
 * recency window). Now uses v_user_profile_summary (SQL aggregation, no row limit)
 * and falls back to a direct RPC query if the view is unavailable.
 */
export async function getActiveUsers(limit = 50): Promise<UserActivityRow[]> {
  const admin = getSupabaseAdmin();

  // Use the SQL-aggregated view so rankings are correct regardless of event volume.
  const { data, error } = await admin
    .from('v_user_profile_summary')
    .select('user_id, email, display_name, last_active_at, total_events')
    .not('user_id', 'is', null)
    .order('total_events', { ascending: false })
    .limit(limit);

  if (error) throw new AppError('USERS_QUERY_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    user_id: string; email: string | null; display_name: string | null;
    last_active_at: string | null; total_events: number;
  }>).map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    lastSeenAt: r.last_active_at,
    events24h: Number(r.total_events),
  }));
}
