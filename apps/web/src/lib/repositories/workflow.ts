import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Workflow Intelligence (Module B) repository.
 *
 * All functions are pure SQL over views created in migration 0006. No AI,
 * no ML — just OLAP aggregations over the ticket.status_changed signal.
 */

// ── Types (kept local; the page consumes these directly) ────────────────────

export interface WorkflowKpis {
  medianCycleHours:  number | null;
  throughput7d:      number;
  wipTotal:          number;
  agingCount:        number;
}

export interface CycleTimeRow {
  status:    string;
  samples:   number;
  p50Hours:  number;
  p75Hours:  number;
  p95Hours:  number;
  avgHours:  number;
}

export interface ThroughputPoint {
  weekStart: string;          // ISO date (YYYY-MM-DD)
  doneCount: number;
}

export interface AgingTicket {
  ticketKey:           string;
  projectId:           string | null;
  status:              string;
  severity:            string | null;
  enteredAt:           string;
  currentDwellHours:   number;
  benchmarkP75:        number;
  isAging:             boolean;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export interface WorkflowFilter {
  appId?:     string;
  projectId?: string;
}

/** Single-row scorecard for the KPI strip. */
export async function getWorkflowKpis(filter: WorkflowFilter = {}): Promise<WorkflowKpis> {
  // The base v_workflow_kpis view ignores filters by design (it's a scorecard).
  // When a filter is applied we compute from v_aging_tickets + v_ticket_transitions directly.
  if (!filter.appId && !filter.projectId) {
    const { data, error } = await getSupabaseAdmin()
      .from('v_workflow_kpis')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError('WORKFLOW_KPIS_FAILED', error.message, 500);
    return {
      medianCycleHours: data?.median_cycle_hours ?? null,
      throughput7d:     data?.throughput_7d     ?? 0,
      wipTotal:         data?.wip_total         ?? 0,
      agingCount:       data?.aging_count       ?? 0,
    };
  }

  // Filtered path: compute against v_aging_tickets + v_ticket_transitions.
  const admin = getSupabaseAdmin();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let throughputQ = admin
    .from('v_ticket_transitions')
    .select('ticket_key', { count: 'exact', head: true })
    .eq('to_status', 'Done')
    .gte('occurred_at', sevenDaysAgo);
  if (filter.appId)     throughputQ = throughputQ.eq('portal_id', filter.appId);
  if (filter.projectId) throughputQ = throughputQ.eq('project_id', filter.projectId);

  let agingQ = admin.from('v_aging_tickets').select('is_aging, project_id');
  if (filter.projectId) agingQ = agingQ.eq('project_id', filter.projectId);

  const [throughputRes, agingRes] = await Promise.all([throughputQ, agingQ]);
  if (throughputRes.error) throw new AppError('WORKFLOW_KPIS_FAILED', throughputRes.error.message, 500);
  if (agingRes.error)      throw new AppError('WORKFLOW_KPIS_FAILED', agingRes.error.message, 500);

  const agingRows = (agingRes.data ?? []) as { is_aging: boolean }[];
  return {
    medianCycleHours: null,                                    // omitted under filter
    throughput7d:     throughputRes.count ?? 0,
    wipTotal:         agingRows.length,
    agingCount:       agingRows.filter((r) => r.is_aging).length,
  };
}

/** Cycle-time distribution per status (p50/p75/p95) over last 30 days. */
export async function getCycleTimeByStatus(): Promise<CycleTimeRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_cycle_time_by_status')
    .select('*');

  if (error) throw new AppError('CYCLE_TIME_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    status: string; samples: number;
    p50_hours: number; p75_hours: number; p95_hours: number;
    avg_hours: number;
  }>).map((r) => ({
    status:   r.status,
    samples:  r.samples,
    p50Hours: Number(r.p50_hours ?? 0),
    p75Hours: Number(r.p75_hours ?? 0),
    p95Hours: Number(r.p95_hours ?? 0),
    avgHours: Number(r.avg_hours ?? 0),
  }));
}

/** Weekly throughput — items reaching 'Done' per ISO week (last 12 weeks). */
export async function getThroughputWeekly(): Promise<ThroughputPoint[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_throughput_weekly')
    .select('week_start, done_count')
    .order('week_start', { ascending: true });

  if (error) throw new AppError('THROUGHPUT_FAILED', error.message, 500);

  // Roll up by week_start (collapse per-project rows into a single weekly total)
  const byWeek = new Map<string, number>();
  for (const row of (data ?? []) as { week_start: string; done_count: number }[]) {
    byWeek.set(row.week_start, (byWeek.get(row.week_start) ?? 0) + Number(row.done_count));
  }

  return Array.from(byWeek.entries())
    .map(([weekStart, doneCount]) => ({ weekStart, doneCount }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Currently-open tickets ranked by how long they've been in their stage,
 * with bottleneck flag set when dwell exceeds the historical p75 for that stage.
 */
export async function getAgingTickets(limit = 20, filter: WorkflowFilter = {}): Promise<AgingTicket[]> {
  let q = getSupabaseAdmin().from('v_aging_tickets').select('*').limit(limit);
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  const { data, error } = await q;

  if (error) throw new AppError('AGING_TICKETS_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    ticket_key: string; project_id: string | null; status: string;
    severity: string | null; entered_at: string;
    current_dwell_hours: number; benchmark_p75: number; is_aging: boolean;
  }>).map((r) => ({
    ticketKey:         r.ticket_key,
    projectId:         r.project_id,
    status:            r.status,
    severity:          r.severity,
    enteredAt:         r.entered_at,
    currentDwellHours: Number(r.current_dwell_hours ?? 0),
    benchmarkP75:      Number(r.benchmark_p75 ?? 0),
    isAging:           !!r.is_aging,
  }));
}

/**
 * Bottleneck summary: which status currently holds the most aging tickets
 * (i.e., where work is statistically stuck). Counted from v_aging_tickets.
 */
export interface BottleneckRow { status: string; agingCount: number; totalInStage: number; }
export async function getBottlenecks(filter: WorkflowFilter = {}): Promise<BottleneckRow[]> {
  let q = getSupabaseAdmin().from('v_aging_tickets').select('status, is_aging');
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  const { data, error } = await q;

  if (error) throw new AppError('BOTTLENECKS_FAILED', error.message, 500);

  const map = new Map<string, { aging: number; total: number }>();
  for (const r of (data ?? []) as { status: string; is_aging: boolean }[]) {
    if (!map.has(r.status)) map.set(r.status, { aging: 0, total: 0 });
    const m = map.get(r.status)!;
    m.total++;
    if (r.is_aging) m.aging++;
  }

  return Array.from(map.entries())
    .map(([status, m]) => ({ status, agingCount: m.aging, totalInStage: m.total }))
    .sort((a, b) => b.agingCount - a.agingCount);
}
