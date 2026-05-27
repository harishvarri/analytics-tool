import { BarChart2, Layers, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { Sparkline } from '@/components/charts/Sparkline';
import { FeatureWeeklyChart } from '@/components/charts/FeatureWeeklyChart';
import { ExportButton } from '@/components/shared/ExportButton';
import {
  fetchFeatureActions,
  fetchFeaturePortfolioStats,
  fetchFeatureSummaries,
  fetchFeatureWeeklyTrend,
} from '@/lib/data/fetchers';
import type { FeatureDecayPoint, FeatureSummary } from '@/lib/repositories/features';

export const dynamic = 'force-dynamic';

// ── Palette — one colour per feature namespace ────────────────────────────────
const FEATURE_COLORS: Record<string, string> = {
  board:     '#6366f1',  // indigo
  ticket:    '#0ea5e9',  // sky
  tickets:   '#0ea5e9',  // (alias — same namespace family)
  qa:        '#10b981',  // emerald
  dashboard: '#f59e0b',  // amber
  project:   '#8b5cf6',  // violet
  settings:  '#64748b',  // slate
};

function featureColor(name: string): string {
  return FEATURE_COLORS[name.toLowerCase()] ?? '#94a3b8';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function adoptionTone(pct: number): string {
  if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600  dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function fmtWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ── Weekly chart data builder ─────────────────────────────────────────────────
// Pivots flat (feature, week, activeUsers) rows into recharts-compatible
// { week: string, [feature]: number }[] with all features as keys on each row.
function buildWeeklyChartData(
  trend: ReadonlyArray<{ feature: string; week: string; activeUsers: number }>,
  features: string[],
): Array<Record<string, unknown>> {
  // Collect all weeks in order
  const weekSet = new Set<string>();
  for (const p of trend) weekSet.add(p.week);
  const weeks = Array.from(weekSet).sort();

  // Build a lookup: week → feature → activeUsers
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FeaturesPage() {
  const [summaries, trend, actions, stats] = await Promise.all([
    fetchFeatureSummaries(),
    fetchFeatureWeeklyTrend(),
    fetchFeatureActions(),
    fetchFeaturePortfolioStats(),
  ]);

  // Sparkline data per feature: sorted by week, value = activeUsers
  const sparkByFeature = new Map<string, { value: number }[]>();
  for (const p of trend) {
    const arr = sparkByFeature.get(p.feature) ?? [];
    arr.push({ value: p.activeUsers });
    sparkByFeature.set(p.feature, arr);
  }

  // Weekly stacked chart
  const chartFeatures = summaries.map((s) => s.feature);
  const chartData = buildWeeklyChartData(trend, chartFeatures);
  const chartSeries = summaries.map((s) => ({
    dataKey: s.feature,
    label:   s.feature,
    color:   featureColor(s.feature),
  }));

  // Group actions by feature for the breakdown section
  const actionsByFeature = new Map<string, typeof actions>();
  for (const a of actions) {
    const arr = actionsByFeature.get(a.feature) ?? [];
    arr.push(a);
    actionsByFeature.set(a.feature, arr);
  }

  const hasData = summaries.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Adoption"
        description="Track which features users actually engage with across all connected applications."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● 28-day window
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Features"
          value={String(stats.activeFeatures)}
          icon={Layers}
          trend={{ direction: 'flat', label: 'With activity in last 28d' }}
        />
        <KpiCard
          label="Top Feature"
          value={stats.topFeature ?? '—'}
          icon={TrendingUp}
          trend={{ direction: 'flat', label: 'Most users (28d)' }}
        />
        <KpiCard
          label="Avg Adoption"
          value={stats.avgAdoptionPct !== null ? `${stats.avgAdoptionPct}%` : '—'}
          icon={Users}
          trend={{ direction: 'flat', label: 'Avg across all features' }}
        />
        <KpiCard
          label="Platform Usage 7d"
          value={stats.platformUsage7d !== null ? `${stats.platformUsage7d}%` : '—'}
          icon={BarChart2}
          trend={{ direction: 'flat', label: 'Users touched any feature' }}
        />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No feature events captured yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Feature events are <code className="rounded bg-muted px-1 text-[10px]">analyticsTrack()</code>{' '}
            calls from connected portals with a namespaced event name (e.g.{' '}
            <code className="rounded bg-muted px-1 text-[10px]">board.ticket_moved</code>).
            Auth, navigation, and session events are excluded and shown on their respective pages.
          </p>
        </div>
      )}

      {/* Feature card grid ─────────────────────────────────────────────────── */}
      {summaries.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s) => (
            <FeatureCard
              key={s.feature}
              summary={s}
              sparkData={sparkByFeature.get(s.feature) ?? []}
              color={featureColor(s.feature)}
            />
          ))}
        </section>
      )}

      {/* Weekly trend chart ─────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <ChartCard
          title="Weekly active users per feature"
          description="Stacked bars — each feature's weekly active user count over the last 12 weeks."
        >
          <FeatureWeeklyChart
            data={chartData}
            xKey="week"
            series={chartSeries}
            height={280}
          />
        </ChartCard>
      )}

      {/* Action breakdown ───────────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <ChartCard
          title="Action breakdown"
          description="Individual event actions fired within each feature namespace (last 28 days)"
          actions={
            <ExportButton
              filename="feature-actions"
              rows={actions}
              columns={[
                { header: 'Feature', accessor: (a) => a.feature },
                { header: 'Action', accessor: (a) => a.action },
                { header: 'Events', accessor: (a) => a.totalEvents },
                { header: 'Users', accessor: (a) => a.uniqueUsers },
                { header: 'Sessions', accessor: (a) => a.uniqueSessions },
                { header: 'Last seen', accessor: (a) => a.lastSeen },
              ]}
            />
          }
        >
          <div className="space-y-6">
            {Array.from(actionsByFeature.entries()).map(([feat, acts]) => (
              <div key={feat}>
                {/* Feature group header */}
                <div
                  className="mb-2 flex items-center gap-2"
                  style={{ color: featureColor(feat) }}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: featureColor(feat) }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider">{feat}</span>
                </div>

                {/* Actions mini-table */}
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
                          <td className="px-3 py-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{a.action}</code>
                          </td>
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

      {/* Methodology footer ─────────────────────────────────────────────────── */}
      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">How feature detection works</div>
        <ol className="ml-4 list-decimal space-y-1">
          <li>
            Every <code className="rounded bg-muted px-1 text-[10px]">analyticsTrack()</code> call
            produces an event with category <code className="rounded bg-muted px-1 text-[10px]">custom</code>.
          </li>
          <li>
            The <strong>feature namespace</strong> is extracted from the event name at the first dot
            — e.g. <code className="rounded bg-muted px-1 text-[10px]">board.ticket_moved</code> → feature{' '}
            <code className="rounded bg-muted px-1 text-[10px]">board</code>.
          </li>
          <li>
            Infrastructure events (<code className="rounded bg-muted px-1 text-[10px]">auth.*</code>,{' '}
            <code className="rounded bg-muted px-1 text-[10px]">navigation.*</code>,{' '}
            <code className="rounded bg-muted px-1 text-[10px]">session.*</code>) are excluded from
            all feature views and tracked on their dedicated pages.
          </li>
          <li>
            <strong>Adoption %</strong> = distinct users who triggered the feature in the last 28 days
            ÷ total distinct platform users in the same period.
          </li>
        </ol>
      </section>
    </div>
  );
}

// ── FeatureCard ───────────────────────────────────────────────────────────────

function FeatureCard({
  summary: s,
  sparkData,
  color,
}: {
  summary:   FeatureSummary;
  sparkData: { value: number }[];
  color:     string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: color }} />
            <CardTitle className="text-sm font-semibold capitalize">{s.feature}</CardTitle>
          </div>
          <div className={`text-lg font-bold tabular-nums ${adoptionTone(s.adoptionPct28d)}`}>
            {s.adoptionPct28d}%
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Adoption · first seen {fmtDate(s.firstSeen)}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Sparkline */}
        <div className="mb-3 h-10">
          {sparkData.length > 1 ? (
            <Sparkline data={sparkData} color={color} height={40} />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
              Insufficient data for trend
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-muted-foreground">Users 7d</div>
            <div className="font-semibold tabular-nums">{s.users7d}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Users 28d</div>
            <div className="font-semibold tabular-nums">{s.users28d}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Events 7d</div>
            <div className="font-semibold tabular-nums">{s.events7d.toLocaleString()}</div>
          </div>
        </div>

        {/* Footer: app count */}
        <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
          <span>
            {s.appCount} {s.appCount === 1 ? 'application' : 'applications'}
          </span>
          <span className="tabular-nums">{s.totalEvents.toLocaleString()} events all-time</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── DecayRow (kept for future decay table — data available via v_feature_decay) ──
// Exporting type for completeness; not rendered in this version.
export type { FeatureDecayPoint };
