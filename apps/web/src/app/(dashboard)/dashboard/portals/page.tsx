import Link from 'next/link';
import { Activity, Boxes, HeartPulse, Users, Zap } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { fetchProjectIntelligence } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';
import type { ProjectStatus } from '@/lib/repositories/projectIntelligence';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

interface PageProps {
  searchParams: Promise<{ app?: string }>;
}

const STATUS_META: Record<ProjectStatus, { label: string; dot: string; tone: string }> = {
  healthy:  { label: 'Healthy',  dot: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400' },
  warning:  { label: 'Warning',  dot: 'bg-amber-500',   tone: 'text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', dot: 'bg-rose-500',    tone: 'text-rose-600 dark:text-rose-400' },
};

function scoreTone(s: number): string {
  if (s >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

export default async function ProductsDirectoryPage({ searchParams }: PageProps) {
  const { app } = await searchParams;
  const all = await fetchProjectIntelligence();
  const projects = app ? all.filter((p) => p.slug === app) : all;

  // Accurate, registry-driven totals — no event-stream dependency.
  const total = projects.length;
  const activeToday = projects.filter((p) => p.activeUsersToday > 0).length;
  const activeUsers7d = projects.reduce((s, p) => s + p.activeUsers7d, 0);
  const sessions7d = projects.reduce((s, p) => s + p.sessions7d, 0);
  const businessActivity = projects.reduce((s, p) => s + p.businessEvents7d, 0);

  const healthy = projects.filter((p) => p.status === 'healthy').length;
  const warning = projects.filter((p) => p.status === 'warning').length;
  const critical = projects.filter((p) => p.status === 'critical').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products Directory"
        description="Every connected product — its health, who's using it, and when it was last active."
      />

      {/* Products Connected + operational Product Activity (no raw event counts) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Products connected" value={String(total)} icon={Boxes}
          trend={{ direction: 'flat', label: `${activeToday} active today` }} />
        <KpiCard label="Active staff (7d)" value={fmt.format(activeUsers7d)} icon={Users}
          trend={{ direction: 'flat', label: 'across all products' }} href="/dashboard/sessions" />
        <KpiCard label="Active sessions (7d)" value={fmt.format(sessions7d)} icon={Zap}
          trend={{ direction: 'flat', label: 'work sessions' }} href="/dashboard/sessions" />
        <KpiCard label="Business activities (7d)" value={fmt.format(businessActivity)} icon={Activity}
          trend={{ direction: 'flat', label: 'operational actions, not page views' }} />
      </section>

      {/* Replaced the Events-vs-Users bar chart with an actionable health overview */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Product health overview" description="How many products are healthy vs need attention" className="lg:col-span-1">
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

      {/* The directory table */}
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
                {projects.map((p) => {
                  const meta = STATUS_META[p.status];
                  return (
                    <tr key={p.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/projects/${p.slug}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 capitalize text-muted-foreground">{p.projectType}</td>
                      <td className="px-2 py-2 capitalize text-muted-foreground">{p.environment}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1.5 ${meta.tone}`}>
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
                        </span>
                      </td>
                      <td className={`px-2 py-2 text-right font-semibold tabular-nums ${scoreTone(p.healthScore)}`}>{p.healthScore}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(p.activeUsers7d)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {p.lastActivityAt ? formatRelativeTime(p.lastActivityAt) : 'never'}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{fmtDate(p.createdAt)}</td>
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

function Empty() {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <HeartPulse className="h-6 w-6" />
      No products connected yet. Add one from Admin → Connected Products.
    </div>
  );
}
