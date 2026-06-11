import Link from 'next/link';
import {
  Activity, AlertOctagon, AlertTriangle, Bug, CheckCircle2, ChevronRight,
  Crown, Gauge, ShieldAlert, TrendingDown, TrendingUp, Users, Zap,
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
import type { UserProfileSummary } from '@/lib/repositories/operational';

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

  const leaderboard = ranked.slice(0, 6);
  const topPerformers = [...ranked].sort((a, b) => b.prod.score - a.prod.score).slice(0, 5);
  const needsAttention = ranked.filter((r) => r.risk.level !== 'green').sort((a, b) => (b.days ?? 0) - (a.days ?? 0)).slice(0, 5);

  // ── Live operational feed (business actions only) ────────────────────────────
  const liveActivity = aggregateActivity(rawActivity.filter((a) => isOperationalEvent(a.category, a.eventName))).slice(0, 10);

  // ── Product intelligence (from the weekly report) ────────────────────────────
  const products = report.productRanking;
  const adoption = report.adoption;

  // ── Operational intelligence ─────────────────────────────────────────────────
  const openIncidents = incidents.open;
  const criticalIncidents = incidents.critical;
  const errorsToday = command.errorsToday;

  // ── Executive insights & recommendations ─────────────────────────────────────
  const recs = report.recommendations;
  const byPriority = (p: 'high' | 'medium' | 'low') => recs.filter((r) => r.priority === p);

  const highRecs = [...byPriority('high'), ...byPriority('medium')].slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Command Center"
        description="Who is active, what they're doing, which products need attention — at a glance."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">● Live</Badge>
            <Link href="/dashboard/insights" className="text-xs text-primary hover:underline">Weekly report →</Link>
          </div>
        }
      />

      {/* ─── Organization Pulse — the 30-second answer ──────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Active today" value={fmt.format(active.dau)} icon={Users}
          trend={deltaTrend(eng.activeUsers)} href="/dashboard/people" />
        <KpiCard label="Sessions today" value={fmt.format(command.sessionsToday)} icon={Zap}
          trend={deltaTrend(eng.sessions)} href="/dashboard/sessions" />
        <KpiCard label="Actions today" value={fmt.format(command.eventsToday)} icon={Activity}
          trend={{ direction: 'flat', label: 'events across products' }} href="/dashboard/realtime" />
        <KpiCard label="Connected products" value={fmt.format(pulse.appsTotal)} icon={Gauge}
          trend={{ direction: 'flat', label: `${pulse.appsActive} active now` }} href="/dashboard/portals" />
        <KpiCard label="Platform health" value={`${report.scorecard.platformHealth}`} icon={ShieldAlert}
          trend={{ direction: 'flat', label: report.platformStatus }} href="/dashboard/operations" />
      </div>

      {/* ─── Command row: leaderboard (2/3) + ops & risk rail (1/3) ──────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Top active users" description="Who's getting the most done — click anyone for their profile"
            actions={<Link href="/dashboard/people" className="text-xs text-primary hover:underline">All staff →</Link>}>
            {leaderboard.length === 0 ? <Empty hint="No staff activity recorded yet." /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">User</th>
                    <th className="px-2 py-2 text-right font-medium">Actions</th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Sessions</th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Products</th>
                    <th className="px-2 py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaderboard.map(({ p, prod, risk }, i) => (
                    <tr key={p.userId} className="hover:bg-muted/40">
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
                      <td className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{fmt.format(p.totalSessions)}</td>
                      <td className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{fmt.format(p.appsUsed)}</td>
                      <td className="px-2 py-2 text-right">
                        <Badge variant="outline" className={`tabular-nums ${bandTone[prod.band]}`}>{prod.score}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ChartCard>
        </div>

        <div className="space-y-6">
          {/* Operational snapshot */}
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Open incidents" value={fmt.format(openIncidents)} icon={AlertOctagon} invertTrend
              trend={{ direction: openIncidents > 0 ? 'up' : 'flat', label: criticalIncidents > 0 ? `${criticalIncidents} critical` : 'clear' }} href="/dashboard/incidents" />
            <KpiCard label="JS errors" value={fmt.format(errorsToday)} icon={Bug} invertTrend
              trend={{ direction: errorsToday > 0 ? 'up' : 'flat', label: 'today' }} href="/dashboard/incidents?view=errors" />
          </div>
          <ChartCard title="Risks to watch" description="Signals that may need action"
            actions={report.risks.length > 0 ? <Badge variant="outline" className="text-[10px]">{report.risks.length}</Badge> : undefined}>
            {report.risks.length === 0 ? <Empty hint="No active risks detected." /> : (
              <ul className="space-y-3">
                {report.risks.slice(0, 4).map((r) => (
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
      </div>

      {/* ─── Insight row: what changed · recommended · live feed ────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <ChartCard title="What changed" description="This week, auto-summarized"
          actions={<Link href="/dashboard/insights" className="text-xs text-primary hover:underline">Report →</Link>}>
          {report.executiveSummary.length === 0 ? <Empty hint="No notable changes this week." /> : (
            <ul className="space-y-2">
              {report.executiveSummary.slice(0, 5).map((line, i) => {
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
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Recommended actions" description="What to do next"
          actions={<Link href="/dashboard/insights" className="text-xs text-primary hover:underline">All →</Link>}>
          {highRecs.length === 0 ? <Empty hint="Nothing urgent — all clear." /> : (
            <ul className="space-y-2.5">
              {highRecs.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <PriorityDot p={r.priority} />
                  <span className="min-w-0">
                    <span className="block font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{r.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Live activity" description="Operational actions right now"
          actions={<Link href="/dashboard/realtime" className="text-xs text-primary hover:underline">Stream →</Link>}>
          <ActivityFeed items={liveActivity.slice(0, 6)} empty="No operational activity in the last few minutes." />
        </ChartCard>
      </div>

      {/* ─── Product intelligence (compact) ─────────────────────────────────── */}
      <Section title="Product Intelligence" subtitle="Used, healthy, growing, or needing attention"
        href="/dashboard/compare" linkLabel="Compare all products">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdoptionCard label="Most used" insight={adoption.mostUsed?.feature} sub={products[0]?.name} tone="text-emerald-600 dark:text-emerald-400" icon={TrendingUp} />
          <AdoptionCard label="Fastest growing" insight={adoption.fastestGrowing?.feature} sub={adoption.fastestGrowing ? `+${adoption.fastestGrowing.growthPct ?? 0}%` : undefined} tone="text-sky-600 dark:text-sky-400" icon={TrendingUp} />
          <AdoptionCard label="Needs attention" insight={products.find((p) => p.healthScore < 70)?.name} sub="low health" tone="text-amber-600 dark:text-amber-400" icon={AlertTriangle} />
          <AdoptionCard label="Declining" insight={adoption.declining?.feature} sub={adoption.declining ? `${adoption.declining.growthPct ?? 0}%` : undefined} tone="text-rose-600 dark:text-rose-400" icon={TrendingDown} />
        </div>
      </Section>

      {/* ─── Productivity: performers + needs a check-in ────────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ChartCard title="Top performers" description="Highest productivity across products"
          actions={<Link href="/dashboard/people" className="text-xs text-primary hover:underline">All staff →</Link>}>
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
        <ChartCard title="Requiring attention" description="Recently active staff who have gone quiet"
          actions={<Link href="/dashboard/retention" className="text-xs text-primary hover:underline">Engagement →</Link>}>
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
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c}`} title={`${p} priority`} />;
}
