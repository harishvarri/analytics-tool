import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Performance Analytics repository (migration 0018). Reads percentile views
 * built from the SDK's auto-tracked performance.page_load / .engagement events.
 */

export interface PerformanceKpis {
  samples:              number;
  loadP50Ms:            number | null;
  loadP75Ms:            number | null;
  loadP95Ms:            number | null;
  ttfbP50Ms:            number | null;
  domInteractiveP50Ms:  number | null;
  avgEngagedSec:        number | null;
}

export interface RoutePerformance {
  route:       string;
  samples:     number;
  loadP50Ms:   number | null;
  loadP95Ms:   number | null;
  ttfbAvgMs:   number | null;
}

export interface PerfTrendPoint {
  day:       string;
  samples:   number;
  loadP50Ms: number | null;
}

export interface ActiveUserCounts {
  dau:           number;
  wau:           number;
  mau:           number;
  stickinessPct: number;
}

const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function getPerformanceKpis(): Promise<PerformanceKpis> {
  const { data, error } = await getSupabaseAdmin().from('v_performance_kpis').select('*').maybeSingle();
  if (error) throw new AppError('PERF_KPIS_FAILED', error.message, 500);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    samples:             Number(r.samples ?? 0),
    loadP50Ms:           n(r.load_p50_ms),
    loadP75Ms:           n(r.load_p75_ms),
    loadP95Ms:           n(r.load_p95_ms),
    ttfbP50Ms:           n(r.ttfb_p50_ms),
    domInteractiveP50Ms: n(r.dom_interactive_p50_ms),
    avgEngagedSec:       n(r.avg_engaged_sec),
  };
}

export async function getPerformanceByRoute(limit = 20): Promise<RoutePerformance[]> {
  const { data, error } = await getSupabaseAdmin().from('v_performance_by_route').select('*').limit(limit);
  if (error) throw new AppError('PERF_ROUTE_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    route:     String(r.route),
    samples:   Number(r.samples),
    loadP50Ms: n(r.load_p50_ms),
    loadP95Ms: n(r.load_p95_ms),
    ttfbAvgMs: n(r.ttfb_avg_ms),
  }));
}

export async function getPerformanceTrend(): Promise<PerfTrendPoint[]> {
  const { data, error } = await getSupabaseAdmin().from('v_performance_trend').select('*');
  if (error) throw new AppError('PERF_TREND_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    day:       String(r.day),
    samples:   Number(r.samples),
    loadP50Ms: n(r.load_p50_ms),
  }));
}

export async function getActiveUserCounts(): Promise<ActiveUserCounts> {
  const { data, error } = await getSupabaseAdmin().from('v_active_user_counts').select('*').maybeSingle();
  if (error) throw new AppError('ACTIVE_USERS_FAILED', error.message, 500);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    dau:           Number(r.dau ?? 0),
    wau:           Number(r.wau ?? 0),
    mau:           Number(r.mau ?? 0),
    stickinessPct: Number(r.stickiness_pct ?? 0),
  };
}
