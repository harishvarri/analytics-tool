import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import type {
  AnalyticsSessionRow,
  AnalyticsUserRow,
  PortalDailyRow,
  UserDailyRow,
} from '@/types/database';
import type {
  DashboardKpis,
  PortalSummary,
  SessionSummary,
} from '@/types/analytics';

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

/** Per-portal 24h summary. Reads the daily MV — fast even on hot tables. */
export async function getPortalSummaries(): Promise<PortalSummary[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseAdmin()
    .from('mv_portal_daily')
    .select('*')
    .eq('day', today);
  if (error) throw new AppError('PORTAL_QUERY_FAILED', error.message, 500);
  const rows = (data ?? []) as PortalDailyRow[];
  return rows.map((r) => ({
    portalId: r.portal_id,
    events24h: r.events,
    users24h: r.users,
    sessions24h: r.sessions,
    errors24h: r.errors,
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

/** Top active users in the last 24h. Joins the per-day MV with the user table. */
export async function getActiveUsers(limit = 50): Promise<UserActivityRow[]> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: dailyData, error } = await admin
    .from('mv_user_daily')
    .select('user_id, events')
    .eq('day', today)
    .order('events', { ascending: false })
    .limit(limit);
  if (error) throw new AppError('USERS_QUERY_FAILED', error.message, 500);
  const daily = (dailyData ?? []) as Pick<UserDailyRow, 'user_id' | 'events'>[];

  const ids = daily.map((d) => d.user_id);
  if (ids.length === 0) return [];

  const { data: usersData, error: usersErr } = await admin
    .from('analytics_users')
    .select('id, email, display_name, last_seen_at')
    .in('id', ids);
  if (usersErr) throw new AppError('USERS_QUERY_FAILED', usersErr.message, 500);
  const users = (usersData ?? []) as Pick<
    AnalyticsUserRow,
    'id' | 'email' | 'display_name' | 'last_seen_at'
  >[];

  const lookup = new Map(users.map((u) => [u.id, u]));
  return daily.map((d) => {
    const u = lookup.get(d.user_id);
    return {
      userId: d.user_id,
      email: u?.email ?? null,
      displayName: u?.display_name ?? null,
      lastSeenAt: u?.last_seen_at ?? null,
      events24h: d.events,
    };
  });
}
