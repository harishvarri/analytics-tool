import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module L — Smart Insights & Feature Intelligence repository.
 *
 * NO external AI. A deterministic rule engine reads week-over-week deltas
 * (v_feature_wow, v_metric_wow from migration 0016) and emits human-readable
 * insight cards. Thresholds are explicit and tunable below.
 */

export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical';

export interface Insight {
  id:        string;
  severity:  InsightSeverity;
  title:     string;
  detail:    string;
  metric:    string;
  deltaPct:  number | null;  // null = not applicable (e.g. brand new)
  direction: 'up' | 'down' | 'flat';
}

export interface FeatureIntelligence {
  mostAdopted:    { feature: string; users: number } | null;
  fastestGrowing: { feature: string; deltaPct: number } | null;
  leastUsed:      { feature: string; users: number } | null;
  churnRisk:      { feature: string; deltaPct: number } | null;
}

export interface InsightsBundle {
  insights:     Insight[];
  intelligence: FeatureIntelligence;
}

interface FeatureWow { feature: string; users_this: number; users_last: number }
interface MetricWow  { metric: string;  value_this: number; value_last: number }

// ── Tunable thresholds ─────────────────────────────────────────────────────
const FEATURE_MIN_USERS = 2;    // ignore noise below this
const SIGNIFICANT_PCT    = 25;   // |Δ%| considered notable
const SPIKE_PCT          = 50;   // |Δ%| considered a spike/drop

function pctChange(now: number, prev: number): number | null {
  if (prev === 0) return now > 0 ? null : 0; // null = "new" (no baseline)
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

function titleize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getInsights(): Promise<InsightsBundle> {
  const admin = getSupabaseAdmin();

  const [{ data: featRows, error: featErr }, { data: metricRows, error: metricErr }] =
    await Promise.all([
      admin.from('v_feature_wow').select('*'),
      admin.from('v_metric_wow').select('*'),
    ]);

  if (featErr)   throw new AppError('INSIGHTS_FEATURE_FAILED', featErr.message, 500);
  if (metricErr) throw new AppError('INSIGHTS_METRIC_FAILED', metricErr.message, 500);

  const features = ((featRows ?? []) as FeatureWow[]).map((r) => ({
    feature: r.feature,
    thisW:   Number(r.users_this),
    lastW:   Number(r.users_last),
    delta:   pctChange(Number(r.users_this), Number(r.users_last)),
  }));

  const metrics = ((metricRows ?? []) as MetricWow[]).map((r) => ({
    metric: r.metric,
    thisW:  Number(r.value_this),
    lastW:  Number(r.value_last),
    delta:  pctChange(Number(r.value_this), Number(r.value_last)),
  }));

  const insights: Insight[] = [];

  // ── Metric-driven insights ──────────────────────────────────────────────
  for (const m of metrics) {
    const label = titleize(m.metric);
    if (m.delta === null) {
      if (m.thisW > 0) {
        insights.push({
          id: `metric-${m.metric}-new`,
          severity: m.metric === 'errors' || m.metric === 'login_failures' ? 'warning' : 'info',
          title: `${label} started appearing`,
          detail: `${label} had no activity last week and ${m.thisW.toLocaleString()} this week.`,
          metric: m.metric, deltaPct: null, direction: 'up',
        });
      }
      continue;
    }
    const isBadMetric = m.metric === 'errors' || m.metric === 'login_failures';
    const up = m.delta > 0;
    if (Math.abs(m.delta) >= SIGNIFICANT_PCT) {
      let severity: InsightSeverity;
      if (isBadMetric) severity = up ? (m.delta >= SPIKE_PCT ? 'critical' : 'warning') : 'positive';
      else             severity = up ? 'positive' : (Math.abs(m.delta) >= SPIKE_PCT ? 'warning' : 'info');

      insights.push({
        id: `metric-${m.metric}`,
        severity,
        title: `${label} ${up ? 'increased' : 'dropped'} ${Math.abs(m.delta)}% week-over-week`,
        detail: `${label} went from ${m.lastW.toLocaleString()} to ${m.thisW.toLocaleString()} (last 7d vs prior 7d).`,
        metric: m.metric, deltaPct: m.delta, direction: up ? 'up' : 'down',
      });
    }
  }

  // ── Feature-driven insights ───────────────────────────────────────────────
  for (const f of features) {
    // New feature adoption (no baseline, meaningful uptake)
    if (f.delta === null && f.thisW >= FEATURE_MIN_USERS) {
      insights.push({
        id: `feature-${f.feature}-new`,
        severity: 'positive',
        title: `New traction on "${f.feature}"`,
        detail: `"${f.feature}" went from no users last week to ${f.thisW} this week.`,
        metric: `feature.${f.feature}`, deltaPct: null, direction: 'up',
      });
      continue;
    }
    // Feature churn — usage stopped entirely
    if (f.thisW === 0 && f.lastW >= FEATURE_MIN_USERS) {
      insights.push({
        id: `feature-${f.feature}-churn`,
        severity: 'warning',
        title: `"${f.feature}" usage stopped`,
        detail: `"${f.feature}" had ${f.lastW} users last week and none this week — investigate a regression or deploy.`,
        metric: `feature.${f.feature}`, deltaPct: -100, direction: 'down',
      });
      continue;
    }
    // Significant movement on an established feature
    if (f.delta !== null && Math.abs(f.delta) >= SIGNIFICANT_PCT && Math.max(f.thisW, f.lastW) >= FEATURE_MIN_USERS) {
      const up = f.delta > 0;
      insights.push({
        id: `feature-${f.feature}`,
        severity: up ? 'positive' : (Math.abs(f.delta) >= SPIKE_PCT ? 'warning' : 'info'),
        title: `"${f.feature}" engagement ${up ? 'increased' : 'dropped'} ${Math.abs(f.delta)}% this week`,
        detail: `Weekly active users for "${f.feature}" moved from ${f.lastW} to ${f.thisW}.`,
        metric: `feature.${f.feature}`, deltaPct: f.delta, direction: up ? 'up' : 'down',
      });
    }
  }

  // Sort: critical → warning → positive → info, then by |delta|
  const sevRank: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  insights.sort((a, b) =>
    sevRank[a.severity] - sevRank[b.severity] ||
    Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0),
  );

  // ── Feature Intelligence scorecard ─────────────────────────────────────────
  const active = features.filter((f) => f.thisW >= FEATURE_MIN_USERS || f.lastW >= FEATURE_MIN_USERS);
  const withDelta = active.filter((f) => f.delta !== null) as Array<typeof active[number] & { delta: number }>;

  const mostAdopted = active.length
    ? active.reduce((m, f) => (f.thisW > m.thisW ? f : m))
    : null;

  // "Least used" is only a meaningful, distinct signal when there are at least
  // TWO features with usage this week. With a single active feature, the same
  // item would otherwise be reported as both most- and least-used (QA bug:
  // /dashboard/insights showed "Performance" in both slots). We also guard
  // against ties collapsing onto the most-adopted feature.
  const usedThisWeek = active.filter((f) => f.thisW > 0);
  const leastCandidate =
    usedThisWeek.length > 1
      ? usedThisWeek.reduce((m, f) => (f.thisW < m.thisW ? f : m))
      : null;
  const leastUsed =
    leastCandidate && leastCandidate.feature !== mostAdopted?.feature
      ? leastCandidate
      : null;

  // Fastest-growing / churn-risk operate on the growth axis (Δ% sign), so they
  // never duplicate each other (one is >0, the other <0). They may legitimately
  // coincide with most/least-used since that is a different axis (volume).
  const fastestGrowing = withDelta.length
    ? withDelta.reduce((m, f) => (f.delta > m.delta ? f : m))
    : null;
  const churnRisk = withDelta.length
    ? withDelta.reduce((m, f) => (f.delta < m.delta ? f : m))
    : null;

  const intelligence: FeatureIntelligence = {
    mostAdopted:    mostAdopted    ? { feature: mostAdopted.feature, users: mostAdopted.thisW } : null,
    leastUsed:      leastUsed      ? { feature: leastUsed.feature,   users: leastUsed.thisW }   : null,
    fastestGrowing: fastestGrowing && fastestGrowing.delta > 0 ? { feature: fastestGrowing.feature, deltaPct: fastestGrowing.delta } : null,
    churnRisk:      churnRisk      && churnRisk.delta < 0       ? { feature: churnRisk.feature,      deltaPct: churnRisk.delta }      : null,
  };

  return { insights, intelligence };
}
