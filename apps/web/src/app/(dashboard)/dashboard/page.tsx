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
import { friendlyCategory } from '@/lib/event-labels';
import {
  fetchCategoryBreakdown,
  fetchDashboardKpis,
  fetchEventsTimeSeries,
  fetchCommandCenter,
  fetchOrgPulse,
  fetchProjectComparison,
  fetchRecentActivity,
  fetchReliabilityKpis,
} from '@/lib/data/fetchers';
import { AutoRefresh } from '@/components/AutoRefresh';
import { Card, CardContent } from '@/components/ui/card';
import { KeyRound, UserX } from 'lucide-react';
import { isOperationalEvent } from '@/lib/importance';
import { aggregateActivity } from '@/features/realtime-feed/aggregate';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ app?: string }>;
}

const fmt = new Intl.NumberFormat('en-US');

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

export default async function OrgOverviewPage({ searchParams }: PageProps) {
  const { app: selectedApp } = await searchParams;
  const [kpis, timeSeries, breakdown, activity, pulse, apps, reliability, command] = await Promise.all([
    fetchDashboardKpis(),
    fetchEventsTimeSeries(),
    fetchCategoryBreakdown(),
    fetchRecentActivity(60, selectedApp ?? undefined, 'debug'),
    fetchOrgPulse(),
    fetchProjectComparison(),
    fetchReliabilityKpis(),
    fetchCommandCenter(),
  ]);

  const eventSpark = timeSeries.map((p) => ({ value: p.events }));
  const userSpark = timeSeries.map((p) => ({ value: p.users }));
  const totalCategoryEvents = breakdown.reduce((sum, b) => sum + b.events, 0);
  const visibleApps = selectedApp ? apps.filter((a) => a.portalId === selectedApp) : apps;
  const unhealthy = visibleApps.filter((a) => a.events30d > 0 && a.errorRatePct >= 1).length;

  // Preserve the current Application scope when drilling into a KPI detail page.
  const scope = selectedApp ? `?app=${encodeURIComponent(selectedApp)}` : '';

  // Operational command-center feed: business-meaningful activity only, with
  // repeats collapsed — not a raw event stream.
  const operationalActivity = aggregateActivity(
    activity.filter((a) => isOperationalEvent(a.category, a.eventName)),
  ).slice(0, 10);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30_000} />
      <PageHeader
        title="Org Overview"
        description="Are all our products healthy and are our people actually using them today?"
        actions={
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            ● Live
          </Badge>
        }
      />

      {/* Org pulse — top-line KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Staff active today" value={fmt.format(kpis.activeUsers)} icon={Users}
          trend={halfWindowTrend(timeSeries.map((p) => p.users))} sparkline={userSpark}
          sparklineColor={CHART_COLORS.primary as string} href={`/dashboard/people${scope}`} />
        <KpiCard label="Sign-ins today" value={fmt.format(pulse.loginsToday)} icon={LogIn}
          trend={{ direction: 'flat', label: 'across all products' }} href={`/dashboard/logins${scope}`} />
        <KpiCard label="Work sessions today" value={fmt.format(kpis.totalSessions)} icon={Zap}
          trend={{ direction: 'flat', label: 'distinct working sessions' }} href={`/dashboard/sessions${scope}`} />
        <KpiCard label="Actions today" value={fmt.format(kpis.totalEvents)} icon={Activity}
          trend={halfWindowTrend(timeSeries.map((p) => p.events))} sparkline={eventSpark}
          sparklineColor={CHART_COLORS.emerald} />
        <KpiCard label="Problems today" value={fmt.format(reliability.totalErrors24h)} icon={AlertTriangle}
          trend={{ direction: reliability.totalErrors24h > 0 ? 'up' : 'flat', label: `${unhealthy} product(s) with problems` }}
          invertTrend href={`/dashboard/reliability${scope}`} />
        <KpiCard label="Platform health" value={`${reliability.errorFreePct}%`} icon={ShieldCheck}
          trend={{ direction: reliability.errorFreePct >= reliability.sloTargetPct ? 'flat' : 'down', label: 'problem-free sessions' }}
          href="/dashboard/health" />
      </section>

      {/* Executive command-center band — adoption signals from v_command_center */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Boxes className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Most-used product</div>
              <div className="truncate text-sm font-semibold">{command.mostUsedProject ?? '—'}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Boxes className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Least-adopted product</div>
              <div className="truncate text-sm font-semibold">{command.leastAdoptedProject ?? '—'}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <UserX className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Inactive staff (w/ access)</div>
              <div className="text-sm font-semibold tabular-nums">{fmt.format(command.inactiveUsersCount)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Granted, never used</div>
              <div className="text-sm font-semibold tabular-nums">{fmt.format(command.neverUsedAccessCount)}</div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Product status board */}
      <ChartCard
        title="Product status board"
        description="Every connected product: how many staff use it, how busy it is, and whether there are problems (last 30 days)"
        actions={
          <Badge variant="outline">
            <Boxes className="mr-1 h-3 w-3" /> {pulse.appsActive}/{pulse.appsTotal} active today
          </Badge>
        }
      >
        {visibleApps.length === 0 ? (
          <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Boxes className="h-6 w-6" />
            No products connected yet. Add your first product from{' '}
            <Link href="/dashboard/admin/projects" className="font-medium text-foreground hover:underline">
              Admin → Connected Products
            </Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Staff (7d)</th>
                  <th className="px-2 py-2 text-right font-medium">Staff (30d)</th>
                  <th className="px-2 py-2 text-right font-medium">Work sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Problems</th>
                  <th className="px-2 py-2 text-right font-medium">Problem rate</th>
                </tr>
              </thead>
              <tbody>
                {visibleApps.map((a) => {
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
          title="Platform activity today"
          description="How much happened and how many staff were active, hour by hour"
          className="xl:col-span-2"
          actions={<Badge variant="outline">24h</Badge>}
        >
          <EventsAreaChart
            data={timeSeries as unknown as Record<string, unknown>[]}
            xKey="ts"
            series={[
              { dataKey: 'events', label: 'Actions', color: CHART_COLORS.primary },
              { dataKey: 'users', label: 'Staff active', color: CHART_COLORS.emerald },
            ]}
            height={300}
          />
        </ChartCard>

        <ChartCard title="What staff did today" description="Breakdown of activity by type (last 24h)">
          <DonutChart
            data={breakdown.map((b) => {
              const color = CATEGORY_COLOR[b.category];
              return { name: friendlyCategory(b.category), value: b.events, ...(color ? { color } : {}) };
            })}
            centerLabel="Total"
            centerValue={fmt.format(totalCategoryEvents)}
            height={260}
          />
        </ChartCard>
      </section>

      {/* Live activity — operational, cross-project */}
      <ChartCard title="What's happening right now" description="Meaningful actions staff took across all products — logins, business actions, and problems">
        <ActivityFeed items={operationalActivity} empty="No operational activity in the last few minutes." />
      </ChartCard>

      <div className="text-[11px] text-muted-foreground">
        Product health is based on how often staff encounter errors. Green = working normally.
      </div>
    </div>
  );
}
