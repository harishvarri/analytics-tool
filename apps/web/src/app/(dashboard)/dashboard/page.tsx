import Link from 'next/link';
import { Activity, ChevronRight, LogIn, ShieldAlert, UserCheck, UserMinus, Users, Zap } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { Badge } from '@/components/ui/badge';
import {
  fetchActiveUserCounts,
  fetchCommandCenter,
  fetchOrgPulse,
  fetchPlatformHealth,
  fetchRecentActivity,
  fetchUserProfileSummaries,
} from '@/lib/data/fetchers';
import { isOperationalEvent } from '@/lib/importance';
import { aggregateActivity } from '@/features/realtime-feed/aggregate';
import { riskFromLastActive } from '@/lib/user-risk';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

export default async function ExecutiveDashboard() {
  const [active, pulse, command, people, rawActivity, health] = await Promise.all([
    fetchActiveUserCounts(),
    fetchOrgPulse(),
    fetchCommandCenter(),
    fetchUserProfileSummaries(300),
    fetchRecentActivity(60, undefined, 'debug'),
    fetchPlatformHealth(),
  ]);

  const withActivity = people.filter((p) => p.totalEvents > 0);
  const mostActive = [...withActivity].sort((a, b) => b.totalEvents - a.totalEvents).slice(0, 8);
  const goneQuiet = people
    .map((p) => ({ p, risk: riskFromLastActive(p.lastActiveAt) }))
    .filter((x) => x.risk.level !== 'green')
    .sort((a, b) => new Date(a.p.lastActiveAt ?? 0).getTime() - new Date(b.p.lastActiveAt ?? 0).getTime())
    .slice(0, 10);
  const namedStaff = people.filter((p) => p.email).length;

  // Live operational activity — who did what across products (page-view noise hidden).
  const liveActivity = aggregateActivity(
    rawActivity.filter((a) => isOperationalEvent(a.category, a.eventName)),
  ).slice(0, 12);

  const needsAttention = health.warning + health.critical;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        description="Who is working across the organization right now — activity, sign-ins, and the people behind it."
        actions={<Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">● Live</Badge>}
      />

      {/* USER KPI band — the focus */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active today" value={fmt.format(active.dau)} icon={Users}
          trend={{ direction: 'flat', label: 'staff active in 24h' }} href="/dashboard/people" />
        <KpiCard label="Active this week" value={fmt.format(active.wau)} icon={Users}
          trend={{ direction: 'flat', label: 'last 7 days' }} href="/dashboard/people" />
        <KpiCard label="Active this month" value={fmt.format(active.mau)} icon={Users}
          trend={{ direction: 'flat', label: 'last 30 days' }} href="/dashboard/people" />
        <KpiCard label="Sign-ins today" value={fmt.format(pulse.loginsToday)} icon={LogIn}
          trend={{ direction: 'flat', label: 'across all products' }} href="/dashboard/logins" />
        <KpiCard label="Sessions today" value={fmt.format(command.sessionsToday)} icon={Zap}
          trend={{ direction: 'flat', label: 'work sessions' }} href="/dashboard/sessions" />
        <KpiCard label="Identified staff" value={fmt.format(namedStaff)} icon={UserCheck}
          trend={{ direction: 'flat', label: `of ${fmt.format(people.length)} tracked` }} href="/dashboard/people" />
      </section>

      {/* Who is active + who went quiet */}
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Most active staff" description="Who's getting the most done across products — click anyone for their profile">
          {mostActive.length === 0 ? (
            <Empty hint="No staff activity recorded yet." />
          ) : (
            <ul className="divide-y">
              {mostActive.map((p) => {
                const risk = riskFromLastActive(p.lastActiveAt);
                return (
                  <li key={p.userId} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <Link href={`/dashboard/people/${p.userId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${risk.dot}`} title={risk.label} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.displayName ?? p.email ?? p.userId.slice(0, 8)}</span>
                        {p.department && <span className="block truncate text-[10px] text-muted-foreground">{p.department}</span>}
                      </span>
                    </Link>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmt.format(p.totalEvents)} actions · {fmt.format(p.appsUsed)} app{p.appsUsed === 1 ? '' : 's'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title="Staff who went quiet"
          description="Recently active people who haven't returned — follow up before they churn"
          actions={goneQuiet.length > 0 ? <Badge variant="outline" className="text-[10px]">{goneQuiet.length}</Badge> : undefined}
        >
          {goneQuiet.length === 0 ? (
            <Empty hint="Everyone recently active is still engaged." />
          ) : (
            <ul className="divide-y">
              {goneQuiet.map(({ p, risk }) => (
                <li key={p.userId} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <Link href={`/dashboard/people/${p.userId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${risk.dot}`} title={risk.label} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.displayName ?? p.email ?? p.userId.slice(0, 8)}</span>
                      {p.department && <span className="block truncate text-[10px] text-muted-foreground">{p.department}</span>}
                    </span>
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {p.lastActiveAt ? `${Math.floor((Date.now() - new Date(p.lastActiveAt).getTime()) / 86400000)}d ago` : 'never'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </section>

      {/* Live operational activity — who did what right now */}
      <ChartCard
        title="What people are doing now"
        description="Live business activity across every product — page views and clicks hidden"
        actions={<Link href="/dashboard/realtime" className="text-xs text-primary hover:underline">Live Activity →</Link>}
      >
        <ActivityFeed items={liveActivity} empty="No operational activity in the last few minutes." />
      </ChartCard>

      {/* SECONDARY: compact health summary — not the focus, links out for detail */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/operations" className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Org health</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary" />
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{health.overallScore}</div>
          <div className="text-[11px] text-muted-foreground">platform health score</div>
        </Link>
        <Link href="/dashboard/health" className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md hover:border-primary/40">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Products need attention</span>
          <div className={`mt-1 text-2xl font-bold tabular-nums ${needsAttention > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{needsAttention}</div>
          <div className="text-[11px] text-muted-foreground">{health.healthy} healthy · {health.totalProjects} total</div>
        </Link>
        <Link href="/dashboard/reliability" className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md hover:border-primary/40">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Errors today</span>
          <div className={`mt-1 text-2xl font-bold tabular-nums ${command.errorsToday > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{fmt.format(command.errorsToday)}</div>
          <div className="text-[11px] text-muted-foreground">across all products</div>
        </Link>
        <Link href="/dashboard/people" className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Inactive staff</span>
            <UserMinus className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{fmt.format(command.inactiveUsersCount)}</div>
          <div className="text-[11px] text-muted-foreground">have access, gone quiet</div>
        </Link>
      </section>

      {health.critical_projects.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            {needsAttention} product{needsAttention === 1 ? '' : 's'} need attention —{' '}
            {health.critical_projects.slice(0, 2).map((c) => c.name).join(', ')}
            {health.critical_projects.length > 2 ? '…' : ''}.
          </span>
          <Link href="/dashboard/operations" className="ml-auto shrink-0 font-medium text-primary hover:underline">
            Why &amp; actions →
          </Link>
        </div>
      )}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-center">
      <Activity className="h-5 w-5 text-muted-foreground" />
      <p className="max-w-[32ch] text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
