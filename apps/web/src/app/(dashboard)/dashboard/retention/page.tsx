import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, UserMinus, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { friendlyEventName } from '@/lib/event-labels';
import { isOperationalEvent } from '@/lib/importance';
import { riskFromLastActive } from '@/lib/user-risk';
import {
  fetchActiveUserCounts,
  fetchDepartmentActivity,
  fetchProjectIntelligence,
  fetchTopJourneys,
  fetchUserProfileSummaries,
} from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

export default async function EngagementIntelligencePage() {
  const [active, people, projects, journeys, deptWeek, deptTwoWeek] = await Promise.all([
    fetchActiveUserCounts(),
    fetchUserProfileSummaries(300),
    fetchProjectIntelligence(),
    fetchTopJourneys(40),
    fetchDepartmentActivity(7),
    fetchDepartmentActivity(14),
  ]);

  // ── Staff engagement ────────────────────────────────────────────────────────
  const withActivity = people.filter((p) => p.totalEvents > 0);
  const mostActive = [...withActivity].sort((a, b) => b.totalEvents - a.totalEvents).slice(0, 8);
  const leastActive = [...withActivity].sort((a, b) => a.totalEvents - b.totalEvents).slice(0, 8);
  const goneQuiet = people
    .map((p) => ({ p, risk: riskFromLastActive(p.lastActiveAt) }))
    .filter((x) => x.risk.level !== 'green')
    .sort((a, b) => new Date(a.p.lastActiveAt ?? 0).getTime() - new Date(b.p.lastActiveAt ?? 0).getTime())
    .slice(0, 12);

  // ── Project engagement ──────────────────────────────────────────────────────
  const byUsage = [...projects].sort((a, b) => b.activeUsers7d - a.activeUsers7d);
  const mostUsed = byUsage[0] ?? null;
  const leastUsed = byUsage.length > 1 ? byUsage[byUsage.length - 1] : null;
  const growing = projects.filter((p) => p.activityNorm > 55).sort((a, b) => b.activityNorm - a.activityNorm);
  const declining = projects.filter((p) => p.activityNorm < 45).sort((a, b) => a.activityNorm - b.activityNorm);

  // ── Department engagement trend (this 7d vs prior 7d) ───────────────────────
  const prevByDept = new Map(deptTwoWeek.map((d) => [d.department, d.events]));
  const deptTrend = deptWeek.map((d) => {
    const prev = Math.max(0, (prevByDept.get(d.department) ?? 0) - d.events); // 14d total − 7d = prior 7d
    const dir = d.events > prev * 1.1 ? 'up' : d.events < prev * 0.9 ? 'down' : 'flat';
    return { department: d.department, thisWeek: d.events, prev, dir };
  }).sort((a, b) => b.thisWeek - a.thisWeek);

  // ── Operational workflows (drop page-view/click sequences) ──────────────────
  const opWorkflows = journeys
    .filter((j) => isOperationalEvent('', j.fromEvent) && isOperationalEvent('', j.toEvent))
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engagement Intelligence"
        description="Who is engaged, who has gone quiet, which products are growing, and how each department is trending."
        actions={<Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">Operational engagement</Badge>}
      />

      {/* Active staff counts */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active today" value={fmt.format(active.dau)} icon={UserPlus} trend={{ direction: 'flat', label: 'last 24h' }} />
        <KpiCard label="Active this week" value={fmt.format(active.wau)} icon={Users} trend={{ direction: 'flat', label: 'last 7d' }} href="/dashboard/sessions" />
        <KpiCard label="Active this month" value={fmt.format(active.mau)} icon={Users} trend={{ direction: 'flat', label: 'last 30d' }} />
        <KpiCard label="Gone quiet" value={fmt.format(goneQuiet.length)} icon={UserMinus} trend={{ direction: goneQuiet.length > 0 ? 'up' : 'flat', label: '7+ days inactive' }} invertTrend />
      </section>

      {/* Staff engagement: most/least active */}
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Most active staff" description="Who is getting the most done across products">
          <Leaderboard rows={mostActive} />
        </ChartCard>
        <ChartCard title="Least active staff" description="Engaged but lightly — candidates for enablement">
          <Leaderboard rows={leastActive} />
        </ChartCard>
      </section>

      {/* Staff gone quiet */}
      <ChartCard title="Staff who went quiet" description="Recently active people who have not returned — with how long they've been away">
        {goneQuiet.length === 0 ? (
          <Empty hint="Everyone recently active is still engaged." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Staff member</th>
                  <th className="px-2 py-2 text-left font-medium">Department</th>
                  <th className="px-2 py-2 text-right font-medium">Products</th>
                  <th className="px-2 py-2 text-right font-medium">Last seen</th>
                  <th className="px-2 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {goneQuiet.map(({ p, risk }) => (
                  <tr key={p.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <Link href={`/dashboard/people/${p.userId}`} className="font-medium hover:underline">
                        {p.displayName ?? p.email ?? p.userId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{p.department ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.appsUsed}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {p.lastActiveAt ? `${Math.floor((Date.now() - new Date(p.lastActiveAt).getTime()) / 86400000)}d ago` : 'never'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Badge variant="outline" className={`${risk.tone} text-[10px]`}>{risk.label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Project engagement */}
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Product engagement" description="Most/least used products and which are growing vs declining">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Most used" value={mostUsed?.name ?? '—'} sub={mostUsed ? `${fmt.format(mostUsed.activeUsers7d)} active (7d)` : ''} tone="emerald" />
            <Stat label="Least used" value={leastUsed?.name ?? '—'} sub={leastUsed ? `${fmt.format(leastUsed.activeUsers7d)} active (7d)` : ''} tone="rose" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3 w-3" /> Growing</div>
              {growing.length === 0 ? <div className="text-xs text-muted-foreground">None</div> : (
                <ul className="space-y-1 text-xs">{growing.map((p) => <li key={p.slug} className="flex justify-between"><span>{p.name}</span><span className="tabular-nums text-muted-foreground">{p.activityNorm}</span></li>)}</ul>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400"><TrendingDown className="h-3 w-3" /> Declining</div>
              {declining.length === 0 ? <div className="text-xs text-muted-foreground">None</div> : (
                <ul className="space-y-1 text-xs">{declining.map((p) => <li key={p.slug} className="flex justify-between"><span>{p.name}</span><span className="tabular-nums text-muted-foreground">{p.activityNorm}</span></li>)}</ul>
              )}
            </div>
          </div>
        </ChartCard>

        {/* Department engagement trend */}
        <ChartCard title="Department engagement" description="This week vs the previous week, by department">
          {deptTrend.length === 0 ? <Empty hint="No department activity yet." /> : (
            <ul className="space-y-2 pt-1">
              {deptTrend.map((d) => (
                <li key={d.department} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{d.department}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">{fmt.format(d.thisWeek)} this wk</span>
                    {d.dir === 'up' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      : d.dir === 'down' ? <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                      : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </section>

      {/* Operational workflows */}
      <ChartCard title="Common operational workflows" description="The operational actions staff most often perform one after another (page views & clicks excluded)">
        {opWorkflows.length === 0 ? (
          <Empty hint="No workflows yet — these appear as staff perform sequences of operational actions (login → action → action)." />
        ) : (
          <div className="space-y-2">
            {opWorkflows.map((j, i) => (
              <div key={`${j.fromEvent}-${j.toEvent}-${i}`} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium" title={j.fromEvent}>{friendlyEventName(j.fromEvent)}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium" title={j.toEvent}>{friendlyEventName(j.toEvent)}</span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{fmt.format(j.transitions)}</span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function Leaderboard({ rows }: { rows: Array<{ userId: string; displayName: string | null; email: string | null; department: string | null; totalEvents: number; totalSessions: number }> }) {
  if (rows.length === 0) return <Empty hint="No staff activity yet." />;
  return (
    <ul className="divide-y">
      {rows.map((p) => (
        <li key={p.userId} className="flex items-center justify-between gap-2 py-2 text-xs">
          <Link href={`/dashboard/people/${p.userId}`} className="min-w-0 hover:underline">
            <div className="truncate font-medium">{p.displayName ?? p.email ?? p.userId.slice(0, 8)}</div>
            {p.department && <div className="truncate text-[10px] text-muted-foreground">{p.department}</div>}
          </Link>
          <span className="shrink-0 tabular-nums text-muted-foreground">{fmt.format(p.totalEvents)} actions · {fmt.format(p.totalSessions)} sessions</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'emerald' | 'rose' }) {
  const c = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-semibold ${c}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="flex h-[140px] flex-col items-center justify-center gap-2 rounded-md bg-muted/20 text-center">
      <div className="text-xs font-medium text-muted-foreground">No data yet</div>
      <p className="max-w-[32ch] text-[11px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}
