import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { StatusBadge } from '@/components/ui/status-badge';
import { statusFromTier } from '@/lib/status';
import { fetchProjectIntelligence } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';

const fmt = new Intl.NumberFormat('en-US');

function scoreTone(s: number): string {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

/** Product directory + adoption — the "Overview" tab of Product Analytics. */
export async function OverviewPanel({ appId }: { appId?: string | undefined }) {
  const all = await fetchProjectIntelligence();
  const projects = appId ? all.filter((p) => p.slug === appId) : all;

  const total = projects.length;
  const healthy = projects.filter((p) => p.status === 'healthy').length;
  const warning = projects.filter((p) => p.status === 'warning').length;
  const critical = projects.filter((p) => p.status === 'critical').length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Product health overview" description="How many products are healthy vs need attention" className="lg:col-span-1"
          actions={<Link href="/dashboard/health" className="text-xs text-primary hover:underline">Details →</Link>}>
          <DonutChart
            data={[
              { name: 'Healthy', value: healthy, color: '#10b981' },
              { name: 'Warning', value: warning, color: '#f59e0b' },
              { name: 'Critical', value: critical, color: '#ef4444' },
            ].filter((d) => d.value > 0)}
            centerLabel="Products"
            centerValue={String(total)}
            height={220}
          />
        </ChartCard>

        <ChartCard title="Adoption by product" description="Share of people with access who actually use each product" className="lg:col-span-2">
          {projects.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3 pt-1">
              {[...projects].sort((a, b) => b.adoptionPct - a.adoptionPct).map((p) => (
                <li key={p.slug} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 truncate font-medium">{p.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, p.adoptionPct)}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{p.adoptionPct}%</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </section>

      <ChartCard title="All products" description="Click a product to open its Project Intelligence page">
        {projects.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th className="px-2 py-2 text-left font-medium">Environment</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Health</th>
                  <th className="px-2 py-2 text-right font-medium">Active users (7d)</th>
                  <th className="px-2 py-2 text-right font-medium">Last activity</th>
                  <th className="px-2 py-2 text-right font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <Link href={`/dashboard/projects/${p.slug}`} className="font-medium hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-2 py-2 capitalize text-muted-foreground">{p.projectType}</td>
                    <td className="px-2 py-2 capitalize text-muted-foreground">{p.environment}</td>
                    <td className="px-2 py-2"><StatusBadge status={statusFromTier(p.status)} size="sm" /></td>
                    <td className={`px-2 py-2 text-right font-semibold tabular-nums ${scoreTone(p.healthScore)}`}>{p.healthScore}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt.format(p.activeUsers7d)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{p.lastActivityAt ? formatRelativeTime(p.lastActivityAt) : 'never'}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <HeartPulse className="h-6 w-6" />
      No products connected yet. Add one from Integrations → Connected Products.
    </div>
  );
}
