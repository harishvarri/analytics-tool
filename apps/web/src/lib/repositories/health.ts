import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Generic Project Health Index — works for ANY app (no ticket events required).
 * Reads v_project_health_generic (migration 0030).
 */

const n = (v: unknown): number => Number(v ?? 0);

export type HealthTier = 'healthy' | 'at_risk' | 'critical';

export interface ProjectHealthRow {
  projectSlug:     string;
  projectName:     string;
  ghiScore:        number;
  healthTier:      HealthTier;
  adoptionNorm:    number;
  reliabilityNorm: number;
  performanceNorm: number;
  activityNorm:    number;
  errors7d:        number;
  events7d:        number;
  p95LoadMs:       number | null;
}

/** All projects scored 0–100, worst first (problems surface at the top). */
export async function getProjectHealth(): Promise<ProjectHealthRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_project_health_generic')
    .select('*');
  if (error) throw new AppError('PROJECT_HEALTH_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    projectSlug:     String(r.project_slug),
    projectName:     String(r.project_name ?? r.project_slug),
    ghiScore:        n(r.ghi_score),
    healthTier:      (r.health_tier as HealthTier) ?? 'at_risk',
    adoptionNorm:    n(r.adoption_norm),
    reliabilityNorm: n(r.reliability_norm),
    performanceNorm: n(r.performance_norm),
    activityNorm:    n(r.activity_norm),
    errors7d:        n(r.errors_7d),
    events7d:        n(r.events_7d),
    p95LoadMs:       r.p95_load_ms == null ? null : n(r.p95_load_ms),
  }));
}
