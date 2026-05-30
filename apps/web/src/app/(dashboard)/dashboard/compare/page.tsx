import { Boxes, Bug, Layers, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchProjectComparison } from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

function errorTone(pct: number): string {
  if (pct === 0)   return 'text-emerald-600 dark:text-emerald-400';
  if (pct < 2)     return 'text-amber-600  dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function stickyTone(pct: number): string {
  if (pct >= 50) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 25) return 'text-amber-600  dark:text-amber-400';
  return 'text-muted-foreground';
}

interface PageProps {
  searchParams: Promise<{ app?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { app: selectedApp } = await searchParams;
  const allRows = await fetchProjectComparison();
  // BUG-012: filter by the topbar app selection when set
  const rows = selectedApp ? allRows.filter((r) => r.portalId === selectedApp) : allRows;
  const active = rows.filter((r) => r.events30d > 0);

  const totalUsers = rows.reduce((s, r) => s + r.users30d, 0);
  const totalErrors = rows.reduce((s, r) => s + r.errors30d, 0);
  const maxUsers = Math.max(1, ...rows.map((r) => r.users30d));

  const hasData = active.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare Applications"
        description="All your apps side by side — how many people use them, how engaged they are, and how many errors they hit (last 30 days)."
        actions={
          <ExportButton
            filename="cross-project-comparison"
            headers={[
              'Application', 'Users 30d', 'Users 7d', 'Sessions 30d', 'Events 30d',
              'Errors 30d', 'Error rate %', 'Features used', 'Stickiness %',
            ]}
            rows={rows.map((r) => [
              r.portalName, r.users30d, r.users7d, r.sessions30d, r.events30d,
              r.errors30d, r.errorRatePct, r.featuresUsed, r.stickinessPct,
            ])}
          />
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Applications"
          value={String(rows.length)}
          icon={Boxes}
          trend={{ direction: 'flat', label: `${active.length} active` }}
        />
        <KpiCard
          label="Org users (30d)"
          value={totalUsers.toLocaleString()}
          icon={Users}
          trend={{ direction: 'flat', label: 'Across all apps' }}
        />
        <KpiCard
          label="Org errors (30d)"
          value={totalErrors.toLocaleString()}
          icon={Bug}
          trend={{ direction: totalErrors > 0 ? 'up' : 'flat', label: 'All applications' }}
          invertTrend
        />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No application activity yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            As applications send events, this table compares their usage, engagement,
            error rates, and feature breadth — the organization-wide product scorecard.
          </p>
        </div>
      )}

      {/* Comparison table */}
      {hasData && (
        <ChartCard
          title="How each app is doing"
          description="People, activity, errors, and features used — for every app"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Application</th>
                  <th className="px-2 py-2 text-right font-medium">Users 30d</th>
                  <th className="px-2 py-2 text-right font-medium">Users 7d</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Events</th>
                  <th className="px-2 py-2 text-right font-medium">Errors</th>
                  <th className="px-2 py-2 text-right font-medium">Error rate</th>
                  <th className="px-2 py-2 text-right font-medium">Features</th>
                  <th className="px-2 py-2 text-right font-medium">Stickiness</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.portalId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.portalName}</div>
                      <div className="text-[10px] text-muted-foreground">{r.portalId}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.users30d / maxUsers) * 100}%` }} />
                        </div>
                        <span className="tabular-nums font-semibold">{r.users30d.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.users7d.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.sessions30d.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.events30d.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.errors30d.toLocaleString()}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${errorTone(r.errorRatePct)}`}>{r.errorRatePct}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.featuresUsed}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${stickyTone(r.stickinessPct)}`}>{r.stickinessPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
