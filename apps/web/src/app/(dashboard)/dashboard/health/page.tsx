import { Activity, HeartPulse, ShieldCheck, TriangleAlert } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchProjectHealth } from '@/lib/data/fetchers';
import type { HealthTier } from '@/lib/repositories/health';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const TIER_META: Record<HealthTier, { label: string; dot: string; tone: string }> = {
  healthy:  { label: 'Healthy',  dot: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400' },
  at_risk:  { label: 'At risk',  dot: 'bg-amber-500',   tone: 'text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', dot: 'bg-rose-500',    tone: 'text-rose-600 dark:text-rose-400' },
};

function scoreTone(s: number): string {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function ProjectHealthPage() {
  const rows = await fetchProjectHealth();

  const healthy = rows.filter((r) => r.healthTier === 'healthy').length;
  const atRisk = rows.filter((r) => r.healthTier === 'at_risk').length;
  const critical = rows.filter((r) => r.healthTier === 'critical').length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.ghiScore, 0) / rows.length) : 0;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title="Project Health"
        description="A single 0–100 score per product blending adoption, reliability, speed, and momentum — so problems surface instantly."
        actions={
          <ExportButton
            filename="project-health"
            headers={['Product', 'Health', 'Tier', 'Adoption', 'Reliability', 'Performance', 'Activity', 'Errors 7d', 'p95 load ms']}
            rows={rows.map((r) => [r.projectName, r.ghiScore, r.healthTier, r.adoptionNorm, r.reliabilityNorm, r.performanceNorm, r.activityNorm, r.errors7d, r.p95LoadMs ?? ''])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg health" value={String(avg)} icon={HeartPulse}
          trend={{ direction: avg >= 75 ? 'flat' : 'down', label: 'across all products' }} />
        <KpiCard label="Healthy" value={String(healthy)} icon={ShieldCheck}
          trend={{ direction: 'flat', label: 'score ≥ 75' }} />
        <KpiCard label="At risk" value={String(atRisk)} icon={Activity}
          trend={{ direction: atRisk > 0 ? 'up' : 'flat', label: 'score 50–74' }} invertTrend />
        <KpiCard label="Critical" value={String(critical)} icon={TriangleAlert}
          trend={{ direction: critical > 0 ? 'up' : 'flat', label: 'score < 50' }} invertTrend />
      </section>

      {!hasData ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <HeartPulse className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No products to score yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Connect a product and send some events — health scores appear once there is activity to measure.
          </p>
        </div>
      ) : (
        <ChartCard
          title="Health scorecard"
          description="Worst first. Each score = 40% adoption + 25% reliability + 20% speed + 15% momentum."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Health</th>
                  <th className="px-2 py-2 text-right font-medium">Adoption</th>
                  <th className="px-2 py-2 text-right font-medium">Reliability</th>
                  <th className="px-2 py-2 text-right font-medium">Speed</th>
                  <th className="px-2 py-2 text-right font-medium">Momentum</th>
                  <th className="px-2 py-2 text-right font-medium">Errors 7d</th>
                  <th className="px-2 py-2 text-right font-medium">p95 load</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = TIER_META[r.healthTier];
                  return (
                    <tr key={r.projectSlug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2 font-medium">{r.projectName}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1.5 ${meta.tone}`}>
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
                        </span>
                      </td>
                      <td className={`px-2 py-2 text-right text-sm font-semibold tabular-nums ${scoreTone(r.ghiScore)}`}>{r.ghiScore}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.adoptionNorm}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.reliabilityNorm}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.performanceNorm}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.activityNorm}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(r.errors7d)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.p95LoadMs != null ? `${fmt.format(r.p95LoadMs)}ms` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <div className="text-[11px] text-muted-foreground">
        Missing signals fall back to a neutral 50, so a product isn&apos;t penalised for not yet emitting (e.g.) performance events.
      </div>
    </div>
  );
}
