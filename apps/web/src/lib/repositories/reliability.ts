import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module G — SLO / Reliability Center repository.
 *
 * All views are created by migration 0011. Errors are grouped by a normalized
 * fingerprint (volatile tokens stripped). No AI/ML — pure SQL + regex.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ErrorGroup {
  fingerprint:      string;
  sampleMessage:    string;
  errorTypes:       string[];
  errorName:        string | null;
  totalOccurrences: number;
  affectedUsers:    number;
  affectedSessions: number;
  appCount:         number;
  firstSeen:        string;
  lastSeen:         string;
  occurrences24h:   number;
  occurrences7d:    number;
  isNew:            boolean;
}

export interface ErrorRatePoint {
  bucket:       string;  // ISO hour
  errorEvents:  number;
  totalEvents:  number;
  errorRatePct: number;
}

export interface ReliabilityKpis {
  totalSessions:      number;
  erroredSessions:    number;
  totalErrors24h:     number;
  errorGroups24h:     number;
  affectedUsers24h:   number;
  newErrorGroups24h:  number;
  sloTargetPct:       number;
  errorFreePct:       number;
  budgetBurnPct:      number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getErrorGroups(limit = 50): Promise<ErrorGroup[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_error_groups')
    .select('*')
    .limit(limit);

  if (error) throw new AppError('ERROR_GROUPS_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    fingerprint: string; sample_message: string; error_types: string[] | null;
    error_name: string | null; total_occurrences: number; affected_users: number;
    affected_sessions: number; app_count: number; first_seen: string; last_seen: string;
    occurrences_24h: number; occurrences_7d: number; is_new: boolean;
  }>).map((r) => ({
    fingerprint:      r.fingerprint,
    sampleMessage:    r.sample_message,
    errorTypes:       Array.from(new Set(r.error_types ?? [])),
    errorName:        r.error_name,
    totalOccurrences: Number(r.total_occurrences),
    affectedUsers:    Number(r.affected_users),
    affectedSessions: Number(r.affected_sessions),
    appCount:         Number(r.app_count),
    firstSeen:        r.first_seen,
    lastSeen:         r.last_seen,
    occurrences24h:   Number(r.occurrences_24h),
    occurrences7d:    Number(r.occurrences_7d),
    isNew:            Boolean(r.is_new),
  }));
}

export async function getErrorRateTrend(): Promise<ErrorRatePoint[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_error_rate_trend')
    .select('*');

  if (error) throw new AppError('ERROR_RATE_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    bucket: string; error_events: number; total_events: number; error_rate_pct: number;
  }>).map((r) => ({
    bucket:       r.bucket,
    errorEvents:  Number(r.error_events),
    totalEvents:  Number(r.total_events),
    errorRatePct: Number(r.error_rate_pct),
  }));
}

export async function getReliabilityKpis(): Promise<ReliabilityKpis> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_reliability_kpis')
    .select('*')
    .maybeSingle();

  if (error) throw new AppError('RELIABILITY_KPIS_FAILED', error.message, 500);

  const r = (data ?? {}) as {
    total_sessions?: number; errored_sessions?: number; total_errors_24h?: number;
    error_groups_24h?: number; affected_users_24h?: number; new_error_groups_24h?: number;
    slo_target_pct?: number; error_free_pct?: number; budget_burn_pct?: number;
  };

  return {
    totalSessions:     Number(r.total_sessions ?? 0),
    erroredSessions:   Number(r.errored_sessions ?? 0),
    totalErrors24h:    Number(r.total_errors_24h ?? 0),
    errorGroups24h:    Number(r.error_groups_24h ?? 0),
    affectedUsers24h:  Number(r.affected_users_24h ?? 0),
    newErrorGroups24h: Number(r.new_error_groups_24h ?? 0),
    sloTargetPct:      Number(r.slo_target_pct ?? 99.5),
    errorFreePct:      Number(r.error_free_pct ?? 100),
    budgetBurnPct:     Number(r.budget_burn_pct ?? 0),
  };
}
