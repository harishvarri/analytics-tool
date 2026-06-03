import Link from 'next/link';
import { Activity, HeartPulse, ShieldCheck, TriangleAlert } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { Badge } from '@/components/ui/badge';
import { fetchPlatformHealth, fetchProjectIntelligence } from '@/lib/data/fetchers';
import type { ProjectStatus, RiskLevel } from '@/lib/repositories/projectIntelligence';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const STATUS_META: Record<ProjectStatus, { label: string; dot: string; tone: string }> = {
  healthy:  { label: 'Healthy',  dot: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400' },
  warning:  { label: 'Warning',  dot: 'bg-amber-500',   tone: 'text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', dot: 'bg-rose-500',    tone: 'text-rose-600 dark:text-rose-400' },
};
const RISK_TONE: Record<RiskLevel, string> = {
  low:    'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  medium: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  high:   'border-rose-500/40 text-rose-600 dark:text-rose-400',
};

function scoreTone(s: number): string {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function PlatformHealthPage() {
  const [platform, projects] = await Promise.all([
    fetchPlatformHealth(),
    fetchProjectIntelligence(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Health"
        description="What is wrong with each product right now — and how the platform is doing overall."
      />

      {/* Overall platform health */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Overall health" value={String(platform.overallScore)} icon={HeartPulse}
          trend={{ direction: platform.overallScore >= 75 ? 'flat' : 'down', label: 'across all products' }} />
        <KpiCard label="Healthy" value={String(platform.healthy)} icon={ShieldCheck}
          trend={{ direction: 'flat', label: 'no issues' }} />
        <KpiCard label="Warning" value={String(platform.warning)} icon={Activity}
          trend={{ direction: platform.warning > 0 ? 'up' : 'flat', label: 'need attention' }} invertTrend />
        <KpiCard label="Critical" value={String(platform.critical)} icon={TriangleAlert}
          trend={{ direction: platform.critical > 0 ? 'up' : 'flat', label: 'urgent' }} invertTrend />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Health distribution" description="Healthy vs needs-attention across the platform" className="lg:col-span-1">
          <DonutChart
            data={[
              { name: 'Healthy', value: platform.healthy, color: '#10b981' },
              { name: 'Warning', value: platform.warning, color: '#f59e0b' },
              { name: 'Critical', value: platform.critical, color: '#ef4444' },
            ].filter((d) => d.value > 0)}
            centerLabel="Products"
            centerValue={String(platform.totalProjects)}
            height={220}
          />
        </ChartCard>

        {/* Critical projects table — what needs attention and why */}
        <ChartCard title="Needs attention" description="Products that are unhealthy, why, and who is affected" className="lg:col-span-2">
          {platform.critical_projects.length === 0 ? (
            <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
              All products are healthy.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Product</th>
                    <th className="px-2 py-2 text-right font-medium">Health</th>
                    <th className="px-2 py-2 text-left font-medium">Problem</th>
                    <th className="px-2 py-2 text-right font-medium">Affected users</th>
                  </tr>
                </thead>
                <tbody>
                  {platform.critical_projects.map((c) => (
                    <tr key={c.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/projects/${c.slug}`} className="font-medium hover:underline">{c.name}</Link>
                      </td>
                      <td className={`px-2 py-2 text-right font-semibold tabular-nums ${scoreTone(c.healthScore)}`}>{c.healthScore}</td>
                      <td className="px-2 py-2 text-rose-600 dark:text-rose-400">{c.problem}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(c.affectedUsers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </section>

      {/* Per-project health cards with issues + risk */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => {
          const meta = STATUS_META[p.status];
          return (
            <Link
              key={p.slug}
              href={`/dashboard/projects/${p.slug}`}
              className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                    <span className={`inline-flex items-center gap-1 ${meta.tone}`}>
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
                    </span>
                    <Badge variant="outline" className={`${RISK_TONE[p.riskLevel]} text-[10px]`}>{p.riskLevel} risk</Badge>
                  </div>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${scoreTone(p.healthScore)}`}>{p.healthScore}</div>
              </div>

              {p.alerts.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {p.alerts.map((a) => (
                    <li key={a} className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      <TriangleAlert className="h-3 w-3" />{a}
                    </li>
                  ))}
                </ul>
              )}
              {/* Why the score is what it is — always explain a non-healthy product. */}
              {p.healthReasons.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {p.healthReasons.slice(0, 3).map((r) => (
                    <li key={r} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400">Operating normally — all factors at target.</div>
              )}

              <div className="mt-3 grid grid-cols-4 gap-2 border-t pt-2 text-center text-[10px] text-muted-foreground">
                <div><div className="font-semibold text-foreground">{p.adoptionNorm}</div>adoption</div>
                <div><div className="font-semibold text-foreground">{p.reliabilityNorm}</div>reliability</div>
                <div><div className="font-semibold text-foreground">{p.performanceNorm}</div>speed</div>
                <div><div className="font-semibold text-foreground">{p.activityNorm}</div>momentum</div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
