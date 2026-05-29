import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Operational-Intelligence read layer (migration 0020 views): people, access,
 * and the command-center org snapshot. Generic activity only (no business KPIs).
 */

export interface CommandCenter {
  activeUsersToday:     number;
  sessionsToday:        number;
  eventsToday:          number;
  errorsToday:          number;
  mostUsedProject:      string | null;
  leastAdoptedProject:  string | null;
  totalDirectoryUsers:  number;
  inactiveUsersCount:   number;
  neverUsedAccessCount: number;
}

export interface ProjectAccessUsage {
  projectSlug:     string;
  projectName:     string;
  usersWithAccess: number;
  adoptedUsers:    number;
  accessNeverUsed: number;
  adoptionPct:     number;
}

export interface UserProfileSummary {
  userId:       string;
  email:        string | null;
  displayName:  string | null;
  department:   string | null;
  team:         string | null;
  status:       string;
  appsUsed:     number;
  totalEvents:  number;
  totalSessions: number;
  firstSeenAt:  string | null;
  lastActiveAt: string | null;
}

export interface InactiveUser {
  userId:             string;
  email:              string | null;
  displayName:        string | null;
  department:         string | null;
  team:               string | null;
  status:             string;
  projectsWithAccess: number;
  lastActiveAt:       string | null;
  daysInactive:       number | null;
}

export interface OrgRollupRow {
  department:    string;
  team:          string;
  totalUsers:    number;
  activeUsers:   number;
  inactiveUsers: number;
  invitedUsers:  number;
  internalUsers: number;
}

const n = (v: unknown): number => Number(v ?? 0);

export async function getCommandCenter(): Promise<CommandCenter> {
  const { data, error } = await getSupabaseAdmin().from('v_command_center').select('*').maybeSingle();
  if (error) throw new AppError('COMMAND_CENTER_FAILED', error.message, 500);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    activeUsersToday:     n(r.active_users_today),
    sessionsToday:        n(r.sessions_today),
    eventsToday:          n(r.events_today),
    errorsToday:          n(r.errors_today),
    mostUsedProject:      (r.most_used_project as string | null) ?? null,
    leastAdoptedProject:  (r.least_adopted_project as string | null) ?? null,
    totalDirectoryUsers:  n(r.total_directory_users),
    inactiveUsersCount:   n(r.inactive_users_count),
    neverUsedAccessCount: n(r.never_used_access_count),
  };
}

export async function getProjectAccessVsUsage(): Promise<ProjectAccessUsage[]> {
  const { data, error } = await getSupabaseAdmin().from('v_project_access_vs_usage').select('*');
  if (error) throw new AppError('ACCESS_USAGE_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    projectSlug:     String(r.project_slug),
    projectName:     String(r.project_name ?? r.project_slug),
    usersWithAccess: n(r.users_with_access),
    adoptedUsers:    n(r.adopted_users),
    accessNeverUsed: n(r.access_never_used),
    adoptionPct:     n(r.adoption_pct),
  }));
}

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

/**
 * Identified users active in ONE app (per-project people view). Works without
 * the central directory — driven by each app identifying its own users on login.
 */
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
  recent:              { name: string; category: string; portalId: string; occurredAt: string }[];
}

/**
 * Full activity profile for ONE user — the per-person monitoring view: identity,
 * apps used, sessions + time, login count, and a recent login→logout→activity
 * timeline. Works per-app from each app's identified events (no SSO required).
 */
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
      .select('name, category, portal_id, occurred_at')
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

export async function getInactiveUsers(limit = 100): Promise<InactiveUser[]> {
  const { data, error } = await getSupabaseAdmin().from('v_inactive_users').select('*').limit(limit);
  if (error) throw new AppError('INACTIVE_USERS_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId:             String(r.user_id),
    email:              (r.email as string | null) ?? null,
    displayName:        (r.display_name as string | null) ?? null,
    department:         (r.department as string | null) ?? null,
    team:               (r.team as string | null) ?? null,
    status:             String(r.status ?? 'active'),
    projectsWithAccess: n(r.projects_with_access),
    lastActiveAt:       (r.last_active_at as string | null) ?? null,
    daysInactive:       r.days_inactive === null || r.days_inactive === undefined ? null : n(r.days_inactive),
  }));
}

export async function getOrgDirectoryRollup(): Promise<OrgRollupRow[]> {
  const { data, error } = await getSupabaseAdmin().from('v_org_directory_rollup').select('*');
  if (error) throw new AppError('ORG_ROLLUP_FAILED', error.message, 500);
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
