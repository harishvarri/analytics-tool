import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Operational read layer — per-app, event-driven. No SSO/directory concept:
 * identity comes from each app calling ncpl.identify() on login, and all metrics
 * are derived from the events the apps send.
 */

const n = (v: unknown): number => Number(v ?? 0);

// ── Org pulse (today) — CEO command-center top line ──────────────────────────
export interface OrgPulse {
  loginsToday: number;
  appsActive:  number;
  appsTotal:   number;
}

export async function getOrgPulse(): Promise<OrgPulse> {
  const admin = getSupabaseAdmin();
  const since = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;

  // BUG-021 fix: appsActive was computed in JS over a 10k pull; use SQL COUNT(DISTINCT)
  const [loginsRes, totalRes] = await Promise.all([
    admin.from('analytics_events').select('id', { count: 'exact', head: true })
      .eq('name', 'auth.login').gte('occurred_at', since),
    admin.from('analytics_projects').select('slug', { count: 'exact', head: true }),
  ]);

  if (loginsRes.error) throw new AppError('ORG_PULSE_FAILED', loginsRes.error.message, 500);

  // Count distinct portals active today via SQL RPC (with JS fallback).
  let appsActive = 0;
  try {
    const { data: activeData } = await admin.rpc('count_active_portals_today', { p_since: since });
    appsActive = Number(activeData ?? 0);
  } catch {
    // RPC not yet deployed — fall back to JS aggregation.
    const { data: evData } = await admin
      .from('analytics_events')
      .select('portal_id')
      .gte('occurred_at', since)
      .limit(5000);
    appsActive = new Set(((evData ?? []) as { portal_id: string }[]).map((r) => r.portal_id)).size;
  }

  return {
    loginsToday: loginsRes.count ?? 0,
    appsActive,
    appsTotal: totalRes.count ?? 0,
  };
}

// ── People (per app or cross-app) — identified users from events ─────────────
export interface AppUserRow {
  userId:        string;
  email:         string | null;
  displayName:   string | null;
  department:    string | null;
  team:          string | null;
  firstSeenAt:   string | null;
  lastActiveAt:  string | null;
  totalEvents:   number;
  totalSessions: number;
}

export async function getAppUsers(appSlug: string, limit = 100): Promise<AppUserRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_user_app_profile')
    .select('*')
    .eq('project_slug', appSlug)
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new AppError('APP_USERS_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId:        String(r.user_id),
    email:         (r.email as string | null) ?? null,
    displayName:   (r.display_name as string | null) ?? null,
    department:    (r.department as string | null) ?? null,
    team:          (r.team as string | null) ?? null,
    firstSeenAt:   (r.first_seen_at as string | null) ?? null,
    lastActiveAt:  (r.last_active_at as string | null) ?? null,
    totalEvents:   n(r.total_events),
    totalSessions: n(r.total_sessions),
  }));
}

export interface UserProfileSummary {
  userId:        string;
  email:         string | null;
  displayName:   string | null;
  department:    string | null;
  team:          string | null;
  status:        string;
  appsUsed:      number;
  totalEvents:   number;
  totalSessions: number;
  firstSeenAt:   string | null;
  lastActiveAt:  string | null;
}

export async function getUserProfileSummaries(limit = 100): Promise<UserProfileSummary[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_user_profile_summary')
    .select('*')
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new AppError('USER_PROFILE_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId:        String(r.user_id),
    email:         (r.email as string | null) ?? null,
    displayName:   (r.display_name as string | null) ?? null,
    department:    (r.department as string | null) ?? null,
    team:          (r.team as string | null) ?? null,
    status:        String(r.status ?? 'active'),
    appsUsed:      n(r.apps_used),
    totalEvents:   n(r.total_events),
    totalSessions: n(r.total_sessions),
    firstSeenAt:   (r.first_seen_at as string | null) ?? null,
    lastActiveAt:  (r.last_active_at as string | null) ?? null,
  }));
}

// ── Per-user monitoring profile (login → activity) ───────────────────────────
export interface UserDetail {
  userId:              string;
  email:               string | null;
  displayName:         string | null;
  department:          string | null;
  team:                string | null;
  title:               string | null;
  status:              string;
  isInternal:          boolean;
  firstSeenAt:         string | null;
  lastActiveAt:        string | null;
  totalEvents:         number;
  totalSessions:       number;
  totalSessionMinutes: number;
  logins:              number;
  apps:                { projectSlug: string; events: number; sessions: number; firstSeen: string | null; lastActive: string | null }[];
  recent:              { name: string; category: string; portalId: string; occurredAt: string; url: string | null; metadata: Record<string, unknown> | null }[];
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const admin = getSupabaseAdmin();

  const { data: u } = await admin
    .from('analytics_users')
    .select('id, email, display_name, department, team, title, status, is_internal')
    .eq('id', userId)
    .maybeSingle();
  if (!u) return null;
  const user = u as Record<string, unknown>;

  const [{ data: appRows }, { data: sessRows }, { data: evRows }] = await Promise.all([
    admin.from('v_user_app_profile').select('*').eq('user_id', userId),
    admin.from('analytics_sessions').select('started_at, last_seen_at, ended_at').eq('user_id', userId).limit(2000),
    admin
      .from('analytics_events')
      .select('name, category, portal_id, occurred_at, url, metadata')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ]);

  const apps = ((appRows ?? []) as Record<string, unknown>[]).map((r) => ({
    projectSlug: String(r.project_slug),
    events:      n(r.total_events),
    sessions:    n(r.total_sessions),
    firstSeen:   (r.first_seen_at as string | null) ?? null,
    lastActive:  (r.last_active_at as string | null) ?? null,
  }));

  const sessions = (sessRows ?? []) as { started_at: string; last_seen_at: string; ended_at: string | null }[];
  let totalMs = 0;
  for (const s of sessions) {
    const start = new Date(s.started_at).getTime();
    const end = new Date(s.ended_at ?? s.last_seen_at).getTime();
    if (end > start) totalMs += end - start;
  }

  const recent = ((evRows ?? []) as Record<string, unknown>[]).map((r) => ({
    name:       String(r.name),
    category:   String(r.category),
    portalId:   String(r.portal_id),
    occurredAt: String(r.occurred_at),
    url:        (r.url as string | null) ?? null,
    metadata:   (r.metadata as Record<string, unknown> | null) ?? null,
  }));
  const logins = recent.filter((e) => e.name === 'auth.login').length;

  const totalEvents = apps.reduce((s, a) => s + a.events, 0);
  const lastActive = apps.reduce<string | null>((m, a) => (a.lastActive && (!m || a.lastActive > m) ? a.lastActive : m), null);
  const firstSeen = apps.reduce<string | null>((m, a) => (a.firstSeen && (!m || a.firstSeen < m) ? a.firstSeen : m), null);

  return {
    userId,
    email:               (user.email as string | null) ?? null,
    displayName:         (user.display_name as string | null) ?? null,
    department:          (user.department as string | null) ?? null,
    team:                (user.team as string | null) ?? null,
    title:               (user.title as string | null) ?? null,
    status:              String(user.status ?? 'active'),
    isInternal:          Boolean(user.is_internal),
    firstSeenAt:         firstSeen,
    lastActiveAt:        lastActive,
    totalEvents,
    totalSessions:       sessions.length,
    totalSessionMinutes: Math.round(totalMs / 60000),
    logins,
    apps,
    recent,
  };
}
