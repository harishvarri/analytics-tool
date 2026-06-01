import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Access vs Usage — the "who has access vs who actually uses it" intelligence.
 * Reads views shipped in migration 0020 (analytics_user_access + events).
 */

const n = (v: unknown): number => Number(v ?? 0);

export interface AccessVsUsageRow {
  projectSlug:     string;
  projectName:     string;
  usersWithAccess: number;
  adoptedUsers:    number;
  accessNeverUsed: number;
  adoptionPct:     number;
}

/**
 * Per-project adoption of access over the last `days`. Uses the parameterised
 * SQL function `project_access_vs_usage(p_days)` so the dashboard date picker
 * can vary the window.
 */
export async function getAccessVsUsage(days = 30): Promise<AccessVsUsageRow[]> {
  const { data, error } = await getSupabaseAdmin().rpc('project_access_vs_usage', { p_days: days });
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

export interface InactiveWithAccessRow {
  userId:             string;
  email:              string | null;
  displayName:        string | null;
  department:         string | null;
  team:               string | null;
  status:             string | null;
  projectsWithAccess: number;
  lastActiveAt:       string | null;
  daysInactive:       number | null;
}

/** Users who have access to at least one project but have gone quiet (≥30d). */
export async function getInactiveWithAccess(limit = 100): Promise<InactiveWithAccessRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_inactive_users')
    .select('*')
    .limit(limit);
  if (error) throw new AppError('INACTIVE_USERS_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId:             String(r.user_id),
    email:              (r.email as string | null) ?? null,
    displayName:        (r.display_name as string | null) ?? null,
    department:         (r.department as string | null) ?? null,
    team:               (r.team as string | null) ?? null,
    status:             (r.status as string | null) ?? null,
    projectsWithAccess: n(r.projects_with_access),
    lastActiveAt:       (r.last_active_at as string | null) ?? null,
    daysInactive:       r.days_inactive == null ? null : n(r.days_inactive),
  }));
}
