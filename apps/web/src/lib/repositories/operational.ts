import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import { isOperationalEvent } from '../importance';
import type { DirectoryUser } from '../schemas/directory';
import type { RealtimeActivityItem, EventCategory } from '@/types/analytics';

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
      .limit(500), // enough history to power the Today/Week/Month activity filters
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

// ── Per-user activity window (page-level period filter) ──────────────────────
export type ActivityRange = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export interface UserActivityWindow {
  range:           ActivityRange;
  events:          number;   // total events in the period (exact count)
  businessActions: number;   // operational events in the period
  errors:          number;
  logins:          number;
  productsUsed:    number;
  activeDays:      number;
  sessions:        number;   // sessions started in the period
  activeMinutes:   number;   // total active time of those sessions
  avgSessionMin:   number;
  apps:            { slug: string; events: number }[];
  topActions:      { label: string; count: number }[];
  timeline:        { name: string; category: string; portalId: string; occurredAt: string; url: string | null; metadata: Record<string, unknown> | null }[];
}

const MS_DAY = 86_400_000;

function windowBounds(range: ActivityRange): { since: string | null; upto: string | null } {
  const now = Date.now();
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  switch (range) {
    case 'today':     return { since: new Date(startToday).toISOString(), upto: null };
    case 'yesterday': return { since: new Date(startToday - MS_DAY).toISOString(), upto: new Date(startToday).toISOString() };
    case 'week':      return { since: new Date(now - 7 * MS_DAY).toISOString(), upto: null };
    case 'month':     return { since: new Date(now - 30 * MS_DAY).toISOString(), upto: null };
    case 'all':       return { since: null, upto: null };
  }
}

export async function getUserActivityWindow(userId: string, range: ActivityRange): Promise<UserActivityWindow> {
  const admin = getSupabaseAdmin();
  const { since, upto } = windowBounds(range);

  // Exact event count (accurate even when row fetch is capped).
  let countQ = admin.from('analytics_events').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (since) countQ = countQ.gte('occurred_at', since);
  if (upto) countQ = countQ.lt('occurred_at', upto);

  // Rows for aggregation + timeline.
  let rowsQ = admin
    .from('analytics_events')
    .select('name, category, portal_id, occurred_at, url, metadata')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(5000);
  if (since) rowsQ = rowsQ.gte('occurred_at', since);
  if (upto) rowsQ = rowsQ.lt('occurred_at', upto);

  // Sessions started within the period.
  let sessQ = admin.from('analytics_sessions').select('started_at, last_seen_at, ended_at').eq('user_id', userId).limit(2000);
  if (since) sessQ = sessQ.gte('started_at', since);
  if (upto) sessQ = sessQ.lt('started_at', upto);

  const [{ count, error: countErr }, { data: rowData, error: rowErr }, { data: sessData }] = await Promise.all([countQ, rowsQ, sessQ]);
  if (countErr) throw new AppError('USER_WINDOW_FAILED', countErr.message, 500);
  if (rowErr) throw new AppError('USER_WINDOW_FAILED', rowErr.message, 500);

  const rows = (rowData ?? []) as Record<string, unknown>[];

  const productSet = new Set<string>();
  const daySet = new Set<string>();
  const appCount = new Map<string, number>();
  const nameCount = new Map<string, number>();
  let businessActions = 0, errors = 0, logins = 0;
  const timeline: UserActivityWindow['timeline'] = [];

  for (const r of rows) {
    const nameStr = String(r.name);
    const cat = String(r.category);
    const slug = String(r.portal_id);
    const occ = String(r.occurred_at);
    const meta = (r.metadata as Record<string, unknown> | null) ?? null;
    const url = (r.url as string | null) ?? null;

    productSet.add(slug);
    daySet.add(occ.slice(0, 10));
    appCount.set(slug, (appCount.get(slug) ?? 0) + 1);
    if (cat === 'error') errors += 1;
    if (nameStr === 'auth.login') logins += 1;
    if (isOperationalEvent(cat, nameStr)) {
      businessActions += 1;
      nameCount.set(nameStr, (nameCount.get(nameStr) ?? 0) + 1);
      if (timeline.length < 60) timeline.push({ name: nameStr, category: cat, portalId: slug, occurredAt: occ, url, metadata: meta });
    }
  }

  const sessions = (sessData ?? []) as { started_at: string; last_seen_at: string; ended_at: string | null }[];
  let totalMs = 0;
  for (const s of sessions) {
    const start = new Date(s.started_at).getTime();
    const end = new Date(s.ended_at ?? s.last_seen_at).getTime();
    if (end > start) totalMs += end - start;
  }
  const activeMinutes = Math.round(totalMs / 60000);

  const apps = [...appCount.entries()].map(([slug, events]) => ({ slug, events })).sort((a, b) => b.events - a.events);

  return {
    range,
    events: count ?? rows.length,
    businessActions,
    errors,
    logins,
    productsUsed: productSet.size,
    activeDays: daySet.size,
    sessions: sessions.length,
    activeMinutes,
    avgSessionMin: sessions.length ? Math.round(activeMinutes / sessions.length) : 0,
    apps,
    topActions: [...nameCount.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    timeline,
  };
}

// ── Department Intelligence (detail page) ────────────────────────────────────
export interface DepartmentStaff {
  userId: string;
  name: string;
  email: string | null;
  lastActiveAt: string | null;
  events: number;
  sessions: number;
}
export interface DepartmentDetail {
  department: string;
  staffCount: number;
  activeUsers7d: number;
  totalEvents: number;
  totalSessions: number;
  staff: DepartmentStaff[];
  topApps: { slug: string; events: number; users: number }[];
  activities: { name: string; count: number }[];          // business actions only
  timeline: RealtimeActivityItem[]; // operational events, enriched
  health: { activityScore: number; adoptionScore: number; engagementScore: number; riskScore: number };
}

export async function getDepartmentDetail(dept: string, days = 30): Promise<DepartmentDetail | null> {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Staff in this department.
  const { data: users, error: usersErr } = await admin
    .from('analytics_users')
    .select('id, email, display_name, last_seen_at')
    .eq('department', dept);
  if (usersErr) throw new AppError('DEPT_DETAIL_FAILED', usersErr.message, 500);
  const userRows = (users ?? []) as Record<string, unknown>[];
  if (userRows.length === 0) {
    return {
      department: dept, staffCount: 0, activeUsers7d: 0, totalEvents: 0, totalSessions: 0,
      staff: [], topApps: [], activities: [], timeline: [],
      health: { activityScore: 0, adoptionScore: 0, engagementScore: 0, riskScore: 100 },
    };
  }
  const ids = userRows.map((u) => String(u.id));
  const nameById = new Map(userRows.map((u) => [String(u.id), {
    name: (u.display_name as string | null) ?? (u.email as string | null) ?? String(u.id).slice(0, 8),
    email: (u.email as string | null) ?? null,
  }]));

  // Recent events for these users.
  const { data: evs, error: evErr } = await admin
    .from('analytics_events')
    .select('portal_id, name, category, user_id, session_id, url, metadata, occurred_at')
    .in('user_id', ids)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(2000);
  if (evErr) throw new AppError('DEPT_DETAIL_FAILED', evErr.message, 500);
  const events = (evs ?? []) as Record<string, unknown>[];

  // Aggregate per-user, per-app, per-activity.
  const perUser = new Map<string, { events: number; sessions: Set<string>; last: string | null }>();
  const perApp = new Map<string, { events: number; users: Set<string> }>();
  const perActivity = new Map<string, number>();
  const sessionsAll = new Set<string>();
  const active7d = new Set<string>();
  const sevenAgo = Date.now() - 7 * 86400_000;

  const isOp = (cat: string, name: string) => {
    const n = (name || '').toLowerCase();
    if (cat === 'error') return true;
    if (n.startsWith('auth.')) return true;
    return !(cat === 'navigation' || cat === 'interaction' || n.startsWith('performance.'));
  };

  for (const e of events) {
    const uid = String(e.user_id);
    const cat = String(e.category);
    const name = String(e.name);
    const sid = e.session_id ? String(e.session_id) : null;
    const pu = perUser.get(uid) ?? { events: 0, sessions: new Set<string>(), last: null };
    pu.events += 1;
    if (sid) pu.sessions.add(sid);
    if (!pu.last || String(e.occurred_at) > pu.last) pu.last = String(e.occurred_at);
    perUser.set(uid, pu);
    if (sid) sessionsAll.add(sid);
    if (new Date(String(e.occurred_at)).getTime() >= sevenAgo) active7d.add(uid);
    const pa = perApp.get(String(e.portal_id)) ?? { events: 0, users: new Set<string>() };
    pa.events += 1; pa.users.add(uid); perApp.set(String(e.portal_id), pa);
    if (isOp(cat, name)) perActivity.set(name, (perActivity.get(name) ?? 0) + 1);
  }

  const staff: DepartmentStaff[] = userRows.map((u) => {
    const id = String(u.id);
    const pu = perUser.get(id);
    return {
      userId: id,
      name: nameById.get(id)!.name,
      email: nameById.get(id)!.email,
      lastActiveAt: pu?.last ?? (u.last_seen_at as string | null) ?? null,
      events: pu?.events ?? 0,
      sessions: pu?.sessions.size ?? 0,
    };
  }).sort((a, b) => b.events - a.events);

  const topApps = Array.from(perApp.entries())
    .map(([slug, v]) => ({ slug, events: v.events, users: v.users.size }))
    .sort((a, b) => b.events - a.events).slice(0, 8);

  const activities = Array.from(perActivity.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  // Operational timeline (enriched names).
  const timeline = events
    .filter((e) => isOp(String(e.category), String(e.name)))
    .slice(0, 60)
    .map((e) => {
      const id = String(e.user_id);
      const u = nameById.get(id);
      return {
        id: `${id}-${String(e.occurred_at)}`,
        portalId: String(e.portal_id),
        portalName: String(e.portal_id),
        category: e.category as EventCategory,
        eventName: String(e.name),
        userId: id,
        userEmail: u?.email ?? null,
        userDisplayName: u?.name ?? null,
        sessionId: e.session_id ? String(e.session_id) : null,
        url: (e.url as string | null) ?? null,
        occurredAt: String(e.occurred_at),
        metadata: (e.metadata as Record<string, unknown> | null) ?? null,
      };
    });

  const totalEvents = events.length;
  const staffCount = userRows.length;
  const activeUsers7d = active7d.size;
  // Heuristic 0–100 health scores.
  const activityScore = Math.min(100, Math.round((totalEvents / staffCount) || 0));
  const adoptionScore = Math.round((activeUsers7d / staffCount) * 100);
  const avgSessions = staff.length ? staff.reduce((s, u) => s + u.sessions, 0) / staff.length : 0;
  const engagementScore = Math.min(100, Math.round(avgSessions * 20));
  const inactive = staff.filter((u) => {
    const d = u.lastActiveAt ? (Date.now() - new Date(u.lastActiveAt).getTime()) / 86400_000 : 999;
    return d >= 30;
  }).length;
  const riskScore = Math.round((inactive / staffCount) * 100);

  return {
    department: dept, staffCount, activeUsers7d, totalEvents, totalSessions: sessionsAll.size,
    staff, topApps, activities, timeline,
    health: { activityScore, adoptionScore, engagementScore, riskScore },
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

export async function syncDirectory(users: DirectoryUser[]): Promise<{ synced: number }> {
  const admin = getSupabaseAdmin();
  if (users.length === 0) return { synced: 0 };

  // 1. Bulk upsert users into analytics_users
  const userRows = users.map((u) => ({
    id: u.id,
    email: u.email.toLowerCase(),
    display_name: u.displayName ?? null,
    role: u.role ?? 'member',
    department: u.department ?? null,
    team: u.team ?? null,
    title: u.title ?? null,
    status: u.status ?? 'active',
    is_internal: u.isInternal ?? true,
    source: 'directory',
    last_directory_sync_at: new Date().toISOString(),
  }));

  const { error: userError } = await admin
    .from('analytics_users')
    .upsert(userRows, { onConflict: 'id' });

  if (userError) {
    throw new AppError('DIRECTORY_SYNC_FAILED', `Failed to sync users: ${userError.message}`, 500);
  }

  // 2. Fetch valid projects to filter access grants (prevent FK violation)
  const { data: projects, error: projectsError } = await admin
    .from('analytics_projects')
    .select('slug');
  
  if (projectsError) {
    throw new AppError('DIRECTORY_SYNC_FAILED', `Failed to fetch projects: ${projectsError.message}`, 500);
  }

  const validSlugs = new Set(((projects ?? []) as { slug: string }[]).map((p) => p.slug));

  // 3. Clear old directory access grants for these synced users
  const userIds = users.map((u) => u.id);
  const { error: deleteError } = await admin
    .from('analytics_user_access')
    .delete()
    .in('user_id', userIds)
    .eq('source', 'directory');

  if (deleteError) {
    throw new AppError('DIRECTORY_SYNC_FAILED', `Failed to clear old access grants: ${deleteError.message}`, 500);
  }

  // 4. Build and insert new access grants
  const accessRows: { user_id: string; project_slug: string; source: string }[] = [];
  for (const u of users) {
    if (u.access) {
      for (const slug of u.access) {
        if (validSlugs.has(slug)) {
          accessRows.push({
            user_id: u.id,
            project_slug: slug,
            source: 'directory',
          });
        }
      }
    }
  }

  if (accessRows.length > 0) {
    const { error: accessError } = await admin
      .from('analytics_user_access')
      .upsert(accessRows, { onConflict: 'user_id,project_slug' });

    if (accessError) {
      throw new AppError('DIRECTORY_SYNC_FAILED', `Failed to save access grants: ${accessError.message}`, 500);
    }
  }

  return { synced: users.length };
}
