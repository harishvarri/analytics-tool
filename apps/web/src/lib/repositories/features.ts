import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module F — Feature Adoption Analytics repository.
 *
 * All views are created by migration 0010.
 * "Feature" = the namespace prefix of an event name (the part before the first dot).
 * e.g.  "board.ticket_moved"  →  feature = "board"
 *
 * Exclusions (infrastructure, not tracked here):
 *   auth.*, navigation.*, session.*
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeatureSummary {
  /** Feature namespace (e.g. "board", "ticket", "qa") */
  feature:        string;
  /** ISO date the feature was first seen in events */
  firstSeen:      string;
  totalEvents:    number;
  /** Distinct users all-time (90-day window) */
  totalUsers:     number;
  /** Distinct active users last 7 days */
  users7d:        number;
  /** Distinct active users last 28 days */
  users28d:       number;
  /** Raw event count last 7 days */
  events7d:       number;
  /** Raw event count last 28 days */
  events28d:      number;
  /** How many distinct portal_ids this feature appears in */
  appCount:       number;
  /** Adoption % = users28d / platform_users_28d × 100 */
  adoptionPct28d: number;
}

export interface FeatureTrendPoint {
  feature:     string;
  week:        string;   // ISO date of week start (Monday)
  events:      number;
  activeUsers: number;
}

export interface FeatureAction {
  feature:        string;
  action:         string;  // full event name, e.g. "board.ticket_moved"
  totalEvents:    number;
  uniqueUsers:    number;
  uniqueSessions: number;
  lastSeen:       string;
}

export interface FeatureDecayPoint {
  feature:       string;
  week:          string;   // ISO date of week start
  usersThisWeek: number;
  usersReturned: number;
  retentionPct:  number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getFeatureSummaries(): Promise<FeatureSummary[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_feature_summary')
    .select('*');

  if (error) throw new AppError('FEATURE_SUMMARY_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    feature: string; first_seen: string; total_events: number; total_users: number;
    users_7d: number; users_28d: number; events_7d: number; events_28d: number;
    app_count: number; adoption_pct_28d: number;
  }>).map((r) => ({
    feature:        r.feature,
    firstSeen:      r.first_seen,
    totalEvents:    Number(r.total_events),
    totalUsers:     Number(r.total_users),
    users7d:        Number(r.users_7d),
    users28d:       Number(r.users_28d),
    events7d:       Number(r.events_7d),
    events28d:      Number(r.events_28d),
    appCount:       Number(r.app_count),
    adoptionPct28d: Number(r.adoption_pct_28d),
  }));
}

export async function getFeatureWeeklyTrend(): Promise<FeatureTrendPoint[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_feature_weekly_trend')
    .select('*');

  if (error) throw new AppError('FEATURE_TREND_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    feature: string; week: string; events: number; active_users: number;
  }>).map((r) => ({
    feature:     r.feature,
    week:        r.week,
    events:      Number(r.events),
    activeUsers: Number(r.active_users),
  }));
}

export async function getFeatureActions(feature?: string): Promise<FeatureAction[]> {
  let query = getSupabaseAdmin()
    .from('v_feature_actions')
    .select('*');

  if (feature) query = (query as typeof query).eq('feature', feature);

  const { data, error } = await query;

  if (error) throw new AppError('FEATURE_ACTIONS_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    feature: string; action: string; total_events: number; unique_users: number;
    unique_sessions: number; last_seen: string;
  }>).map((r) => ({
    feature:        r.feature,
    action:         r.action,
    totalEvents:    Number(r.total_events),
    uniqueUsers:    Number(r.unique_users),
    uniqueSessions: Number(r.unique_sessions),
    lastSeen:       r.last_seen,
  }));
}

export async function getFeatureDecay(): Promise<FeatureDecayPoint[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_feature_decay')
    .select('*');

  if (error) throw new AppError('FEATURE_DECAY_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    feature: string; week: string; users_this_week: number;
    users_returned: number; retention_pct: number;
  }>).map((r) => ({
    feature:       r.feature,
    week:          r.week,
    usersThisWeek: Number(r.users_this_week),
    usersReturned: Number(r.users_returned),
    retentionPct:  Number(r.retention_pct),
  }));
}

// ── Aggregates ───────────────────────────────────────────────────────────────

export interface FeaturePortfolioStats {
  /** Total distinct feature namespaces with activity in last 28 days */
  activeFeatures:    number;
  /** Platform-wide avg adoption % */
  avgAdoptionPct:    number | null;
  /** Feature with highest adoption % in last 28 days */
  topFeature:        string | null;
  /** % of platform users who used at least one tracked feature in last 7d */
  platformUsage7d:   number | null;
}

export async function getFeaturePortfolioStats(): Promise<FeaturePortfolioStats> {
  const summaries = await getFeatureSummaries();
  const active = summaries.filter((s) => s.users28d > 0);

  const avgAdoptionPct =
    active.length > 0
      ? Math.round((active.reduce((sum, s) => sum + s.adoptionPct28d, 0) / active.length) * 10) / 10
      : null;

  const topFeature = active[0]?.feature ?? null;   // sorted desc by users_28d in the view

  // % of platform users touched any feature in the last 7d — proxy via union
  // This is approximate; for exactness we'd need a separate DB query.
  const totalUsers7d = active.reduce((sum, s) => sum + s.users7d, 0);
  const platformUsers28d = active.reduce((max, s) => Math.max(max, s.totalUsers), 0);
  const platformUsage7d =
    platformUsers28d > 0 ? Math.round((totalUsers7d / platformUsers28d) * 100) : null;

  return {
    activeFeatures:  active.length,
    avgAdoptionPct,
    topFeature,
    platformUsage7d,
  };
}
