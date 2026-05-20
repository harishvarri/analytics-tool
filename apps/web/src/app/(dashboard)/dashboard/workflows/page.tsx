import { AlertTriangle, Clock, GitMerge, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { WorkflowCycleChart } from '@/components/charts/WorkflowCycleChart';
import { WorkflowThroughputChart } from '@/components/charts/WorkflowThroughputChart';
import { CHART_COLORS } from '@/components/charts/ChartTheme';
import {
  fetchAgingTickets,
  fetchBottlenecks,
  fetchCycleTimeByStatus,
  fetchThroughputWeekly,
  fetchWorkflowKpis,
} from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ app?: string; project?: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtHours(hours: number | null): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '—';
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h  = ms / (1000 * 60 * 60);
  if (h < 1)  return `${Math.round(h * 60)}m ago`;
  if (h < 48) return `${h.toFixed(1)}h ago`;
  return `${(h / 24).toFixed(1)}d ago`;
}

const SEVERITY_TONE: Record<string, string> = {
  Critical: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
  High:     'border-orange-500/40 text-orange-600 dark:text-orange-400',
  Medium:   'border-amber-500/40 text-amber-600 dark:text-amber-400',
  Low:      'border-sky-500/40 text-sky-600 dark:text-sky-400',
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function WorkflowsPage({ searchParams }: PageProps) {
  const { app, project } = await searchParams;
  const filter = {
    ...(app     ? { appId: app }         : {}),
    ...(project ? { projectId: project } : {}),
  };

  const [kpis, cycle, throughput, aging, bottlenecks] = await Promise.all([
    fetchWorkflowKpis(filter),
    fetchCycleTimeByStatus(),
    fetchThroughputWeekly(),
    fetchAgingTickets(15, filter),
    fetchBottlenecks(filter),
  ]);

  // Order statuses canonically for charts/tables
  const STATUS_ORDER = ['Backlog', 'Selected', 'In Progress', 'In Review', 'Done'];
  const cycleSorted = [...cycle].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  const cycleChartData = cycleSorted.map((r) => ({
    status: r.status,
    p50:    Number(r.p50Hours.toFixed(2)),
    p75:    Number(r.p75Hours.toFixed(2)),
    p95:    Number(r.p95Hours.toFixed(2)),
  }));

  const throughputData = throughput.map((p) => ({
    week:  p.weekStart,
    Done:  p.doneCount,
  }));

  const hasAnyData = cycle.length > 0 || throughput.length > 0 || aging.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Intelligence"
        description="Cycle time, throughput, WIP and bottlenecks — derived from ticket transitions."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● 30-day window
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Median Cycle Time"
          value={fmtHours(kpis.medianCycleHours)}
          icon={Clock}
          trend={{ direction: 'flat', label: 'Backlog → Done · last 30d' }}
        />
        <KpiCard
          label="Throughput (7d)"
          value={String(kpis.throughput7d)}
          icon={GitMerge}
          trend={{ direction: 'flat', label: 'Tickets reaching Done' }}
        />
        <KpiCard
          label="Work in Progress"
          value={String(kpis.wipTotal)}
          icon={Layers}
          trend={{ direction: 'flat', label: 'Currently open' }}
        />
        <KpiCard
          label="Aging Tickets"
          value={String(kpis.agingCount)}
          icon={AlertTriangle}
          trend={{ direction: kpis.agingCount > 0 ? 'up' : 'flat', label: 'Above stage p75 dwell' }}
          invertTrend
        />
      </section>

      {!hasAnyData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No workflow data for the selected scope</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Workflow Intelligence is computed from{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">ticket.status_changed</code>{' '}
            events emitted by any connected application. Once tickets move across statuses, the
            charts, KPIs, and bottleneck panels will populate automatically.
          </p>
        </div>
      )}

      {/* Cycle time + throughput */}
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Cycle time by status"
          description="How long tickets dwell in each stage (median / p75 / p95, last 30 days)"
        >
          {cycleChartData.length > 0 ? (
            <WorkflowCycleChart
              data={cycleChartData as unknown as Record<string, unknown>[]}
              xKey="status"
              series={[
                { dataKey: 'p50', label: 'p50 (median)', color: CHART_COLORS.primary },
                { dataKey: 'p75', label: 'p75',          color: CHART_COLORS.amber },
                { dataKey: 'p95', label: 'p95',          color: CHART_COLORS.rose },
              ]}
              height={300}
            />
          ) : (
            <EmptyChart hint="Need at least one completed status leg per stage to compute percentiles." />
          )}
        </ChartCard>

        <ChartCard
          title="Weekly throughput"
          description="Tickets reaching Done per ISO week (last 12 weeks)"
        >
          {throughputData.length > 0 ? (
            <WorkflowThroughputChart
              data={throughputData as unknown as Record<string, unknown>[]}
              xKey="week"
              series={[
                { dataKey: 'Done', label: 'Done', color: CHART_COLORS.emerald },
              ]}
              height={300}
            />
          ) : (
            <EmptyChart hint="No tickets have reached Done in the trailing 12 weeks." />
          )}
        </ChartCard>
      </section>

      {/* Bottlenecks + aging */}
      <section className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Bottleneck stages"
          description="Where work is currently stuck (count of aging tickets per stage)"
          className="xl:col-span-1"
        >
          {bottlenecks.length > 0 ? (
            <div className="space-y-2">
              {bottlenecks.map((b) => {
                const pct = b.totalInStage > 0 ? Math.round((b.agingCount / b.totalInStage) * 100) : 0;
                return (
                  <div key={b.status} className="rounded-md border p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{b.status}</span>
                      <span className="text-muted-foreground">
                        {b.agingCount}/{b.totalInStage} aging
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-rose-500/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart hint="No open tickets yet — bottlenecks appear once WIP grows." />
          )}
        </ChartCard>

        <ChartCard
          title="Aging tickets"
          description="Currently-open tickets sorted by dwell time"
          className="xl:col-span-2"
        >
          {aging.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Ticket</th>
                    <th className="px-2 py-2 text-left font-medium">Status</th>
                    <th className="px-2 py-2 text-left font-medium">Severity</th>
                    <th className="px-2 py-2 text-right font-medium">In stage</th>
                    <th className="px-2 py-2 text-right font-medium">Benchmark p75</th>
                    <th className="px-2 py-2 text-right font-medium">Entered</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((t) => (
                    <tr key={t.ticketKey} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2 font-mono">{t.ticketKey}</td>
                      <td className="px-2 py-2">{t.status}</td>
                      <td className="px-2 py-2">
                        {t.severity ? (
                          <Badge
                            variant="outline"
                            className={SEVERITY_TONE[t.severity] ?? ''}
                          >
                            {t.severity}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className={`px-2 py-2 text-right tabular-nums ${t.isAging ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}`}>
                        {fmtHours(t.currentDwellHours)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {t.benchmarkP75 > 0 ? fmtHours(t.benchmarkP75) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtRelative(t.enteredAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart hint="No open tickets — every workflow is at zero WIP." />
          )}
        </ChartCard>
      </section>
    </div>
  );
}

function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-md bg-muted/20 text-center">
      <div className="text-xs font-medium text-muted-foreground">No data yet</div>
      <p className="max-w-[28ch] text-[11px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}
