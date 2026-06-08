import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import { getProjectIntelligence } from './projectIntelligence';

/**
 * Module E — Statistical Anomaly Alerts repository.
 *
 * Reads v_anomaly_signals (migration 0009). The view does all the math:
 * hourly buckets → 7-day baseline mean/stddev → z-score → severity tier.
 */

export type AnomalySeverity = 'warning' | 'critical';
export type AnomalyDirection = 'spike' | 'dip';

export interface AnomalySignal {
  portalId:        string;
  eventName:       string;
  currentEvents:   number;
  baselineMean:    number;
  baselineStd:     number;
  baselineSamples: number;
  observedHour:    string | null;
  zScore:          number;
  severity:        AnomalySeverity;
  direction:       AnomalyDirection;
}

export interface AnomalySummary {
  critical:    number;
  warning:     number;
  totalActive: number;
  topSeverity: AnomalySeverity | null;
}

// ── Operational risk engine (derived, always-useful) ────────────────────────
// The statistical z-score view needs dense hourly traffic and a 7-day baseline,
// so on low-traffic internal apps it frequently finds nothing. This engine
// derives concrete, explainable risks from the per-product signals we already
// compute — so the page surfaces real problems whenever they exist.

export type RiskKind = 'login_failures' | 'usage_drop' | 'error_spike' | 'inactivity' | 'performance';

export interface RiskSignal {
  kind:      RiskKind;
  severity:  AnomalySeverity;
  portalId:  string;
  portalName: string;
  title:     string;
  metric:    string;
  detail:    string;
  action:    string;
}

export interface RiskBoard {
  critical: number;
  warning:  number;
  total:    number;
  signals:  RiskSignal[];
}

export async function getOperationalRisks(): Promise<RiskBoard> {
  const projects = await getProjectIntelligence().catch(() => []);
  const signals: RiskSignal[] = [];

  for (const p of projects) {
    // 1) Authentication — failed login spike.
    //    Suppressed when an error-category incident for this project is resolved/closed,
    //    since login failures are surfaced as an authentication-category incident.
    if (p.failedLogins7d >= 5 && !p.errorsAcknowledged) {
      const critical = p.failedLogins7d >= 20;
      signals.push({
        kind: 'login_failures', severity: critical ? 'critical' : 'warning', portalId: p.slug, portalName: p.name,
        title: `Login failures in ${p.name}`,
        metric: `${p.failedLogins7d} failed sign-ins (7d)`,
        detail: 'Elevated authentication failures may indicate a broken login flow or credential problems.',
        action: 'Review the authentication flow and recent auth events for this product.',
      });
    }

    // 2) Error spike.
    //    Suppressed when an error-category incident for this project is resolved/closed.
    if (p.errorRatePct >= 2 && p.errors30d > 0 && !p.errorsAcknowledged) {
      const critical = p.errorRatePct >= 5;
      signals.push({
        kind: 'error_spike', severity: critical ? 'critical' : 'warning', portalId: p.slug, portalName: p.name,
        title: `Error rate elevated in ${p.name}`,
        metric: `${p.errorRatePct}% error rate · ${p.errors30d} errors (30d)`,
        detail: 'Users are hitting errors more often than the healthy threshold (2%).',
        action: 'Open the Error Intelligence Center to see categories and impacted users.',
      });
    }

    // 3) Product inactivity.
    //    Suppressed when the project-status incident is resolved/closed.
    if (p.daysSinceActivity !== null && p.daysSinceActivity >= 7 && !p.statusAcknowledged) {
      const critical = p.daysSinceActivity >= 14;
      signals.push({
        kind: 'inactivity', severity: critical ? 'critical' : 'warning', portalId: p.slug, portalName: p.name,
        title: `${p.name} has gone quiet`,
        metric: `no activity for ${p.daysSinceActivity} days`,
        detail: critical ? 'Prolonged silence often means tracking was removed or the product is down.' : 'Activity has paused — worth confirming the product is still in use.',
        action: 'Confirm the product is reachable and the tracking script is still installed.',
      });
    }

    // 4) Usage drop — this week well below the 30-day weekly average
    const weeklyAvg = p.activeUsers30d > 0 ? (p.activeUsers30d * 7) / 30 : 0;
    if (weeklyAvg >= 2 && p.activeUsers7d < weeklyAvg * 0.6 && (p.daysSinceActivity ?? 0) < 7) {
      signals.push({
        kind: 'usage_drop', severity: 'warning', portalId: p.slug, portalName: p.name,
        title: `Usage dropping in ${p.name}`,
        metric: `${p.activeUsers7d} active this week vs ~${Math.round(weeklyAvg)} typical`,
        detail: 'Weekly active users are well below this product’s recent norm.',
        action: 'Check for a release regression or a workflow change that reduced engagement.',
      });
    }

    // 5) Performance degradation
    if (p.p95LoadMs !== null && p.p95LoadMs >= 3000) {
      const critical = p.p95LoadMs >= 6000;
      signals.push({
        kind: 'performance', severity: critical ? 'critical' : 'warning', portalId: p.slug, portalName: p.name,
        title: `${p.name} is loading slowly`,
        metric: `${(p.p95LoadMs / 1000).toFixed(1)}s p95 load`,
        detail: 'The 95th-percentile page load is above the 3s comfort threshold.',
        action: 'Investigate slow routes, payload sizes, and third-party scripts.',
      });
    }
  }

  const order = { critical: 0, warning: 1 } as const;
  signals.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    critical: signals.filter((s) => s.severity === 'critical').length,
    warning:  signals.filter((s) => s.severity === 'warning').length,
    total:    signals.length,
    signals,
  };
}

export async function getAnomalySignals(): Promise<AnomalySignal[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_anomaly_signals')
    .select('*');

  if (error) throw new AppError('ANOMALY_QUERY_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    portal_id:        string;
    event_name:       string;
    current_events:   number;
    baseline_mean:    number;
    baseline_std:     number;
    baseline_samples: number;
    observed_hour:    string | null;
    z_score:          number;
    severity:         string;
    direction:        string;
  }>)
    .filter((r) => r.severity === 'warning' || r.severity === 'critical')
    .map((r) => ({
      portalId:        r.portal_id,
      eventName:       r.event_name,
      currentEvents:   Number(r.current_events),
      baselineMean:    Number(r.baseline_mean),
      baselineStd:     Number(r.baseline_std),
      baselineSamples: Number(r.baseline_samples),
      observedHour:    r.observed_hour,
      zScore:          Number(r.z_score),
      severity:        r.severity as AnomalySeverity,
      direction:       r.direction as AnomalyDirection,
    }));
}

export async function getAnomalySummary(): Promise<AnomalySummary> {
  const list = await getAnomalySignals();
  const critical = list.filter((s) => s.severity === 'critical').length;
  const warning  = list.filter((s) => s.severity === 'warning').length;
  return {
    critical,
    warning,
    totalActive: critical + warning,
    topSeverity: critical > 0 ? 'critical' : warning > 0 ? 'warning' : null,
  };
}
