import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

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
