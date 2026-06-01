import { Activity, Gauge, Timer, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { PerfTrendChart } from '@/components/charts/PerfTrendChart';
import { CHART_COLORS } from '@/components/charts/ChartTheme';
import { ExportButton } from '@/components/shared/ExportButton';
import {
  fetchPerformanceByRoute,
  fetchPerformanceKpis,
  fetchPerformanceTrend,
} from '@/lib/data/fetchers';
import type { RoutePerformance } from '@/lib/repositories/performance';

export const dynamic = 'force-dynamic';

function fmtMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function loadTone(ms: number | null): string {
  if (ms === null) return 'text-muted-foreground';
  if (ms <= 1000) return 'text-emerald-600 dark:text-emerald-400';
  if (ms <= 2500) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PageProps { searchParams: Promise<{ app?: string }> }

export default async function PerformancePage({ searchParams }: PageProps) {
  const { app: appId } = await searchParams;
  const [kpis, routes, trend] = await Promise.all([
    fetchPerformanceKpis(appId),
    fetchPerformanceByRoute(20, appId),
    fetchPerformanceTrend(appId),
  ]);

  const chartData = trend.map((p) => ({ day: fmtDay(p.day), load: p.loadP50Ms ?? 0 }));
  const hasData = kpis.samples > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Response Times"
        description="How fast do our products load for staff, and which pages are the slowest?"
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● {kpis.samples.toLocaleString()} load measurements
          </Badge>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Typical page speed" value={fmtMs(kpis.loadP50Ms)} icon={Gauge}
          trend={{ direction: 'flat', label: 'Half of loads faster than this' }} />
        <KpiCard label="Slowest loads (worst 5%)" value={fmtMs(kpis.loadP95Ms)} icon={Timer}
          trend={{ direction: kpis.loadP95Ms && kpis.loadP95Ms > 2500 ? 'up' : 'flat', label: 'Slowest experiences' }} invertTrend />
        <KpiCard label="Server first response" value={fmtMs(kpis.ttfbP50Ms)} icon={Zap}
          trend={{ direction: 'flat', label: 'Time to first byte' }} />
        <KpiCard label="Avg time spent per page" value={kpis.avgEngagedSec !== null ? `${kpis.avgEngagedSec}s` : '—'} icon={Activity}
          trend={{ direction: 'flat', label: 'Time on page per view' }} />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Gauge className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No performance samples yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Page speed is measured automatically each time a page loads in a connected product — no extra setup required.
          </p>
        </div>
      )}

      {chartData.length > 0 && (
        <ChartCard title="Page speed trend — last 14 days" description="The middle (median) load time each day. Under 1 second is fast; over 2.5 seconds needs attention.">
          <PerfTrendChart data={chartData} xKey="day"
            series={[{ dataKey: 'load', label: 'p50 load', color: CHART_COLORS.primary }]} height={240} />
        </ChartCard>
      )}

      {routes.length > 0 && (
        <ChartCard
          title="Slowest pages"
          description="The pages that take longest to load (last 7 days)"
          actions={
            <ExportButton
              filename="performance-routes"
              headers={['Route', 'Samples', 'p50 load (ms)', 'p95 load (ms)', 'TTFB avg (ms)']}
              rows={routes.map((r) => [r.route, r.samples, r.loadP50Ms ?? '', r.loadP95Ms ?? '', r.ttfbAvgMs ?? ''])}
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Page</th>
                  <th className="px-2 py-2 text-right font-medium">Measurements</th>
                  <th className="px-2 py-2 text-right font-medium">Typical speed</th>
                  <th className="px-2 py-2 text-right font-medium">Slow outliers</th>
                  <th className="px-2 py-2 text-right font-medium">Server response</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r: RoutePerformance) => (
                  <tr key={r.route} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2 font-mono text-[11px]">{r.route}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.samples}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${loadTone(r.loadP50Ms)}`}>{fmtMs(r.loadP50Ms)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${loadTone(r.loadP95Ms)}`}>{fmtMs(r.loadP95Ms)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtMs(r.ttfbAvgMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">How page speed is measured</div>
        <ol className="ml-4 list-decimal space-y-1">
          <li>Page speed is captured automatically each time any page loads in a connected product.</li>
          <li>We report &apos;typical&apos; and &apos;outlier&apos; speeds rather than averages, because a single very slow load shouldn&apos;t make everything else look bad.</li>
          <li>Pages are ranked by typical speed to surface the highest-impact ones to optimise.</li>
          <li>Engagement time is the visible time per page, flushed when the tab is hidden or closed.</li>
        </ol>
      </section>
    </div>
  );
}
