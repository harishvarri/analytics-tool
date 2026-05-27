import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module K — Cross-Project (Application) Comparison repository.
 * Reads v_project_comparison (migration 0015): one row per registered app.
 */

export interface ProjectComparisonRow {
  portalId:      string;
  portalName:    string;
  events30d:     number;
  users30d:      number;
  sessions30d:   number;
  errors30d:     number;
  users7d:       number;
  featuresUsed:  number;
  errorRatePct:  number;
  stickinessPct: number;
}

export async function getProjectComparison(): Promise<ProjectComparisonRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_project_comparison')
    .select('*');

  if (error) throw new AppError('CROSS_PROJECT_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    portal_id: string; portal_name: string; events_30d: number; users_30d: number;
    sessions_30d: number; errors_30d: number; users_7d: number; features_used: number;
    error_rate_pct: number | null; stickiness_pct: number | null;
  }>).map((r) => ({
    portalId:      r.portal_id,
    portalName:    r.portal_name,
    events30d:     Number(r.events_30d),
    users30d:      Number(r.users_30d),
    sessions30d:   Number(r.sessions_30d),
    errors30d:     Number(r.errors_30d),
    users7d:       Number(r.users_7d),
    featuresUsed:  Number(r.features_used),
    errorRatePct:  Number(r.error_rate_pct ?? 0),
    stickinessPct: Number(r.stickiness_pct ?? 0),
  }));
}
