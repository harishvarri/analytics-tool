import { Activity, AlertTriangle, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { PortalStatRow } from '@/components/analytics/PortalStatRow';
import { ChartCard } from '@/components/charts/ChartCard';
import { EventsAreaChart } from '@/components/charts/EventsAreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { CATEGORY_COLOR, CHART_COLORS } from '@/components/charts/ChartTheme';
import {
  fetchCategoryBreakdown,
  fetchDashboardKpis,
  fetchEventsTimeSeries,
  fetchPortalSummaries,
  fetchRecentActivity,
} from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

type Trend = { direction: 'up' | 'down' | 'flat'; label: string };

/**
 * Honest, derived trend: compares the second half of the 24h window to the
 * first half. No fabricated "vs yesterday" numbers — everything is computed
 * from the data actually on screen.
 */
function halfWindowTrend(values: number[]): Trend {
  if (values.length < 4) return { direction: 'flat', label: 'rolling 24h' };
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = values.slice(mid).reduce((a, b) => a + b, 0);
  if (first === 0) {
    return second > 0
      ? { direction: 'up', label: 'new activity this window' }
      : { direction: 'flat', label: 'no activity yet' };
  }
  const change = ((second - first) / first) * 100;
  const dir: Trend['direction'] = change > 1 ? 'up' : change < -1 ? 'down' : 'flat';
  const sign = change > 0 ? '+' : '';
  return { direction: dir, label: `${sign}${change.toFixed(1)}% vs first 12h` };
}

export default async function DashboardOverviewPage() {
  const [kpis, timeSeries, breakdown, portals, activity] = await Promise.all([
    fetchDashboardKpis(),
    fetchEventsTimeSeries(),
    fetchCategoryBreakdown(),
    fetchPortalSummaries(),
    fetchRecentActivity(10),
  ]);

  const eventSpark = timeSeries.map((p) => ({ value: p.events }));
  const userSpark = timeSeries.map((p) => ({ value: p.users }));
  const totalCategoryEvents = breakdown.reduce((sum, b) => sum + b.events, 0);

  const usersTrend = halfWindowTrend(timeSeries.map((p) => p.users));
  const eventsTrend = halfWindowTrend(timeSeries.map((p) => p.events));
  const errorTrend: Trend =
    kpis.errorRate <= 0.01
      ? { direction: 'flat', label: 'within healthy range' }
      : { direction: 'up', label: 'above 1% threshold' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="A single view of everything happening across all your connected apps."
        actions={
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            ● Live · last 24h
          </Badge>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Users"
          value={fmt.format(kpis.activeUsers)}
          icon={Users}
          trend={usersTrend}
          sparkline={userSpark}
          sparklineColor={CHART_COLORS.primary as string}
        />
        <KpiCard
          label="Sessions (24h)"
          value={fmt.format(kpis.totalSessions)}
          icon={Zap}
          trend={{ direction: 'flat', label: 'rolling 24h total' }}
        />
        <KpiCard
          label="Events (24h)"
          value={fmt.format(kpis.totalEvents)}
          icon={Activity}
          trend={eventsTrend}
          sparkline={eventSpark}
          sparklineColor={CHART_COLORS.emerald}
        />
        <KpiCard
          label="Error Rate"
          value={pct(kpis.errorRate)}
          icon={AlertTriangle}
          trend={errorTrend}
          invertTrend
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Activity over the last 24 hours"
          description="How much happened and how many people were active, hour by hour"
          className="xl:col-span-2"
          actions={<Badge variant="outline">24h</Badge>}
        >
          <EventsAreaChart
            data={timeSeries as unknown as Record<string, unknown>[]}
            xKey="ts"
            series={[
              { dataKey: 'events', label: 'Events', color: CHART_COLORS.primary },
              { dataKey: 'users', label: 'Active users', color: CHART_COLORS.emerald },
            ]}
            height={300}
          />
        </ChartCard>

        <ChartCard title="What kinds of activity" description="Breakdown of activity by type (last 24h)">
          <DonutChart
            data={breakdown.map((b) => {
              const color = CATEGORY_COLOR[b.category];
              return {
                name: b.category,
                value: b.events,
                ...(color ? { color } : {}),
              };
            })}
            centerLabel="Total"
            centerValue={fmt.format(totalCategoryEvents)}
            height={260}
          />
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Applications
          </h2>
          {portals.length > 0 ? (
            portals.map((p) => <PortalStatRow key={p.portalId} summary={p} />)
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No applications are sending events yet. Onboard one from{' '}
              <span className="font-medium text-foreground">Admin → Projects</span>.
            </div>
          )}
        </div>

        <ChartCard title="Latest activity" description="The most recent things people did">
          <ActivityFeed items={activity} />
        </ChartCard>
      </section>
    </div>
  );
}
