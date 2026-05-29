import Link from 'next/link';
import { Activity, AlertTriangle, Boxes, LogIn, ShieldCheck, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { ChartCard } from '@/components/charts/ChartCard';
import { EventsAreaChart } from '@/components/charts/EventsAreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { CATEGORY_COLOR, CHART_COLORS } from '@/components/charts/ChartTheme';
import {
  fetchCategoryBreakdown,
  fetchDashboardKpis,
  fetchEventsTimeSeries,
  fetchOrgPulse,
  fetchProjectComparison,
  fetchRecentActivity,
  fetchReliabilityKpis,
} from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

type Trend = { direction: 'up' | 'down' | 'flat'; label: string };

function halfWindowTrend(values: number[]): Trend {
  if (values.length < 4) return { direction: 'flat', label: 'rolling 24h' };
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = values.slice(mid).reduce((a, b) => a + b, 0);
  if (first === 0) return { direction: second > 0 ? 'up' : 'flat', label: second > 0 ? 'new activity' : 'no activity yet' };
  const change = ((second - first) / first) * 100;
  return { direction: change > 1 ? 'up' : change < -1 ? 'down' : 'flat', label: `${change > 0 ? '+' : ''}${change.toFixed(1)}% vs first 12h` };
}

function appStatus(errorRatePct: number, events30d: number) {
  if (events30d === 0) return { label: 'Idle', tone: 'text-muted-foreground', dot: 'bg-muted-foreground/50' };
  if (errorRatePct >= 5) return { label: 'Critical', tone: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' };
  if (errorRatePct >= 1) return { label: 'Degraded', tone: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
  return { label: 'Healthy', tone: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
}

export default async function CommandCenterPage() {
  const [kpis, timeSeries, breakdown, activity, pulse, apps, reliability] = await Promise.all([
    fetchDashboardKpis(),
    fetchEventsTimeSeries(),
    fetchCategoryBreakdown(),
    fetchRecentActivity(10),
    fetchOrgPulse(),
    fetchProjectComparison(),
    fetchReliabilityKpis(),
  ]);

  const eventSpark = timeSeries.map((p) => ({ value: p.events }));
  const userSpark = timeSeries.map((p) => ({ value: p.users }));
  const totalCategoryEvents = breakdown.reduce((sum, b) => sum + b.events, 0);
  const unhealthy = apps.filter((a) => a.events30d > 0 && a.errorRatePct >= 1).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Live operational view of every connected app — activity, logins, errors, and health."
        actions={
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            ● Live
          </Badge>
        }
      />

      {/* Org pulse */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active users (24h)" value={fmt.format(kpis.activeUsers)} icon={Users}
          trend={halfWindowTrend(timeSeries.map((p) => p.users))} sparkline={userSpark}
          sparklineColor={CHART_COLORS.primary as string} />
        <KpiCard label="Logins today" value={fmt.format(pulse.loginsToday)} icon={LogIn}
          trend={{ direction: 'flat', label: 'auth.login events' }} />
        <KpiCard label="Sessions (24h)" value={fmt.format(kpis.totalSessions)} icon={Zap}
          trend={{ direction: 'flat', label: 'visits' }} />
        <KpiCard label="Events (24h)" value={fmt.format(kpis.totalEvents)} icon={Activity}
          trend={halfWindowTrend(timeSeries.map((p) => p.events))} sparkline={eventSpark}
          sparklineColor={CHART_COLORS.emerald} />
        <KpiCard label="Errors (24h)" value={fmt.format(reliability.totalErrors24h)} icon={AlertTriangle}
          trend={{ direction: reliability.totalErrors24h > 0 ? 'up' : 'flat', label: `${unhealthy} app(s) with errors` }}
          invertTrend />
        <KpiCard label="Health" value={`${reliability.errorFreePct}%`} icon={ShieldCheck}
          trend={{ direction: reliability.errorFreePct >= reliability.sloTargetPct ? 'flat' : 'down', label: 'error-free sessions' }} />
      </section>

      {/* Per-app health & activity board */}
      <ChartCard
        title="Applications — health & activity"
        description="Every connected app: who's using it, how busy it is, and whether it's erroring (last 30 days)"
        actions={
          <Badge variant="outline">
            <Boxes className="mr-1 h-3 w-3" /> {pulse.appsActive}/{pulse.appsTotal} active today
          </Badge>
        }
      >
        {apps.length === 0 ? (
          <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Boxes className="h-6 w-6" />
            No applications are sending events yet. Onboard one from{' '}
            <Link href="/dashboard/admin/projects" className="font-medium text-foreground hover:underline">
              Admin → Projects
            </Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Application</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Active 7d</th>
                  <th className="px-2 py-2 text-right font-medium">Users 30d</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Errors</th>
                  <th className="px-2 py-2 text-right font-medium">Error rate</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => {
                  const s = appStatus(a.errorRatePct, a.events30d);
                  return (
                    <tr key={a.portalId} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/people?app=${a.portalId}`} className="font-medium hover:underline">
                          {a.portalName}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1.5 ${s.tone}`}>
                          <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(a.users7d)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(a.users30d)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(a.sessions30d)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(a.errors30d)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums font-medium ${s.tone}`}>{a.errorRatePct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Activity + categories */}
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
              return { name: b.category, value: b.events, ...(color ? { color } : {}) };
            })}
            centerLabel="Total"
            centerValue={fmt.format(totalCategoryEvents)}
            height={260}
          />
        </ChartCard>
      </section>

      {/* Live activity */}
      <ChartCard title="Latest activity" description="The most recent things people did across all apps">
        <ActivityFeed items={activity} />
      </ChartCard>

      <div className="text-[11px] text-muted-foreground">
        Error rate ≥ 1% = Degraded, ≥ 5% = Critical. Overall error rate (24h): {pct(kpis.errorRate)}.
      </div>
    </div>
  );
}
