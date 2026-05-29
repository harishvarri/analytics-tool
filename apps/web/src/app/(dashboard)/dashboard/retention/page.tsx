import { ArrowRight, Repeat2, UserMinus, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { friendlyEventName } from '@/lib/event-labels';
import {
  fetchActiveUserCounts,
  fetchDormantUsers,
  fetchRetentionCohorts,
  fetchTopJourneys,
} from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

function retentionTone(pct: number): string {
  if (pct >= 60) return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
  if (pct >= 30) return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
  if (pct >  0)  return 'bg-rose-500/20  text-rose-700  dark:text-rose-300';
  return 'bg-muted text-muted-foreground';
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function RetentionPage() {
  const [cohorts, dormant, journeys, active] = await Promise.all([
    fetchRetentionCohorts(),
    fetchDormantUsers(20),
    fetchTopJourneys(12),
    fetchActiveUserCounts(),
  ]);

  // Headline averages (across non-empty cohorts)
  const avgD1 = avg(cohorts.filter((c) => c.cohortSize > 0).map((c) => c.d1Pct));
  const avgD7 = avg(cohorts.filter((c) => c.cohortSize > 0).map((c) => c.d7Pct));
  const totalNew = cohorts.reduce((sum, c) => sum + c.cohortSize, 0);
  const hasData = cohorts.length > 0 || dormant.length > 0 || journeys.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retention"
        description="Do people come back? Returning-visitor rates over time, plus who has gone quiet."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● 8-week cohort window
          </Badge>
        }
      />

      {/* Active-user counts (DAU / WAU / MAU) */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="DAU" value={active.dau.toLocaleString()} icon={UserPlus}
          trend={{ direction: 'flat', label: 'Active in last 24h' }} />
        <KpiCard label="WAU" value={active.wau.toLocaleString()} icon={UserPlus}
          trend={{ direction: 'flat', label: 'Active in last 7d' }} />
        <KpiCard label="MAU" value={active.mau.toLocaleString()} icon={UserPlus}
          trend={{ direction: 'flat', label: 'Active in last 30d' }} />
        <KpiCard label="Stickiness" value={`${active.stickinessPct}%`} icon={Repeat2}
          trend={{ direction: 'flat', label: 'DAU / MAU ratio' }} />
      </section>

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="New Users (8w)"
          value={String(totalNew)}
          icon={UserPlus}
          trend={{ direction: 'flat', label: 'First-seen in tracked window' }}
        />
        <KpiCard
          label="Avg D1 Retention"
          value={`${avgD1}%`}
          icon={Repeat2}
          trend={{ direction: 'flat', label: 'Active day after signup' }}
        />
        <KpiCard
          label="Avg D7 Retention"
          value={`${avgD7}%`}
          icon={Repeat2}
          trend={{ direction: 'flat', label: 'Active one week later' }}
        />
        <KpiCard
          label="Dormant Users"
          value={String(dormant.length)}
          icon={UserMinus}
          trend={{ direction: dormant.length > 0 ? 'up' : 'flat', label: 'Silent ≥ 14d' }}
          invertTrend
        />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Repeat2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No retention data yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Retention is computed from authenticated event activity. As soon as users log in and
            return over multiple days, cohorts, journeys, and dormancy lists will populate here.
          </p>
        </div>
      )}

      {/* Cohort table */}
      {cohorts.length > 0 && (
        <ChartCard
          title="Do new visitors come back?"
          description="Each row is a group who first visited that week. Columns show the % who returned 1 day, 7 days, and 30 days later."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Cohort week</th>
                  <th className="px-2 py-2 text-right font-medium">Size</th>
                  <th className="px-2 py-2 text-right font-medium">D1</th>
                  <th className="px-2 py-2 text-right font-medium">D7</th>
                  <th className="px-2 py-2 text-right font-medium">D30</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohortWeek} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2 tabular-nums">{fmtWeek(c.cohortWeek)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{c.cohortSize}</td>
                    <RetentionCell pct={c.d1Pct} count={c.d1Active} />
                    <RetentionCell pct={c.d7Pct} count={c.d7Active} />
                    <RetentionCell pct={c.d30Pct} count={c.d30Active} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Two-column: Top journeys + Dormant users */}
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Most common next steps"
          description="The actions people most often take one right after another (last 7 days)"
        >
          {journeys.length > 0 ? (
            <div className="space-y-2">
              {journeys.map((j, i) => (
                <div
                  key={`${j.fromEvent}-${j.toEvent}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium" title={j.fromEvent}>{friendlyEventName(j.fromEvent)}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium" title={j.toEvent}>{friendlyEventName(j.toEvent)}</span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{j.transitions}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart hint="No session data captured in the last 7 days." />
          )}
        </ChartCard>

        <ChartCard
          title="Visitors who went quiet"
          description="People who were active recently but haven't come back in 14+ days"
        >
          {dormant.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">User</th>
                    <th className="px-2 py-2 text-right font-medium">Days silent</th>
                  </tr>
                </thead>
                <tbody>
                  {dormant.map((u) => (
                    <tr key={u.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <div className="truncate font-medium">
                          {u.displayName ?? u.email ?? u.userId.slice(0, 8)}
                        </div>
                        {u.email && (
                          <div className="truncate text-[10px] text-muted-foreground">{u.email}</div>
                        )}
                      </td>
                      <td className={`px-2 py-2 text-right tabular-nums font-semibold ${
                        u.daysSinceActive >= 30
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {u.daysSinceActive}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart hint="No dormant users — every recent user is still active." />
          )}
        </ChartCard>
      </section>
    </div>
  );
}

function RetentionCell({ pct, count }: { pct: number; count: number }) {
  return (
    <td className="px-1 py-2 text-right">
      <div className={`inline-flex min-w-[64px] flex-col items-center rounded-md px-2 py-1 ${retentionTone(pct)}`}>
        <span className="text-xs font-semibold tabular-nums">{pct}%</span>
        <span className="text-[9px] tabular-nums opacity-70">{count}</span>
      </div>
    </td>
  );
}

function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-md bg-muted/20 text-center">
      <div className="text-xs font-medium text-muted-foreground">No data yet</div>
      <p className="max-w-[28ch] text-[11px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}
