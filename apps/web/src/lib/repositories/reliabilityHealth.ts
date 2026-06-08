import 'server-only';
import { cache } from 'react';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import { categorize, CATEGORY_LABEL, CRITICAL_CATEGORIES, type ErrorCategory } from './errorIntelligence';
import { getIncidents } from './incidents';

/**
 * ============================================================================
 *  Reliability Health Engine  —  Health = System Reliability & Stability ONLY
 * ============================================================================
 *
 * Per the OI Health redesign, the Health Score answers ONE question:
 *   "Is this product stable and working correctly right now?"
 *
 * It is computed PURELY from reliability signals — it deliberately ignores
 * usage, momentum, adoption, active users, sessions and page-load performance
 * (those live in User / Product / Engagement Intelligence).
 *
 *   Health = 100 − Σ category penalties − incident penalty   (floored at 0)
 *
 * Reliability inputs (last 7 days, by category):
 *   • Frontend        — JS errors, render failures, UI crashes, runtime exceptions
 *   • API             — failed requests, timeouts, 5xx, request failures
 *   • Database        — connection failures, query failures, deadlocks
 *   • Authentication  — login failures, session/token failures, authorization errors
 *   • Incident impact — OPEN + INVESTIGATING incidents (resolved/closed never count)
 *
 * Every score explains itself: a per-category point breakdown, the user/session
 * impact, the responsible incidents, a week-over-week trend, and a root cause.
 */

// ── Tunable scoring model (single source of truth) ──────────────────────────
// Penalty per category = min(cap, ceil(errorCount × weight)). Critical infra/
// security categories cost more per error and are allowed to do more damage.
const SEVERITY_WEIGHT: Record<ErrorCategory, number> = {
  database:       2.5,
  api:            2.0,
  authentication: 1.7,
  authorization:  1.3,
  network:        1.3,
  frontend:       1.0,
};
const CATEGORY_CAP: Record<ErrorCategory, number> = {
  database:       30,
  api:            30,
  authentication: 25,
  authorization:  15,
  network:        15,
  frontend:       20,
};
// Open/investigating incidents add a bounded penalty on top of raw errors.
const INCIDENT_PENALTY = { openCritical: 8, investigatingCritical: 5, openOther: 4, investigatingOther: 2 };
const INCIDENT_PENALTY_CAP = 25;

// ── Status thresholds (reliability-based) ───────────────────────────────────
//   Healthy  ≥ 90   no significant issues
//   Warning  70–89  minor issues detected
//   Critical < 70   users actively impacted
export type HealthStatus = 'healthy' | 'warning' | 'critical';
export function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'warning';
  return 'critical';
}

// ── Public shapes ───────────────────────────────────────────────────────────
export interface CategoryImpact {
  category:         ErrorCategory;
  label:            string;
  reliability:      number;   // 0–100 per-category sub-score (100 = no errors)
  errors:           number;
  affectedUsers:    number;
  affectedSessions: number;
  penalty:          number;   // points removed from the health score
  critical:         boolean;
}

export interface IncidentImpact {
  open:          number;
  investigating: number;
  resolved:      number;
  closed:        number;
  penalty:       number;
}

export interface RootCause {
  topCategory:      ErrorCategory | null;
  topCategoryLabel: string | null;
  mostImpactedArea: string | null;   // url/route hit by the most errors
  mostAffectedUser: string | null;   // email/name of the worst-hit user
}

export interface ReliabilityHealth {
  slug:             string;
  name:             string;
  score:            number;       // 0–100 (current 7d)
  status:           HealthStatus;
  prevScore:        number;       // previous 7d window
  trend:            number;       // score − prevScore
  totalPenalty:     number;
  categories:       CategoryImpact[];   // only categories with errors, worst first
  incidents:        IncidentImpact;
  affectedUsers:    number;
  affectedSessions: number;
  affectedFeatures: number;       // distinct error routes/areas
  rootCause:        RootCause;
  reason:           string;       // one-line plain-English explanation
}

export interface ReliabilityHealthBoard {
  overallScore:   number;
  healthy:        number;
  warning:        number;
  critical:       number;
  total:          number;
  affectedUsers:  number;
  affectedProducts: number;
  mostHealthy:    ReliabilityHealth | null;
  mostUnstable:   ReliabilityHealth | null;
  needsAttention: ReliabilityHealth[];     // status !== healthy, worst first
  recentChanges:  ReliabilityHealth[];     // biggest week-over-week movers
  projects:       ReliabilityHealth[];     // all, worst score first
}

// ── Internal accumulators ───────────────────────────────────────────────────
interface CatBucket { errors: number; users: Set<string>; sessions: Set<string> }
interface Window {
  total: number;
  byCat: Map<ErrorCategory, CatBucket>;
  users: Set<string>;
  sessions: Set<string>;
  areas: Map<string, number>;       // url → error count
  userHits: Map<string, number>;    // user_id → error count
}

const DAY = 86_400_000;
const newWindow = (): Window => ({
  total: 0, byCat: new Map(), users: new Set(), sessions: new Set(), areas: new Map(), userHits: new Map(),
});

function categoryPenalty(cat: ErrorCategory, errors: number): number {
  if (errors <= 0) return 0;
  return Math.min(CATEGORY_CAP[cat], Math.ceil(errors * SEVERITY_WEIGHT[cat]));
}

/** Score a single 7-day window from its error buckets (no incident penalty). */
function scoreWindow(win: Window): { score: number; penalty: number; categories: CategoryImpact[] } {
  let penalty = 0;
  const categories: CategoryImpact[] = [];
  for (const [cat, b] of win.byCat) {
    const p = categoryPenalty(cat, b.errors);
    penalty += p;
    categories.push({
      category: cat,
      label: CATEGORY_LABEL[cat],
      reliability: Math.max(0, 100 - categoryPenalty(cat, b.errors)),
      errors: b.errors,
      affectedUsers: b.users.size,
      affectedSessions: b.sessions.size,
      penalty: p,
      critical: CRITICAL_CATEGORIES.has(cat),
    });
  }
  categories.sort((a, b) => b.penalty - a.penalty);
  return { score: Math.max(0, 100 - penalty), penalty, categories };
}

function urlArea(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    return url.length > 60 ? `${url.slice(0, 60)}…` : url;
  }
}

/**
 * Compute reliability health for every registered product. Reads the last 14
 * days of error events once, splits into this-7d / prev-7d windows, overlays
 * live incident state, and produces a fully-explained score per product.
 */
export const getReliabilityHealth = cache(async (): Promise<ReliabilityHealthBoard> => {
  const admin = getSupabaseAdmin();
  const since14 = new Date(Date.now() - 14 * DAY).toISOString();
  const cutoff7 = Date.now() - 7 * DAY;

  const [projectsRes, errorsRes, incidentBoard] = await Promise.all([
    admin.from('analytics_projects').select('slug, name').eq('tracking_enabled', true),
    admin
      .from('analytics_events')
      .select('portal_id, category, name, user_id, session_id, url, metadata, occurred_at')
      .or('category.eq.error,name.like.error*,name.eq.auth.login_failed')
      .gte('occurred_at', since14)
      .order('occurred_at', { ascending: false })
      .limit(8000),
    getIncidents().catch(() => null),
  ]);

  if (projectsRes.error) throw new AppError('RELIABILITY_PROJECTS_FAILED', projectsRes.error.message, 500);
  if (errorsRes.error) throw new AppError('RELIABILITY_EVENTS_FAILED', errorsRes.error.message, 500);

  const projectName = new Map<string, string>();
  for (const p of (projectsRes.data ?? []) as { slug: string; name: string | null }[]) {
    projectName.set(p.slug, p.name ?? p.slug);
  }

  // Bucket error events into per-project current / previous windows.
  const cur = new Map<string, Window>();
  const prev = new Map<string, Window>();
  for (const r of (errorsRes.data ?? []) as Record<string, unknown>[]) {
    const slug = String(r.portal_id);
    if (!projectName.has(slug)) projectName.set(slug, slug);
    const isCurrent = new Date(String(r.occurred_at)).getTime() >= cutoff7;
    const map = isCurrent ? cur : prev;
    const win = map.get(slug) ?? newWindow();
    const cat = categorize(String(r.name), (r.metadata as Record<string, unknown> | null) ?? null);
    const uid = r.user_id ? String(r.user_id) : null;
    const sid = r.session_id ? String(r.session_id) : null;

    win.total += 1;
    const b = win.byCat.get(cat) ?? { errors: 0, users: new Set<string>(), sessions: new Set<string>() };
    b.errors += 1; if (uid) b.users.add(uid); if (sid) b.sessions.add(sid);
    win.byCat.set(cat, b);
    if (uid) { win.users.add(uid); win.userHits.set(uid, (win.userHits.get(uid) ?? 0) + 1); }
    if (sid) win.sessions.add(sid);
    const area = urlArea((r.url as string | null) ?? null);
    if (area) win.areas.set(area, (win.areas.get(area) ?? 0) + 1);
    map.set(slug, win);
  }

  // Incident tallies per project from the live board (active + resolved/closed).
  const incidentsBySlug = new Map<string, IncidentImpact>();
  if (incidentBoard) {
    const all = [...incidentBoard.incidents, ...incidentBoard.resolved];
    for (const inc of all) {
      const t = incidentsBySlug.get(inc.projectSlug) ?? { open: 0, investigating: 0, resolved: 0, closed: 0, penalty: 0 };
      const isCritical = inc.severity === 'critical';
      if (inc.status === 'open') { t.open += 1; t.penalty += isCritical ? INCIDENT_PENALTY.openCritical : INCIDENT_PENALTY.openOther; }
      else if (inc.status === 'investigating') { t.investigating += 1; t.penalty += isCritical ? INCIDENT_PENALTY.investigatingCritical : INCIDENT_PENALTY.investigatingOther; }
      else if (inc.status === 'resolved') t.resolved += 1;
      else if (inc.status === 'closed') t.closed += 1;
      incidentsBySlug.set(inc.projectSlug, t);
    }
    for (const t of incidentsBySlug.values()) t.penalty = Math.min(INCIDENT_PENALTY_CAP, t.penalty);
  }

  // Resolve the worst-hit user id per project to a readable label.
  const topUserBySlug = new Map<string, string>();
  for (const [slug, win] of cur) {
    const top = Array.from(win.userHits.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top) topUserBySlug.set(slug, top[0]);
  }
  const topUserIds = Array.from(new Set(topUserBySlug.values()));
  const userLabel = new Map<string, string>();
  if (topUserIds.length) {
    const { data: users } = await admin.from('analytics_users').select('id, email, display_name').in('id', topUserIds);
    for (const u of (users ?? []) as Record<string, unknown>[]) {
      userLabel.set(String(u.id), (u.email as string | null) ?? (u.display_name as string | null) ?? String(u.id).slice(0, 8));
    }
  }

  // Assemble per-project health.
  const projects: ReliabilityHealth[] = [];
  for (const [slug, name] of projectName) {
    const curWin = cur.get(slug) ?? newWindow();
    const prevWin = prev.get(slug) ?? newWindow();
    const inc = incidentsBySlug.get(slug) ?? { open: 0, investigating: 0, resolved: 0, closed: 0, penalty: 0 };

    const scored = scoreWindow(curWin);
    const score = Math.max(0, scored.score - inc.penalty);
    const totalPenalty = scored.penalty + inc.penalty;
    const prevScore = scoreWindow(prevWin).score;   // incidents are "now", not historical
    const trend = score - prevScore;

    const topCat = scored.categories[0] ?? null;
    const topArea = Array.from(curWin.areas.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topUserId = topUserBySlug.get(slug);
    const rootCause: RootCause = {
      topCategory: topCat?.category ?? null,
      topCategoryLabel: topCat?.label ?? null,
      mostImpactedArea: topArea,
      mostAffectedUser: topUserId ? (userLabel.get(topUserId) ?? null) : null,
    };

    // Plain-English reason.
    let reason: string;
    if (curWin.total === 0 && inc.open === 0 && inc.investigating === 0) {
      reason = 'Stable — no errors or open incidents in the last 7 days.';
    } else {
      const bits: string[] = [];
      if (topCat) bits.push(`${topCat.errors} ${topCat.label.toLowerCase()}`);
      const more = scored.categories[1];
      if (more) bits.push(`${more.errors} ${more.label.toLowerCase()}`);
      if (inc.open + inc.investigating > 0) bits.push(`${inc.open + inc.investigating} active incident${inc.open + inc.investigating === 1 ? '' : 's'}`);
      reason = bits.length ? `Health reduced by ${bits.join(', ')}.` : 'Minor reliability noise detected.';
    }

    projects.push({
      slug, name,
      score, status: statusFromScore(score), prevScore, trend, totalPenalty,
      categories: scored.categories,
      incidents: inc,
      affectedUsers: curWin.users.size,
      affectedSessions: curWin.sessions.size,
      affectedFeatures: curWin.areas.size,
      rootCause, reason,
    });
  }

  projects.sort((a, b) => a.score - b.score);

  const total = projects.length;
  const overallScore = total ? Math.round(projects.reduce((s, p) => s + p.score, 0) / total) : 100;
  const withImpact = projects.filter((p) => p.totalPenalty > 0);
  const sortedByScoreDesc = [...projects].sort((a, b) => b.score - a.score);

  return {
    overallScore,
    healthy:  projects.filter((p) => p.status === 'healthy').length,
    warning:  projects.filter((p) => p.status === 'warning').length,
    critical: projects.filter((p) => p.status === 'critical').length,
    total,
    affectedUsers: withImpact.reduce((s, p) => s + p.affectedUsers, 0),
    affectedProducts: withImpact.length,
    mostHealthy:  sortedByScoreDesc[0] ?? null,
    mostUnstable: projects[0] && projects[0].totalPenalty > 0 ? projects[0] : null,
    needsAttention: projects.filter((p) => p.status !== 'healthy'),
    recentChanges: [...projects].filter((p) => p.trend !== 0).sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend)).slice(0, 6),
    projects,
  };
});

/** Single product's reliability health (for the Health Analysis detail page). */
export async function getReliabilityHealthBySlug(slug: string): Promise<ReliabilityHealth | null> {
  const board = await getReliabilityHealth();
  return board.projects.find((p) => p.slug === slug) ?? null;
}

// ── Health History (daily snapshots → trend charts) ─────────────────────────

export interface HealthHistoryPoint {
  date:   string;        // YYYY-MM-DD
  score:  number;
  status: HealthStatus;
}

/**
 * Persist today's reliability score for every product. Idempotent — the
 * (snapshot_date, project_slug) primary key means re-running just overwrites
 * today's row, so it is safe to call on every dashboard view AND from a daily
 * cron. Defensive: a no-op if migration 0038 has not been applied yet.
 */
export async function snapshotReliabilityHealth(): Promise<{ snapshotted: number }> {
  const board = await getReliabilityHealth();
  if (!board.projects.length) return { snapshotted: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const rows = board.projects.map((p) => ({
    snapshot_date:     today,
    project_slug:      p.slug,
    score:             p.score,
    status:            p.status,
    total_penalty:     p.totalPenalty,
    affected_users:    p.affectedUsers,
    affected_sessions: p.affectedSessions,
    active_incidents:  p.incidents.open + p.incidents.investigating,
    breakdown: {
      categories: p.categories.map((c) => ({ category: c.category, errors: c.errors, penalty: c.penalty })),
      incidentPenalty: p.incidents.penalty,
    },
  }));

  try {
    const { error } = await getSupabaseAdmin()
      .from('health_history')
      .upsert(rows, { onConflict: 'snapshot_date,project_slug' });
    if (error) return { snapshotted: 0 };
    return { snapshotted: rows.length };
  } catch {
    return { snapshotted: 0 };
  }
}

/**
 * Read a product's score history (oldest → newest) for the last `days`.
 * Returns [] if the table is missing or no snapshots exist yet.
 */
export async function getHealthHistory(slug: string, days = 30): Promise<HealthHistoryPoint[]> {
  const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('health_history')
      .select('snapshot_date, score, status')
      .eq('project_slug', slug)
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: true });
    if (error) return [];
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      date: String(r.snapshot_date),
      score: Number(r.score),
      status: String(r.status) as HealthStatus,
    }));
  } catch {
    return [];
  }
}
