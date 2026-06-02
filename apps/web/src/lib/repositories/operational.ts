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

// ── Login history (KPI drill-down: Sign-ins today) ───────────────────────────
export interface LoginRow {
  occurredAt:  string;
  kind:        'login' | 'logout' | 'failed' | 'signup';
  portalId:    string;
  userId:      string | null;
  email:       string | null;
  displayName: string | null;
  browser:     string | null;
  os:          string | null;
  deviceType:  string | null;
}

const AUTH_NAMES = ['auth.login', 'auth.logout', 'auth.login_failed', 'auth.signup'];

function loginKind(name: string): LoginRow['kind'] {
  if (name === 'auth.logout') return 'logout';
  if (name === 'auth.login_failed') return 'failed';
  if (name === 'auth.signup') return 'signup';
  return 'login';
}

/** Login/logout/failure history with device context, newest first. */
export async function getLoginHistory(opts: { appId?: string; days?: number; limit?: number } = {}): Promise<LoginRow[]> {
  const { appId, days = 7, limit = 100 } = opts;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  let q = getSupabaseAdmin()
    .from('analytics_events')
    .select('occurred_at, name, portal_id, user_id, metadata')
    .in('name', AUTH_NAMES)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (appId) q = q.eq('portal_id', appId);
  const { data, error } = await q;
  if (error) throw new AppError('LOGIN_HISTORY_FAILED', error.message, 500);

  const rows = (data ?? []) as Record<string, unknown>[];
  // Enrich with user identity in one batch.
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const userMap = new Map<string, { email: string | null; display_name: string | null }>();
  if (ids.length) {
    const { data: users } = await getSupabaseAdmin()
      .from('analytics_users').select('id, email, display_name').in('id', ids);
    (users ?? []).forEach((u: Record<string, unknown>) =>
      userMap.set(String(u.id), { email: (u.email as string | null) ?? null, display_name: (u.display_name as string | null) ?? null }));
  }

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const u = r.user_id ? userMap.get(String(r.user_id)) : undefined;
    return {
      occurredAt:  String(r.occurred_at),
      kind:        loginKind(String(r.name)),
      portalId:    String(r.portal_id),
      userId:      (r.user_id as string | null) ?? null,
      email:       u?.email ?? null,
      displayName: u?.display_name ?? null,
      browser:     (meta.browser as string | null) ?? null,
      os:          (meta.os as string | null) ?? null,
      deviceType:  (meta.deviceType as string | null) ?? null,
    };
  });
}

// ── Session list (KPI drill-down: Work sessions today) ───────────────────────
export interface SessionRow {
  sessionId:    string;
  userId:       string | null;
  email:        string | null;
  displayName:  string | null;
  portalId:     string;
  startedAt:    string;
  lastSeenAt:   string;
  endedAt:      string | null;
  durationMin:  number;
  eventCount:   number;
}

/** Recent sessions with computed duration, newest first. */
export async function getSessionList(opts: { appId?: string; days?: number; limit?: number } = {}): Promise<SessionRow[]> {
  const { appId, days = 7, limit = 100 } = opts;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  let q = getSupabaseAdmin()
    .from('analytics_sessions')
    .select('id, user_id, portal_id, started_at, last_seen_at, ended_at, event_count')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (appId) q = q.eq('portal_id', appId);
  const { data, error } = await q;
  if (error) throw new AppError('SESSION_LIST_FAILED', error.message, 500);

  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const userMap = new Map<string, { email: string | null; display_name: string | null }>();
  if (ids.length) {
    const { data: users } = await getSupabaseAdmin()
      .from('analytics_users').select('id, email, display_name').in('id', ids);
    (users ?? []).forEach((u: Record<string, unknown>) =>
      userMap.set(String(u.id), { email: (u.email as string | null) ?? null, display_name: (u.display_name as string | null) ?? null }));
  }

  return rows.map((r) => {
    const start = new Date(String(r.started_at)).getTime();
    const end = new Date(String(r.ended_at ?? r.last_seen_at)).getTime();
    const u = r.user_id ? userMap.get(String(r.user_id)) : undefined;
    return {
      sessionId:   String(r.id),
      userId:      (r.user_id as string | null) ?? null,
      email:       u?.email ?? null,
      displayName: u?.display_name ?? null,
      portalId:    String(r.portal_id),
      startedAt:   String(r.started_at),
      lastSeenAt:  String(r.last_seen_at),
      endedAt:     (r.ended_at as string | null) ?? null,
      durationMin: end > start ? Math.round((end - start) / 60000) : 0,
      eventCount:  n(r.event_count),
    };
  });
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

// ── Department analytics ─────────────────────────────────────────────────────
export interface DepartmentRollupRow {
  department:    string;
  team:          string;
  totalUsers:    number;
  activeUsers:   number;
  inactiveUsers: number;
  invitedUsers:  number;
  internalUsers: number;
}

/** Org composition by department/team (headcount + status). View from 0020. */
export async function getDepartmentRollup(): Promise<DepartmentRollupRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_org_directory_rollup')
    .select('*');
  if (error) throw new AppError('DEPT_ROLLUP_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    department:    String(r.department ?? 'Unassigned'),
    team:          String(r.team ?? 'Unassigned'),
    totalUsers:    n(r.total_users),
    activeUsers:   n(r.active_users),
    inactiveUsers: n(r.inactive_users),
    invitedUsers:  n(r.invited_users),
    internalUsers: n(r.internal_users),
  }));
}

export interface DepartmentActivityRow {
  department: string;
  events:     number;
  users:      number;
  sessions:   number;
  errors:     number;
}

/**
 * Activity totals per department over the last `days`, from mv_department_daily
 * (migration 0029). Aggregated in SQL-friendly fashion then summed per dept.
 */
export async function getDepartmentActivity(days = 30): Promise<DepartmentActivityRow[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await getSupabaseAdmin()
    .from('mv_department_daily')
    .select('department, events, users, sessions, errors, day')
    .gte('day', since);
  if (error) throw new AppError('DEPT_ACTIVITY_FAILED', error.message, 500);

  // Sum the daily rows per department (distinct-user counts are approximate
  // across days, which is acceptable for a relative department comparison).
  const acc = new Map<string, DepartmentActivityRow>();
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const dept = String(raw.department ?? 'Unassigned');
    const cur = acc.get(dept) ?? { department: dept, events: 0, users: 0, sessions: 0, errors: 0 };
    cur.events   += n(raw.events);
    cur.users    += n(raw.users);
    cur.sessions += n(raw.sessions);
    cur.errors   += n(raw.errors);
    acc.set(dept, cur);
  }
  return Array.from(acc.values()).sort((a, b) => b.events - a.events);
}
