import { BarChart2, Layers, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { Sparkline } from '@/components/charts/Sparkline';
import { FeatureWeeklyChart } from '@/components/charts/FeatureWeeklyChart';
import { ExportButton } from '@/components/shared/ExportButton';
import { friendlyEventName } from '@/lib/event-labels';
import {
  fetchFeatureActions,
  fetchFeaturePortfolioStats,
  fetchFeatureSummaries,
  fetchFeatureWeeklyTrend,
} from '@/lib/data/fetchers';
import type { FeatureSummary } from '@/lib/repositories/features';

const FEATURE_COLORS: Record<string, string> = {
  board: '#6366f1', ticket: '#0ea5e9', tickets: '#0ea5e9', qa: '#10b981',
  dashboard: '#f59e0b', project: '#8b5cf6', settings: '#64748b',
};

function featureColor(name: string): string {
  return FEATURE_COLORS[name.toLowerCase()] ?? '#94a3b8';
}

function adoptionTone(pct: number): string {
  if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600  dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function fmtWeek(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function buildWeeklyChartData(
  trend: ReadonlyArray<{ feature: string; week: string; activeUsers: number }>,
  features: string[],
): Array<Record<string, unknown>> {
  const weekSet = new Set<string>();
  for (const p of trend) weekSet.add(p.week);
  const weeks = Array.from(weekSet).sort();
  const lookup = new Map<string, Map<string, number>>();
  for (const p of trend) {
    if (!lookup.has(p.week)) lookup.set(p.week, new Map());
    lookup.get(p.week)!.set(p.feature, p.activeUsers);
  }
  return weeks.map((week) => {
    const row: Record<string, unknown> = { week: fmtWeek(week) };
    for (const f of features) row[f] = lookup.get(week)?.get(f) ?? 0;
    return row;
  });
}

/** Feature adoption — the "Features" tab of Product Analytics. */
export async function FeaturesPanel({ appId }: { appId?: string | undefined }) {
  const [summaries, trend, actions, stats] = await Promise.all([
    fetchFeatureSummaries(appId),
    fetchFeatureWeeklyTrend(appId),
    fetchFeatureActions(undefined, appId),
    fetchFeaturePortfolioStats(),
  ]);

  const sparkByFeature = new Map<string, { value: number }[]>();
  for (const p of trend) {
    const arr = sparkByFeature.get(p.feature) ?? [];
    arr.push({ value: p.activeUsers });
    sparkByFeature.set(p.feature, arr);
  }

  const chartFeatures = summaries.map((s) => s.feature);
  const chartData = buildWeeklyChartData(trend, chartFeatures);
  const chartSeries = summaries.map((s) => ({ dataKey: s.feature, label: s.feature, color: featureColor(s.feature) }));

  const actionsByFeature = new Map<string, typeof actions>();
  for (const a of actions) {
    const arr = actionsByFeature.get(a.feature) ?? [];
    arr.push(a);
    actionsByFeature.set(a.feature, arr);
  }

  const hasData = summaries.length > 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Features" value={String(stats.activeFeatures)} icon={Layers}
          trend={{ direction: 'flat', label: 'With activity in last 28d' }} />
        <KpiCard label="Top Feature" value={stats.topFeature ?? '—'} icon={TrendingUp}
          trend={{ direction: 'flat', label: 'Most users (28d)' }} />
        <KpiCard label="Avg Adoption" value={stats.avgAdoptionPct !== null ? `${stats.avgAdoptionPct}%` : '—'} icon={Users}
          trend={{ direction: 'flat', label: 'Avg across all features' }} />
        <KpiCard label="Platform Usage 7d" value={stats.platformUsage7d !== null ? `${stats.platformUsage7d}%` : '—'} icon={BarChart2}
          trend={{ direction: 'flat', label: 'Users touched any feature' }} />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No named features tracked yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            This tab shows which <strong>named features</strong> people use. The auto-capture
            script records page views and clicks automatically; to see specific features here
            an app sends a named event, e.g.{' '}
            <code className="rounded bg-muted px-1 text-[10px]">window.ncpl.track(&apos;invoice.created&apos;)</code>.
            The word before the dot (&quot;invoice&quot;) becomes the feature shown here.
          </p>
        </div>
      )}

      {summaries.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s) => (
            <FeatureCard key={s.feature} summary={s} sparkData={sparkByFeature.get(s.feature) ?? []} color={featureColor(s.feature)} />
          ))}
        </section>
      )}

      {chartData.length > 0 && (
        <ChartCard
          title="How many people use each feature each week"
          description="Each colour is a feature; the height shows how many people used it that week (last 12 weeks)."
        >
          <FeatureWeeklyChart data={chartData} xKey="week" series={chartSeries} height={280} />
        </ChartCard>
      )}

      {actions.length > 0 && (
        <ChartCard
          title="What people did in each feature"
          description="The specific actions taken inside each feature (last 28 days)"
          actions={
            <ExportButton
              filename="feature-actions"
              headers={['Feature', 'Action', 'Events', 'Users', 'Sessions', 'Last seen']}
              rows={actions.map((a) => [a.feature, a.action, a.totalEvents, a.uniqueUsers, a.uniqueSessions, a.lastSeen])}
            />
          }
        >
          <div className="space-y-6">
            {Array.from(actionsByFeature.entries()).map(([feat, acts]) => (
              <div key={feat}>
                <div className="mb-2 flex items-center gap-2" style={{ color: featureColor(feat) }}>
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: featureColor(feat) }} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{feat}</span>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Action</th>
                        <th className="px-3 py-2 text-right font-medium">Events</th>
                        <th className="px-3 py-2 text-right font-medium">Users</th>
                        <th className="px-3 py-2 text-right font-medium">Sessions</th>
                        <th className="px-3 py-2 text-right font-medium">Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acts.map((a) => (
                        <tr key={a.action} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2"><span className="font-medium" title={a.action}>{friendlyEventName(a.action)}</span></td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{a.totalEvents.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{a.uniqueUsers}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{a.uniqueSessions}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDate(a.lastSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function FeatureCard({ summary: s, sparkData, color }: { summary: FeatureSummary; sparkData: { value: number }[]; color: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: color }} />
            <CardTitle className="text-sm font-semibold capitalize">{s.feature}</CardTitle>
          </div>
          <div className={`text-lg font-bold tabular-nums ${adoptionTone(s.adoptionPct28d)}`}>{s.adoptionPct28d}%</div>
        </div>
        <div className="text-[11px] text-muted-foreground">Adoption · first seen {fmtDate(s.firstSeen)}</div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="mb-3 h-10">
          {sparkData.length > 1 ? (
            <Sparkline data={sparkData} color={color} height={40} />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Insufficient data for trend</div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div><div className="text-muted-foreground">Users 7d</div><div className="font-semibold tabular-nums">{s.users7d}</div></div>
          <div><div className="text-muted-foreground">Users 28d</div><div className="font-semibold tabular-nums">{s.users28d}</div></div>
          <div><div className="text-muted-foreground">Events 7d</div><div className="font-semibold tabular-nums">{s.events7d.toLocaleString()}</div></div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
          <span>{s.appCount} {s.appCount === 1 ? 'application' : 'applications'}</span>
          <span className="tabular-nums">{s.totalEvents.toLocaleString()} events all-time</span>
        </div>
      </CardContent>
    </Card>
  );
}
