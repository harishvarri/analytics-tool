import { Activity, AlertTriangle, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Centralized analytics across every internal NCPL portal."
        actions={
          <>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              ● Live · last 24h
            </Badge>
            <Button variant="outline" size="sm">Export</Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Users"
          value={fmt.format(kpis.activeUsers)}
          icon={Users}
          trend={{ direction: 'up', label: '+8.4% vs yesterday' }}
          sparkline={userSpark}
          sparklineColor={CHART_COLORS.primary as string}
        />
        <KpiCard
          label="Sessions (24h)"
          value={fmt.format(kpis.totalSessions)}
          icon={Zap}
          trend={{ direction: 'up', label: '+3.1%' }}
          sparkline={userSpark}
          sparklineColor={CHART_COLORS.sky}
        />
        <KpiCard
          label="Events (24h)"
          value={fmt.format(kpis.totalEvents)}
          icon={Activity}
          trend={{ direction: 'up', label: '+12.7%' }}
          sparkline={eventSpark}
          sparklineColor={CHART_COLORS.emerald}
        />
        <KpiCard
          label="Error Rate"
          value={pct(kpis.errorRate)}
          icon={AlertTriangle}
          trend={{ direction: 'down', label: '-0.04 pts' }}
          sparkline={eventSpark.map((p) => ({ value: Math.max(2, Math.round(p.value * kpis.errorRate)) }))}
          sparklineColor={CHART_COLORS.rose}
          invertTrend
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Events & users — last 24h"
          description="Hourly rollup across every portal"
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

        <ChartCard title="Event categories" description="Share of all events (24h)">
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
            Portals
          </h2>
          {portals.map((p) => (
            <PortalStatRow key={p.portalId} summary={p} />
          ))}
        </div>

        <ChartCard title="Live activity" description="Most recent events (mocked when DB empty)">
          <ActivityFeed items={activity} />
        </ChartCard>
      </section>
    </div>
  );
}
