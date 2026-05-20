import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module C — Project Health Index repository.
 *
 * Reads v_project_health (migration 0007) which already produces the composite
 * PHI score and tier. No arithmetic in app code — the SQL view is the single
 * source of truth for the formula.
 */

export type HealthTier = 'healthy' | 'at_risk' | 'critical';

export interface ProjectHealth {
  projectId:     string;
  projectName:   string;
  phiScore:      number;
  tier:          HealthTier;
  velocityNorm:  number;
  qualityNorm:   number;
  ontrackNorm:   number;
  // Contributing facts (for the drill-down)
  done28d:       number;
  donePrev28d:   number;
  bugCount:      number;
  workCount:     number;
  agingCount:    number;
  openCount:     number;
}

export interface PortfolioSummary {
  healthy:   number;
  atRisk:    number;
  critical:  number;
  total:     number;
  avgPhi:    number | null;
}

interface Row {
  project_id:      string;
  project_name:    string;
  phi_score:       number;
  health_tier:     HealthTier;
  velocity_norm:   number;
  quality_norm:    number;
  ontrack_norm:    number;
  done_28d:        number;
  done_prev_28d:   number;
  bug_count:       number;
  work_count:      number;
  aging_count:     number;
  open_count:      number;
}

function mapRow(r: Row): ProjectHealth {
  return {
    projectId:    r.project_id,
    projectName:  r.project_name,
    phiScore:     Number(r.phi_score ?? 0),
    tier:         r.health_tier,
    velocityNorm: Number(r.velocity_norm ?? 0),
    qualityNorm:  Number(r.quality_norm ?? 0),
    ontrackNorm:  Number(r.ontrack_norm ?? 0),
    done28d:      Number(r.done_28d ?? 0),
    donePrev28d:  Number(r.done_prev_28d ?? 0),
    bugCount:     Number(r.bug_count ?? 0),
    workCount:    Number(r.work_count ?? 0),
    agingCount:   Number(r.aging_count ?? 0),
    openCount:    Number(r.open_count ?? 0),
  };
}

/** All projects, sorted worst-first (lowest PHI). */
export async function getProjectHealthList(): Promise<ProjectHealth[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_project_health')
    .select('*')
    .order('phi_score', { ascending: true });

  if (error) throw new AppError('PHI_LIST_FAILED', error.message, 500);

  return ((data ?? []) as Row[]).map(mapRow);
}

/** Portfolio-level rollup (tier counts + average PHI). */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const list = await getProjectHealthList();

  const healthy  = list.filter((p) => p.tier === 'healthy').length;
  const atRisk   = list.filter((p) => p.tier === 'at_risk').length;
  const critical = list.filter((p) => p.tier === 'critical').length;
  const avg      = list.length === 0
    ? null
    : Math.round((list.reduce((sum, p) => sum + p.phiScore, 0) / list.length) * 10) / 10;

  return {
    healthy,
    atRisk,
    critical,
    total: list.length,
    avgPhi: avg,
  };
}
