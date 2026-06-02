import Link from 'next/link';
import { Boxes, HeartPulse, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchProjectIntelligence } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';
import type { ProjectStatus } from '@/lib/repositories/projectIntelligence';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const STATUS_META: Record<ProjectStatus, { label: string; dot: string; tone: string }> = {
  healthy:  { label: 'Healthy',  dot: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400' },
  warning:  { label: 'Warning',  dot: 'bg-amber-500',   tone: 'text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', dot: 'bg-rose-500',    tone: 'text-rose-600 dark:text-rose-400' },
};

function scoreTone(s: number): string {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function ComparePage() {
  const rows = await fetchProjectIntelligence();

  const totalStaff = rows.reduce((s, r) => s + r.activeUsers7d, 0);
  const healthy = rows.filter((r) => r.status === 'healthy').length;
  const needsAttention = rows.filter((r) => r.status !== 'healthy').length;
  const maxStaff = Math.max(1, ...rows.map((r) => r.activeUsers7d));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Comparison"
        description="Compare products on what matters operationally — staff, adoption, health, and reliability. Click any product for its intelligence page."
        actions={
          <ExportButton
            filename="product-comparison"
            headers={['Product', 'Active users 7d', 'Sessions 7d', 'Adoption %', 'Health', 'Status', 'Errors 30d', 'Error rate %', 'Operational score', 'Last activity']}
            rows={rows.map((r) => [
              r.name, r.activeUsers7d, r.sessions7d, r.adoptionPct, r.healthScore, r.status,
              r.errors30d, r.errorRatePct, r.operationalScore, r.lastActivityAt ?? 'never',
            ])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Products tracked" value={String(rows.length)} icon={Boxes}
          trend={{ direction: 'flat', label: `${healthy} healthy` }} />
        <KpiCard label="Active staff (7d)" value={fmt.format(totalStaff)} icon={Users}
          trend={{ direction: 'flat', label: 'across all products' }} href="/dashboard/sessions" />
        <KpiCard label="Need attention" value={String(needsAttention)} icon={HeartPulse}
          trend={{ direction: needsAttention > 0 ? 'up' : 'flat', label: 'warning or critical' }} invertTrend
          href="/dashboard/health" />
      </section>

      <ChartCard
        title="How each product is doing"
        description="Operational comparison — active staff, adoption, health, and reliability. No raw event counts."
      >
        {rows.length === 0 ? (
          <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">No products connected yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Active users (7d)</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Adoption</th>
                  <th className="px-2 py-2 text-right font-medium">Health</th>
                  <th className="px-2 py-2 text-right font-medium">Errors (30d)</th>
                  <th className="px-2 py-2 text-right font-medium">Ops activity</th>
                  <th className="px-2 py-2 text-right font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/projects/${r.slug}`} className="font-medium hover:underline">{r.name}</Link>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1.5 ${meta.tone}`}>
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.activeUsers7d / maxStaff) * 100}%` }} />
                          </div>
                          <span className="tabular-nums font-semibold">{fmt.format(r.activeUsers7d)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(r.sessions7d)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.adoptionPct}%</td>
                      <td className={`px-2 py-2 text-right font-semibold tabular-nums ${scoreTone(r.healthScore)}`}>{r.healthScore}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(r.errors30d)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.operationalScore}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{r.lastActivityAt ? formatRelativeTime(r.lastActivityAt) : 'never'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
