import Link from 'next/link';
import {
  Activity, AlertOctagon, AlertTriangle, ArrowRight, Bug, CheckCircle2, ChevronRight,
  Crown, Gauge, ShieldAlert, TrendingDown, TrendingUp, UserMinus,
  UserPlus, Users, Zap,
} from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { Badge } from '@/components/ui/badge';
import {
  fetchActiveUserCounts,
  fetchCommandCenter,
  fetchIncidents,
  fetchInsights,
  fetchOrgPulse,
  fetchRecentActivity,
  fetchUserProfileSummaries,
} from '@/lib/data/fetchers';
import { isOperationalEvent } from '@/lib/importance';
import { aggregateActivity } from '@/features/realtime-feed/aggregate';
import { riskFromLastActive, daysSince } from '@/lib/user-risk';
import { computeProductivity } from '@/lib/productivity';
import { friendlyEventName } from '@/lib/event-labels';
import type { UserProfileSummary } from '@/lib/repositories/operational';
import type { RealtimeActivityItem } from '@/types/analytics';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

type DeltaLike = { direction: 'up' | 'down' | 'flat'; deltaPct: number | null };

function deltaTrend(d: DeltaLike, suffix = 'vs last week'): { direction: 'up' | 'down' | 'flat'; label: string } {
  if (d.deltaPct === null) return { direction: 'flat', label: suffix };
  const sign = d.deltaPct > 0 ? '+' : '';
  return { direction: d.direction, label: `${sign}${d.deltaPct}% ${suffix}` };
}

/** Productivity proxy from the per-user signals we have (no extra queries). */
function userProductivity(p: UserProfileSummary) {
  return computeProductivity({
    activeMinutes: p.totalSessions * 8, // proxy: ~8 min / session
    businessActions: p.totalEvents,
    sessions: p.totalSessions,
    productsUsed: p.appsUsed,
    errors: 0,
  });
}

const bandTone: Record<'high' | 'medium' | 'low', string> = {
  high: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  medium: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  low: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
};

/** Lightweight per-user journeys from the live activity stream (no extra queries). */
function buildJourneys(activity: RealtimeActivityItem[], max = 3) {
  const byUser = new Map<string, RealtimeActivityItem[]>();
  for (const a of activity) {
    if (!a.userId || !(a.userDisplayName || a.userEmail)) continue;
    const arr = byUser.get(a.userId) ?? [];
    arr.push(a);
    byUser.set(a.userId, arr);
  }
  return Array.from(byUser.entries())
    .map(([userId, items]) => {
      // activity arrives newest-first → reverse for chronological journey
      const chron = [...items].reverse();
      const steps: string[] = [];
      for (const it of chron) {
        const label = friendlyEventName(it.eventName, it.metadata, it.url);
        if (steps[steps.length - 1] !== label) steps.push(label);
      }
      const head = chron[0];
      return {
        userId,
        name: head?.userDisplayName ?? head?.userEmail ?? userId.slice(0, 8),
        product: head?.portalName ?? '',
        steps: steps.slice(0, 6),
      };
    })
    .filter((j) => j.steps.length >= 3)
    .sort((a, b) => b.steps.length - a.steps.length)
    .slice(0, max);
}

function productRisk(row: { healthScore: number; errorCount: number; trend: string }): { label: string; tone: string } {
  if (row.healthScore < 60 || row.errorCount > 20) return { label: 'High', tone: 'text-rose-600 dark:text-rose-400' };
  if (row.healthScore < 80 || row.trend === 'Declining' || row.errorCount > 0) return { label: 'Medium', tone: 'text-amber-600 dark:text-amber-400' };
  return { label: 'Low', tone: 'text-emerald-600 dark:text-emerald-400' };
}

const trendTone: Record<string, string> = {
  Growing: 'text-emerald-600 dark:text-emerald-400',
  New: 'text-sky-600 dark:text-sky-400',
  Stable: 'text-muted-foreground',
  Declining: 'text-rose-600 dark:text-rose-400',
  Inactive: 'text-rose-600 dark:text-rose-400',
};

export default async function ExecutiveDashboard() {
  const [active, command, pulse, people, rawActivity, report, incidents] = await Promise.all([
    fetchActiveUserCounts(),
    fetchCommandCenter(),
    fetchOrgPulse(),
    fetchUserProfileSummaries(300),
    fetchRecentActivity(80, undefined, 'debug'),
    fetchInsights(),
    fetchIncidents(),
  ]);

  const eng = report.engagement;

  // ── Derived people intelligence ─────────────────────────────────────────────
  const ranked = people
    .filter((p) => p.totalEvents > 0)
    .map((p) => ({ p, prod: userProductivity(p), risk: riskFromLastActive(p.lastActiveAt), days: daysSince(p.lastActiveAt) }))
    .sort((a, b) => b.p.totalEvents - a.p.totalEvents);

  const topToday = ranked.filter((r) => r.days !== null && r.days < 1).sort((a, b) => b.prod.score - a.prod.score)[0];
  const topWeek = ranked.filter((r) => r.days !== null && r.days < 7).sort((a, b) => b.prod.score - a.prod.score)[0];
  const topMonth = ranked.filter((r) => r.days !== null && r.days < 30).sort((a, b) => b.prod.score - a.prod.score)[0];

  const leaderboard = ranked.slice(0, 8);
  const topPerformers = [...ranked].sort((a, b) => b.prod.score - a.prod.score).slice(0, 5);
  const needsAttention = ranked.filter((r) => r.risk.level !== 'green').sort((a, b) => (b.days ?? 0) - (a.days ?? 0)).slice(0, 5);
  const churnRisk = ranked.filter((r) => r.risk.level === 'yellow').length; // were active, now quiet 7–30d

  // ── Live operational feed (business actions only) ────────────────────────────
  const liveActivity = aggregateActivity(rawActivity.filter((a) => isOperationalEvent(a.category, a.eventName))).slice(0, 10);
  const journeys = buildJourneys(rawActivity);

  // ── Product intelligence (from the weekly report) ────────────────────────────
  const products = report.productRanking;
  const adoption = report.adoption;

  // ── Operational intelligence ─────────────────────────────────────────────────
  const openIncidents = incidents.open;
  const criticalIncidents = incidents.critical;
  const errorsToday = command.errorsToday;
  const riskAlerts = report.risks.length;

  // ── Executive insights & recommendations ─────────────────────────────────────
  const recs = report.recommendations;
  const byPriority = (p: 'high' | 'medium' | 'low') => recs.filter((r) => r.priority === p);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Executive Command Center"
        description="Who is working, what they're doing, which products are used, and what needs management attention — at a glance."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">● Live</Badge>
            <Link href="/dashboard/insights" className="text-xs text-primary hover:underline">Weekly report →</Link>
          </div>
        }
      />

      {/* ─── SECTION 1 · Organization Pulse ─────────────────────────────────── */}
      <Section title="Organization Pulse" subtitle="Today across every connected product — click any metric to drill in">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Active today" value={fmt.format(active.dau)} icon={Users}
            trend={deltaTrend(eng.activeUsers)} href="/dashboard/people" />
          <KpiCard label="Active this week" value={fmt.format(active.wau)} icon={Users}
            trend={{ direction: 'flat', label: `${active.stickinessPct}% stickiness` }} href="/dashboard/people" />
          <KpiCard label="Sessions today" value={fmt.format(command.sessionsToday)} icon={Zap}
            trend={deltaTrend(eng.sessions)} href="/dashboard/sessions" />
          <KpiCard label="Actions today" value={fmt.format(command.eventsToday)} icon={Activity}
            trend={{ direction: 'flat', label: 'business + system events' }} href="/dashboard/realtime" />
          <KpiCard label="Connected products" value={fmt.format(pulse.appsTotal)} icon={Gauge}
            trend={{ direction: 'flat', label: `${pulse.appsActive} active now` }} href="/dashboard/portals" />
          <KpiCard label="Platform health" value={`${report.scorecard.platformHealth}`} icon={ShieldAlert}
            trend={{ direction: 'flat', label: report.platformStatus }} href="/dashboard/operations" />
        </div>
      </Section>

      {/* ─── SECTION 2 · Top Active Users ──────────────────────────────────── */}
      <Section title="Top Active Users" subtitle="The people getting the most done — click anyone for their full profile"
        href="/dashboard/people" linkLabel="All staff">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <TopUserCard label="Top performer today" entry={topToday} />
          <TopUserCard label="Top performer this week" entry={topWeek} />
          <TopUserCard label="Top performer this month" entry={topMonth} />
        </div>
        <ChartCard title="Activity leaderboard" description="Ranked by actions performed across all products">
          {leaderboard.length === 0 ? (
            <Empty hint="No staff activity recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">User</th>
                    <th className="px-2 py-2 text-right font-medium">Actions</th>
                    <th className="px-2 py-2 text-right font-medium">Sessions</th>
                    <th className="px-2 py-2 text-right font-medium">Products</th>
                    <th className="px-2 py-2 text-right font-medium">Productivity</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaderboard.map(({ p, prod, risk }, i) => (
                    <tr key={p.userId} className="group hover:bg-muted/40">
                      <td className="py-2 pr-2">
                        <Link href={`/dashboard/people/${p.userId}`} className="flex items-center gap-2 hover:underline">
                          <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${risk.dot}`} title={risk.label} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{p.displayName ?? p.email ?? p.userId.slice(0, 8)}</span>
                            {p.department && <span className="block truncate text-[10px] text-muted-foreground">{p.department}</span>}
                          </span>
                          {i === 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(p.totalEvents)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(p.totalSessions)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(p.appsUsed)}</td>
                      <td className="px-2 py-2 text-right">
                        <Badge variant="outline" className={`tabular-nums ${bandTone[prod.band]}`}>{prod.score}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboard[0] && (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{leaderboard[0].p.displayName ?? leaderboard[0].p.email}</span>{' '}
                  performed {fmt.format(leaderboard[0].p.totalEvents)} actions across {leaderboard[0].p.appsUsed}{' '}
                  product{leaderboard[0].p.appsUsed === 1 ? '' : 's'} in {fmt.format(leaderboard[0].p.totalSessions)} sessions.
                </p>
              )}
            </div>
          )}
        </ChartCard>
      </Section>

      {/* ─── SECTION 3 · User Activity Intelligence ────────────────────────── */}
      <Section title="User Activity Intelligence" subtitle="How the user base is moving — new, returning, and at-risk staff">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="New users" value={fmt.format(eng.newUsers)} icon={UserPlus}
            trend={{ direction: 'flat', label: 'first seen this week' }} href="/dashboard/people" />
          <KpiCard label="Returning users" value={fmt.format(eng.returningUsers)} icon={Users}
            trend={deltaTrend(eng.activeUsers)} href="/dashboard/people" />
          <KpiCard label="Inactive (have access)" value={fmt.format(command.inactiveUsersCount)} icon={UserMinus}
            trend={{ direction: 'flat', label: 'gone quiet' }} href="/dashboard/retention" />
          <KpiCard label="Churn-risk users" value={fmt.format(churnRisk)} icon={AlertTriangle} invertTrend
            trend={{ direction: churnRisk > 0 ? 'up' : 'flat', label: 'active → quiet 7d+' }} href="/dashboard/retention" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{eng.trend}.</p>
      </Section>

      {/* ─── SECTION 4 · Live Operations Feed ──────────────────────────────── */}
      <Section title="Live Operations Feed" subtitle="What people are doing right now — page views and clicks hidden"
        href="/dashboard/realtime" linkLabel="Full live stream">
        <ChartCard title="Recent business activity" description="Meaningful actions across every product">
          <ActivityFeed items={liveActivity} empty="No operational activity in the last few minutes." />
        </ChartCard>
      </Section>

      {/* ─── SECTION 5 · Product Intelligence ──────────────────────────────── */}
      <Section title="Product Intelligence" subtitle="Which products are used, healthy, growing, or need attention"
        href="/dashboard/portals" linkLabel="All products">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdoptionCard label="Most used" insight={adoption.mostUsed?.feature} sub={products[0]?.name} tone="text-emerald-600 dark:text-emerald-400" icon={TrendingUp} />
          <AdoptionCard label="Fastest growing" insight={adoption.fastestGrowing?.feature} sub={adoption.fastestGrowing ? `+${adoption.fastestGrowing.growthPct ?? 0}%` : undefined} tone="text-sky-600 dark:text-sky-400" icon={TrendingUp} />
          <AdoptionCard label="Needs attention" insight={products.find((p) => p.healthScore < 70)?.name} sub="low health" tone="text-amber-600 dark:text-amber-400" icon={AlertTriangle} />
          <AdoptionCard label="Declining" insight={adoption.declining?.feature} sub={adoption.declining ? `${adoption.declining.growthPct ?? 0}%` : undefined} tone="text-rose-600 dark:text-rose-400" icon={TrendingDown} />
        </div>
        <ChartCard title="Product scorecard" description="Users, health, trend and risk per product">
          {products.length === 0 ? (
            <Empty hint="No product activity recorded this week." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Product</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                    <th className="px-2 py-2 text-right font-medium">Health</th>
                    <th className="px-2 py-2 text-right font-medium">Trend</th>
                    <th className="px-2 py-2 text-right font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((row) => {
                    const risk = productRisk(row);
                    return (
                      <tr key={row.slug} className="hover:bg-muted/40">
                        <td className="py-2 pr-2">
                          <Link href={`/dashboard/projects/${row.slug}`} className="font-medium hover:underline">{row.name}</Link>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt.format(row.activeUsers)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.healthScore}</td>
                        <td className={`px-2 py-2 text-right text-xs font-medium ${trendTone[row.trend] ?? 'text-muted-foreground'}`}>
                          {row.trend}{row.weeklyGrowthPct !== null ? ` ${row.weeklyGrowthPct > 0 ? '+' : ''}${row.weeklyGrowthPct}%` : ''}
                        </td>
                        <td className={`px-2 py-2 text-right text-xs font-medium ${risk.tone}`}>{risk.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </Section>

      {/* ─── SECTION 6 · User Journey Intelligence ─────────────────────────── */}
      <Section title="User Journey Intelligence" subtitle="How people are moving through the products right now">
        <div className="grid gap-4 lg:grid-cols-3">
          {journeys.length === 0 ? (
            <div className="lg:col-span-3"><Empty hint="Not enough recent multi-step activity to chart journeys." /></div>
          ) : (
            journeys.map((j) => (
              <Link key={j.userId} href={`/dashboard/people/${j.userId}`}
                className="rounded-lg border bg-card p-4 transition-shadow hover:border-primary/40 hover:shadow-md">
                <div className="mb-2 flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{j.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{j.product}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  {j.steps.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="rounded bg-muted px-1.5 py-0.5">{s}</span>
                      {i < j.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}
                    </span>
                  ))}
                </div>
              </Link>
            ))
          )}
        </div>
      </Section>

      {/* ─── SECTION 7 · Executive Insights ────────────────────────────────── */}
      <Section title="Executive Insights" subtitle="What changed and what to watch this week"
        href="/dashboard/insights" linkLabel="Weekly report">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="What changed" description="Auto-generated summary of the week">
            <ul className="space-y-2">
              {report.executiveSummary.slice(0, 6).map((line, i) => {
                const positive = /increas|improv|grew|grow|up |higher|added|healthy/i.test(line) && !/fail|error|drop|declin|down/i.test(line);
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {positive
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                    <span className="text-muted-foreground">{line}</span>
                  </li>
                );
              })}
              {report.executiveSummary.length === 0 && <Empty hint="No notable changes this week." />}
            </ul>
          </ChartCard>
          <ChartCard title="Risks to watch" description="Signals that may need management action"
            actions={report.risks.length > 0 ? <Badge variant="outline" className="text-[10px]">{report.risks.length}</Badge> : undefined}>
            {report.risks.length === 0 ? (
              <Empty hint="No active risks detected." />
            ) : (
              <ul className="space-y-3">
                {report.risks.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <PriorityDot p={r.priority} />
                      <span className="font-medium">{r.title}</span>
                    </div>
                    <p className="ml-4 mt-0.5 text-xs text-muted-foreground">{r.recommendedAction}</p>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </Section>

      {/* ─── SECTION 8 · Productivity Intelligence ─────────────────────────── */}
      <Section title="Productivity Intelligence" subtitle="Who is performing and who needs a check-in"
        href="/dashboard/people" linkLabel="All staff">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Top performers" description="Highest productivity across products this period">
            {topPerformers.length === 0 ? <Empty hint="No productivity data yet." /> : (
              <ul className="divide-y">
                {topPerformers.map(({ p, prod }) => (
                  <li key={p.userId} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <Link href={`/dashboard/people/${p.userId}`} className="min-w-0 truncate font-medium hover:underline">
                      {p.displayName ?? p.email ?? p.userId.slice(0, 8)}
                    </Link>
                    <Badge variant="outline" className={`shrink-0 tabular-nums ${bandTone[prod.band]}`}>{prod.score}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
          <ChartCard title="Requiring attention" description="Recently active staff who have gone quiet">
            {needsAttention.length === 0 ? <Empty hint="Everyone recently active is still engaged." /> : (
              <ul className="divide-y">
                {needsAttention.map(({ p, risk, days }) => (
                  <li key={p.userId} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <Link href={`/dashboard/people/${p.userId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${risk.dot}`} />
                      <span className="min-w-0 truncate font-medium">{p.displayName ?? p.email ?? p.userId.slice(0, 8)}</span>
                    </Link>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{days === null ? 'never' : `${days}d ago`}</span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </Section>

      {/* ─── SECTION 9 · Operational Intelligence ──────────────────────────── */}
      <Section title="Operational Intelligence" subtitle="Incidents, errors and risks — supporting view">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Open incidents" value={fmt.format(openIncidents)} icon={AlertOctagon} invertTrend
            trend={{ direction: openIncidents > 0 ? 'up' : 'flat', label: 'auto-detected' }} href="/dashboard/incidents" />
          <KpiCard label="Critical incidents" value={fmt.format(criticalIncidents)} icon={ShieldAlert} invertTrend
            trend={{ direction: criticalIncidents > 0 ? 'up' : 'flat', label: 'need action now' }} href="/dashboard/incidents" />
          <KpiCard label="Errors today" value={fmt.format(errorsToday)} icon={Bug} invertTrend
            trend={{ direction: errorsToday > 0 ? 'up' : 'flat', label: 'across all products' }} href="/dashboard/reliability" />
          <KpiCard label="Risk alerts" value={fmt.format(riskAlerts)} icon={AlertTriangle} invertTrend
            trend={{ direction: riskAlerts > 0 ? 'up' : 'flat', label: 'this week' }} href="/dashboard/anomalies" />
        </div>
      </Section>

      {/* ─── SECTION 10 · Recommended Actions ──────────────────────────────── */}
      <Section title="Recommended Actions" subtitle="What management should do next"
        href="/dashboard/insights" linkLabel="Full report">
        <div className="grid gap-4 lg:grid-cols-3">
          <RecColumn title="High priority" items={byPriority('high')} priority="high" />
          <RecColumn title="Medium priority" items={byPriority('medium')} priority="medium" />
          <RecColumn title="Low priority" items={byPriority('low')} priority="low" />
        </div>
      </Section>
    </div>
  );
}

/* ── Local presentational components ──────────────────────────────────────── */

function Section({ title, subtitle, href, linkLabel, children }: {
  title: string; subtitle: string; href?: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
            {linkLabel ?? 'View all'} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="flex h-[140px] flex-col items-center justify-center gap-2 text-center">
      <Activity className="h-5 w-5 text-muted-foreground" />
      <p className="max-w-[34ch] text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function TopUserCard({ label, entry }: {
  label: string;
  entry?: { p: UserProfileSummary; prod: { score: number; band: 'high' | 'medium' | 'low' } } | undefined;
}) {
  if (!entry) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-4 text-center text-xs text-muted-foreground">
        {label}: no active staff
      </div>
    );
  }
  const { p, prod } = entry;
  return (
    <Link href={`/dashboard/people/${p.userId}`} className="group rounded-lg border bg-card p-4 transition-shadow hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Crown className="h-4 w-4 text-amber-500" />
      </div>
      <div className="mt-1 truncate text-base font-semibold">{p.displayName ?? p.email ?? p.userId.slice(0, 8)}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={`tabular-nums ${bandTone[prod.band]}`}>{prod.score}</Badge>
        <span>{fmt.format(p.totalEvents)} actions · {p.appsUsed} app{p.appsUsed === 1 ? '' : 's'}</span>
      </div>
    </Link>
  );
}

function AdoptionCard({ label, insight, sub, tone, icon: Icon }: {
  label: string; insight?: string | null | undefined; sub?: string | undefined; tone: string; icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{insight ?? '—'}</div>
      {sub && <div className={`text-[11px] ${tone}`}>{sub}</div>}
    </div>
  );
}

function PriorityDot({ p }: { p: 'high' | 'medium' | 'low' }) {
  const c = p === 'high' ? 'bg-rose-500' : p === 'medium' ? 'bg-amber-500' : 'bg-sky-500';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${c}`} title={`${p} priority`} />;
}

function RecColumn({ title, items, priority }: {
  title: string; items: { title: string; detail: string }[]; priority: 'high' | 'medium' | 'low';
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <PriorityDot p={priority} />
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="outline" className="ml-auto text-[10px] tabular-nums">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">Nothing here — all clear.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r, i) => (
            <li key={i} className="text-xs">
              <span className="block font-medium">{r.title}</span>
              <span className="block text-muted-foreground">{r.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
