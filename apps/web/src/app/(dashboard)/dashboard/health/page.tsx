import Link from 'next/link';
import {
  Activity, HeartPulse, ShieldCheck, TriangleAlert, TrendingUp, TrendingDown,
  Minus, ArrowUpRight, Sparkles, AlertOctagon, ChevronRight,
} from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { fetchReliabilityHealth } from '@/lib/data/fetchers';
import type { HealthStatus, ReliabilityHealth } from '@/lib/repositories/reliabilityHealth';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const STATUS_META: Record<HealthStatus, { label: string; dot: string; tone: string; badge: string }> = {
  healthy:  { label: 'Healthy',  dot: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400', badge: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  warning:  { label: 'Warning',  dot: 'bg-amber-500',   tone: 'text-amber-600 dark:text-amber-400',     badge: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', dot: 'bg-rose-500',    tone: 'text-rose-600 dark:text-rose-400',        badge: 'border-rose-500/40 text-rose-600 dark:text-rose-400' },
};

function scoreTone(s: number): string {
  if (s >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function TrendBadge({ trend }: { trend: number }) {
  if (trend === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" />no change</span>;
  const up = trend > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      <Icon className="h-3 w-3" />{up ? '+' : ''}{trend} vs last week
    </span>
  );
}

export default async function ProjectHealthPage() {
  const board = await fetchReliabilityHealth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Health"
        description="System reliability & stability — is each product working correctly right now? Health reflects errors and incidents only, not usage or growth."
      />

      {/* Overall reliability band */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Overall reliability" value={String(board.overallScore)} icon={HeartPulse}
          trend={{ direction: board.overallScore >= 90 ? 'flat' : 'down', label: 'across all products' }} />
        <KpiCard label="Healthy" value={String(board.healthy)} icon={ShieldCheck}
          trend={{ direction: 'flat', label: '≥ 90 · stable' }} />
        <KpiCard label="Warning" value={String(board.warning)} icon={Activity}
          trend={{ direction: board.warning > 0 ? 'up' : 'flat', label: '70–89 · minor issues' }} invertTrend />
        <KpiCard label="Critical" value={String(board.critical)} icon={TriangleAlert}
          trend={{ direction: board.critical > 0 ? 'up' : 'flat', label: '< 70 · users impacted' }} invertTrend />
      </section>

      {/* Executive snapshot: most healthy / most unstable / impact */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Most healthy product
          </div>
          {board.mostHealthy ? (
            <Link href={`/dashboard/health/${board.mostHealthy.slug}`} className="mt-2 block">
              <div className="flex items-baseline justify-between">
                <span className="truncate text-sm font-semibold hover:underline">{board.mostHealthy.name}</span>
                <span className={`text-2xl font-bold tabular-nums ${scoreTone(board.mostHealthy.score)}`}>{board.mostHealthy.score}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{board.mostHealthy.reason}</p>
            </Link>
          ) : <p className="mt-2 text-sm text-muted-foreground">No products yet.</p>}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertOctagon className="h-3.5 w-3.5 text-rose-500" /> Most unstable product
          </div>
          {board.mostUnstable ? (
            <Link href={`/dashboard/health/${board.mostUnstable.slug}`} className="mt-2 block">
              <div className="flex items-baseline justify-between">
                <span className="truncate text-sm font-semibold hover:underline">{board.mostUnstable.name}</span>
                <span className={`text-2xl font-bold tabular-nums ${scoreTone(board.mostUnstable.score)}`}>{board.mostUnstable.score}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{board.mostUnstable.reason}</p>
            </Link>
          ) : <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">All products stable.</p>}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TriangleAlert className="h-3.5 w-3.5 text-amber-500" /> Business impact (7d)
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div><div className="text-2xl font-bold tabular-nums">{fmt.format(board.affectedUsers)}</div><div className="text-[11px] text-muted-foreground">affected users</div></div>
            <div><div className="text-2xl font-bold tabular-nums">{fmt.format(board.affectedProducts)}</div><div className="text-[11px] text-muted-foreground">products impacted</div></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Health distribution */}
        <ChartCard title="Reliability distribution" description="Stable vs impacted across the platform" className="lg:col-span-1">
          <DonutChart
            data={[
              { name: 'Healthy', value: board.healthy, color: '#10b981' },
              { name: 'Warning', value: board.warning, color: '#f59e0b' },
              { name: 'Critical', value: board.critical, color: '#ef4444' },
            ].filter((d) => d.value > 0)}
            centerLabel="Products"
            centerValue={String(board.total)}
            height={220}
          />
        </ChartCard>

        {/* Recent health changes */}
        <ChartCard title="Recent health changes" description="Biggest week-over-week reliability movers" className="lg:col-span-2">
          {board.recentChanges.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">No measurable change this week.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Product</th>
                    <th className="px-2 py-2 text-right font-medium">Last week</th>
                    <th className="px-2 py-2 text-right font-medium">Now</th>
                    <th className="px-2 py-2 text-right font-medium">Change</th>
                    <th className="px-2 py-2 text-left font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {board.recentChanges.map((p) => (
                    <tr key={p.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2"><Link href={`/dashboard/health/${p.slug}`} className="font-medium hover:underline">{p.name}</Link></td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{p.prevScore}</td>
                      <td className={`px-2 py-2 text-right font-semibold tabular-nums ${scoreTone(p.score)}`}>{p.score}</td>
                      <td className="px-2 py-2 text-right"><TrendBadge trend={p.trend} /></td>
                      <td className="px-2 py-2 text-muted-foreground">{p.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </section>

      {/* Per-product reliability cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {board.projects.map((p) => <HealthCard key={p.slug} p={p} />)}
      </section>

      <div className="text-[11px] text-muted-foreground">
        Health = 100 − error penalties (Frontend / API / Database / Authentication, weighted by severity) − open &amp; investigating incident penalties.
        Resolved and closed incidents never reduce health. Usage, momentum, and adoption are tracked separately under Engagement &amp; Product Intelligence.
      </div>
    </div>
  );
}

function HealthCard({ p }: { p: ReliabilityHealth }) {
  const meta = STATUS_META[p.status];
  const activeIncidents = p.incidents.open + p.incidents.investigating;
  return (
    <Link href={`/dashboard/health/${p.slug}`} className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold group-hover:underline">{p.name}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 ${meta.tone}`}>
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
            </span>
            <TrendBadge trend={p.trend} />
          </div>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${scoreTone(p.score)}`}>{p.score}</div>
      </div>

      {/* Reason */}
      <p className="mt-2 text-[11px] text-muted-foreground">{p.reason}</p>

      {/* Category penalty breakdown */}
      {p.categories.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {p.categories.slice(0, 4).map((c) => (
            <li key={c.category} className="flex items-center gap-2 text-[11px]">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c.critical ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span className="flex-1 truncate text-muted-foreground">{c.label}</span>
              <span className="tabular-nums text-muted-foreground">{c.errors} err</span>
              <span className="w-10 text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">−{c.penalty}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Impact footer */}
      <div className="mt-3 grid grid-cols-4 gap-2 border-t pt-2 text-center text-[10px] text-muted-foreground">
        <div><div className="font-semibold text-foreground">{p.affectedUsers}</div>users</div>
        <div><div className="font-semibold text-foreground">{p.affectedSessions}</div>sessions</div>
        <div><div className="font-semibold text-foreground">{p.affectedFeatures}</div>areas</div>
        <div><div className={`font-semibold ${activeIncidents > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>{activeIncidents}</div>incidents</div>
      </div>

      {p.categories.length === 0 && activeIncidents === 0 && (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Operating normally — no errors detected.
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        View health analysis <ArrowUpRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
