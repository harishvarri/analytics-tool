import 'server-only';
import { cache } from 'react';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import { getProjectHealth, type HealthTier } from './health';
import { getAccessVsUsage } from './access';
import { getProjectComparison } from './crossProject';
import type { RealtimeActivityItem, EventCategory } from '@/types/analytics';

/**
 * Project Intelligence — the single, REGISTRY-DRIVEN source of truth for the
 * Products section. Starts from analytics_projects (every registered app,
 * authoritative) and LEFT-JOINs the live operational signals + health/adoption
 * views. This fixes the "Products Connected" undercount: a registered app with
 * zero recent events still appears (with zeros), because we no longer derive the
 * product list from the event stream.
 */

const n = (v: unknown): number => Number(v ?? 0);

/**
 * Deterministic short ID — same algorithm used in incidents.ts.
 * Lets us check whether a project's auto-generated incident has been
 * acknowledged (resolved / closed) without importing from incidents.ts
 * (which would create a circular dependency).
 */
function incidentKey(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `INC-${h.toString(36).toUpperCase().slice(0, 6).padStart(6, '0')}`;
}
const ERROR_CATS = ['database', 'authentication', 'api', 'authorization', 'network', 'frontend'] as const;

export type ProjectStatus = 'healthy' | 'warning' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ProjectIntelligence {
  slug:            string;
  name:            string;
  description:     string | null;
  projectType:     string;
  environment:     string;
  teamOwner:       string | null;
  createdAt:       string;
  trackingEnabled: boolean;

  // Live operational signals (v_project_last_activity)
  lastActivityAt:  string | null;
  activeUsers7d:   number;
  activeUsersToday: number;
  sessions7d:      number;
  failedLogins7d:  number;
  businessEvents7d: number;
  daysSinceActivity: number | null;

  // Comparison (30d)
  activeUsers30d:  number;
  errors30d:       number;
  errorRatePct:    number;

  // Adoption (access vs usage)
  adoptionPct:     number;
  usersWithAccess: number;

  // Health (v_project_health_generic)
  healthScore:     number;
  healthTier:      HealthTier;
  reliabilityNorm: number;
  performanceNorm: number;
  adoptionNorm:    number;
  activityNorm:    number;
  p95LoadMs:       number | null;

  // Derived operational intelligence
  status:          ProjectStatus;
  riskLevel:       RiskLevel;
  issues:          string[];        // actionable problems (steady-state)
  alerts:          string[];        // urgent, time-sensitive
  healthReasons:   string[];        // plain-English: WHY the health score is what it is
  topHealthDriver: string | null;   // the single biggest drag on the score
  adoptionMeasured: boolean;        // false when no access grants are synced
  operationalScore: number;         // 0–100 blend used for ranking
  incidentsAcknowledged: boolean;   // true when ANY auto-detected incident for this project is resolved/closed
  errorsAcknowledged: boolean;      // an error-category incident (auth/frontend/api/…) is resolved/closed
  statusAcknowledged: boolean;      // the project-status (inactivity) incident is resolved/closed
}

function tierToStatus(tier: HealthTier): ProjectStatus {
  if (tier === 'healthy') return 'healthy';
  if (tier === 'critical') return 'critical';
  return 'warning';
}

// Wrapped in React cache() so repeated calls within a single request render
// (e.g. a page that reads both getPlatformHealth and getProjectIntelligence, or
// getOrganizationHealth which composes it) execute the 5-query fan-out ONCE.
export const getProjectIntelligence = cache(async (): Promise<ProjectIntelligence[]> => {
  const admin = getSupabaseAdmin();

  const [projectsRes, activityRes, health, access, comparison, incStatusRes] = await Promise.all([
    admin
      .from('analytics_projects')
      .select('slug, name, description, project_type, environment, team_owner, tracking_enabled, created_at')
      .eq('tracking_enabled', true),
    admin.from('v_project_last_activity').select('*'),
    getProjectHealth(),
    getAccessVsUsage(30),
    getProjectComparison(),
    // Defensive — returns empty if migration 0036 not yet applied.
    admin.from('incident_status').select('incident_key, status').then(
      (r) => r,
      () => ({ data: [] as Record<string, unknown>[], error: null }),
    ),
  ]);

  if (projectsRes.error) throw new AppError('PROJECT_REGISTRY_FAILED', projectsRes.error.message, 500);

  // Build a set of incident keys that are resolved or closed.
  const closedIncidentKeys = new Set<string>(
    ((incStatusRes.data ?? []) as Record<string, unknown>[])
      .filter((r) => r.status === 'resolved' || r.status === 'closed')
      .map((r) => String(r.incident_key)),
  );

  const activityBySlug = new Map<string, Record<string, unknown>>();
  for (const a of (activityRes.data ?? []) as Record<string, unknown>[]) {
    activityBySlug.set(String(a.project_slug), a);
  }
  const healthBySlug = new Map(health.map((h) => [h.projectSlug, h]));
  const accessBySlug = new Map(access.map((a) => [a.projectSlug, a]));
  const cmpBySlug = new Map(comparison.map((c) => [c.portalId, c]));

  const now = Date.now();

  const rows: ProjectIntelligence[] = ((projectsRes.data ?? []) as Record<string, unknown>[]).map((p) => {
    const slug = String(p.slug);
    const act = activityBySlug.get(slug);
    const h = healthBySlug.get(slug);
    const ac = accessBySlug.get(slug);
    const c = cmpBySlug.get(slug);

    // True when the team has acknowledged all auto-detected incidents for this
    // project (all are Resolved or Closed). Error-rate alerts + risk elevation
    // are suppressed while this is true so the health page reflects intent, not
    // just raw signals.
    const errorsAcknowledged = ERROR_CATS.some((cat) => closedIncidentKeys.has(incidentKey(`${slug}|${cat}`)));
    const statusAcknowledged = closedIncidentKeys.has(incidentKey(`${slug}|status`));
    const incidentsAcknowledged = errorsAcknowledged || statusAcknowledged;

    const lastActivityAt = (act?.last_activity_at as string | null) ?? null;
    const daysSinceActivity = lastActivityAt
      ? Math.floor((now - new Date(lastActivityAt).getTime()) / 86400_000)
      : null;

    const activeUsers7d = n(act?.active_users_7d);
    const sessions7d = n(act?.sessions_7d);
    const failedLogins7d = n(act?.failed_logins_7d);
    const businessEvents7d = n(act?.business_events_7d);
    const errorRatePct = c?.errorRatePct ?? 0;
    const adoptionPct = ac?.adoptionPct ?? 0;
    const usersWithAccess = ac?.usersWithAccess ?? 0;

    const healthScore = h?.ghiScore ?? 50;
    const healthTier: HealthTier = h?.healthTier ?? 'at_risk';
    const usageNorm = h?.adoptionNorm ?? 40;        // now engagement/usage (0035), not access adoption
    const reliabilityNorm = h?.reliabilityNorm ?? 100;
    const performanceNorm = h?.performanceNorm ?? 50;
    const activityNorm = h?.activityNorm ?? 50;
    // Usage/engagement is always measurable from real activity (no access grants).
    const adoptionMeasured = (lastActivityAt !== null);

    // ── Explain the health score (always — so a Warning product never says
    //    "no issues"). Blend (0035): 30% reliability / 25% performance /
    //    25% momentum / 20% usage. We surface whichever are below target. ──────
    const healthReasons: string[] = [];
    const drivers: { label: string; norm: number; weight: number; reason: string }[] = [];

    if (usageNorm < 70) {
      healthReasons.push(`Usage ${usageNorm}/100 — ${activeUsers7d} active ${activeUsers7d === 1 ? 'user' : 'users'} in the last 7 days. More active staff lifts this.`);
      drivers.push({ label: 'usage', norm: usageNorm, weight: 0.20, reason: `low usage (${activeUsers7d} active/7d)` });
    }
    if (reliabilityNorm < 90) {
      healthReasons.push(
        errorsAcknowledged
          ? `Reliability ${reliabilityNorm}/100 — ${errorRatePct}% error rate (${c?.errors30d ?? 0} errors/30d). Incident acknowledged.`
          : `Reliability ${reliabilityNorm}/100 — ${errorRatePct}% error rate (${c?.errors30d ?? 0} errors in 30 days).`,
      );
      // Only count reliability as a health driver when errors are not yet acknowledged.
      if (!errorsAcknowledged) {
        drivers.push({ label: 'reliability', norm: reliabilityNorm, weight: 0.30, reason: `${errorRatePct}% error rate` });
      }
    }
    if (performanceNorm < 70) {
      healthReasons.push(h?.p95LoadMs != null
        ? `Performance ${performanceNorm}/100 — p95 page load is ${h.p95LoadMs}ms.`
        : `Performance ${performanceNorm}/100 — limited performance data.`);
      drivers.push({ label: 'performance', norm: performanceNorm, weight: 0.25, reason: 'slow performance' });
    }
    if (activityNorm < 70) {
      healthReasons.push(`Momentum ${activityNorm}/100 — recent activity is flat or below the prior period.`);
      drivers.push({ label: 'momentum', norm: activityNorm, weight: 0.25, reason: 'low momentum' });
    }
    if (daysSinceActivity !== null && daysSinceActivity >= 7) {
      healthReasons.push(`No activity for ${daysSinceActivity} days.`);
    }
    if (failedLogins7d >= 5) {
      healthReasons.push(`${failedLogins7d} failed logins this week.`);
    }

    // The single biggest drag = the component losing the most weighted points
    // ( (100 − norm) × weight ), highest first.
    drivers.sort((a, b) => ((100 - b.norm) * b.weight) - ((100 - a.norm) * a.weight));
    const topHealthDriver = drivers[0]?.reason ?? null;

    // ── Actionable issues (real problems worth a manager's time) ───────────────
    const issues: string[] = [];
    if (daysSinceActivity === null || daysSinceActivity >= 7) issues.push('No recent activity');
    if (usageNorm < 40) issues.push(`Low usage (${activeUsers7d} active/7d)`);
    // Only surface error-rate as an issue when the incident hasn't been acknowledged.
    if (errorRatePct >= 2 && !errorsAcknowledged) issues.push(`High error rate (${errorRatePct}%)`);
    if (performanceNorm < 50) issues.push('Slow performance');
    if (failedLogins7d >= 5) issues.push(`${failedLogins7d} failed logins`);

    // ── Alerts (urgent, time-sensitive) ───────────────────────────────────────
    const alerts: string[] = [];
    // Suppress activity-based alert if the project-status incident is acknowledged.
    if (daysSinceActivity !== null && daysSinceActivity >= 7 && !statusAcknowledged) {
      alerts.push(`Not used in ${daysSinceActivity} days`);
    }
    // Suppress error-rate alert when the error incident is acknowledged.
    if (errorRatePct >= 5 && !errorsAcknowledged) alerts.push('Error rate critical');
    if (failedLogins7d >= 10) alerts.push('Login failures spiking');

    // ── Status + risk ─────────────────────────────────────────────────────────
    let status = tierToStatus(healthTier);
    // Only force 'critical' from inactivity when the project-status incident is open.
    if ((daysSinceActivity === null || daysSinceActivity >= 14) && !statusAcknowledged) status = 'critical';
    else if (daysSinceActivity !== null && daysSinceActivity >= 7 && status === 'healthy' && !statusAcknowledged) status = 'warning';

    let riskLevel: RiskLevel = 'low';
    // Error rate only elevates risk when the incident isn't acknowledged.
    if (status === 'critical' || (errorRatePct >= 5 && !errorsAcknowledged) || alerts.length > 0) riskLevel = 'high';
    else if (status === 'warning' || issues.length > 0) riskLevel = 'medium';

    // Operational score = activity-weighted blend (for ranking), 0–100.
    const operationalScore = Math.round(
      0.5 * activityNorm + 0.3 * Math.min(100, activeUsers7d * 10) + 0.2 * usageNorm,
    );

    return {
      slug,
      name:            String(p.name ?? slug),
      description:     (p.description as string | null) ?? null,
      projectType:     String(p.project_type ?? 'web'),
      environment:     String(p.environment ?? 'production'),
      teamOwner:       (p.team_owner as string | null) ?? null,
      createdAt:       String(p.created_at ?? ''),
      trackingEnabled: Boolean(p.tracking_enabled),

      lastActivityAt,
      activeUsers7d,
      activeUsersToday: n(act?.active_users_today),
      sessions7d,
      failedLogins7d,
      businessEvents7d,
      daysSinceActivity,

      activeUsers30d:  c?.users30d ?? 0,
      errors30d:       c?.errors30d ?? 0,
      errorRatePct,

      adoptionPct,
      usersWithAccess,

      healthScore,
      healthTier,
      reliabilityNorm,
      performanceNorm,
      adoptionNorm:    usageNorm,
      activityNorm,
      p95LoadMs:       h?.p95LoadMs ?? null,

      status,
      riskLevel,
      issues,
      alerts,
      healthReasons,
      topHealthDriver,
      adoptionMeasured,
      operationalScore,
      incidentsAcknowledged,
      errorsAcknowledged,
      statusAcknowledged,
    };
  });

  // Worst health first so problems surface at the top.
  return rows.sort((a, b) => a.healthScore - b.healthScore);
});

/** Single project by slug (for the Project Intelligence detail page). */
export async function getProjectIntelligenceBySlug(slug: string): Promise<ProjectIntelligence | null> {
  const all = await getProjectIntelligence();
  return all.find((p) => p.slug === slug) ?? null;
}

/**
 * Recent events for one project, newest first, with user identity enriched.
 * Returned in the RealtimeActivityItem shape so the page can reuse the feed's
 * operational filter + aggregation.
 */
export async function getProjectRecentActivity(
  slug: string,
  limit = 150,
): Promise<RealtimeActivityItem[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('analytics_events')
    .select('id, portal_id, category, name, user_id, session_id, url, metadata, occurred_at')
    .eq('portal_id', slug)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw new AppError('PROJECT_ACTIVITY_FAILED', error.message, 500);

  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const userMap = new Map<string, { email: string | null; display_name: string | null }>();
  if (ids.length) {
    const { data: users } = await admin.from('analytics_users').select('id, email, display_name').in('id', ids);
    (users ?? []).forEach((u: Record<string, unknown>) =>
      userMap.set(String(u.id), { email: (u.email as string | null) ?? null, display_name: (u.display_name as string | null) ?? null }));
  }

  return rows.map((r) => {
    const u = r.user_id ? userMap.get(String(r.user_id)) : undefined;
    return {
      id: String(r.id),
      portalId: String(r.portal_id),
      portalName: slug,
      category: r.category as EventCategory,
      eventName: String(r.name),
      userId: (r.user_id as string | null) ?? null,
      userEmail: u?.email ?? null,
      userDisplayName: u?.display_name ?? null,
      sessionId: (r.session_id as string | null) ?? null,
      url: (r.url as string | null) ?? null,
      occurredAt: String(r.occurred_at),
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    };
  });
}

/** Platform-wide health summary (overall score + tier breakdown). */
export interface PlatformHealth {
  overallScore: number;
  healthy: number;
  warning: number;
  critical: number;
  totalProjects: number;
  critical_projects: Array<{ slug: string; name: string; healthScore: number; problem: string; affectedUsers: number }>;
}

export const getPlatformHealth = cache(async (): Promise<PlatformHealth> => {
  const projects = await getProjectIntelligence();
  const total = projects.length;
  const overallScore = total ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / total) : 0;
  return {
    overallScore,
    healthy:  projects.filter((p) => p.status === 'healthy').length,
    warning:  projects.filter((p) => p.status === 'warning').length,
    critical: projects.filter((p) => p.status === 'critical').length,
    totalProjects: total,
    critical_projects: projects
      .filter((p) => p.status === 'critical' || p.status === 'warning')
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        healthScore: p.healthScore,
        problem: p.alerts[0] ?? p.issues[0] ?? p.topHealthDriver ?? p.healthReasons[0] ?? 'Below health target',
        affectedUsers: p.activeUsers7d,
      })),
  };
});
