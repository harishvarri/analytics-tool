import { Building2, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchDepartmentActivity, fetchDepartmentRollup } from '@/lib/data/fetchers';
import { rangeToDays, rangeLabel } from '@/lib/range';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function DepartmentAnalyticsPage({ searchParams }: PageProps) {
  const { range } = await searchParams;
  const days = rangeToDays(range);
  const [activity, rollup] = await Promise.all([
    fetchDepartmentActivity(days),
    fetchDepartmentRollup(),
  ]);

  // Roll team-level directory rows up to department headcount.
  const headcount = new Map<string, { total: number; active: number; inactive: number; invited: number }>();
  for (const r of rollup) {
    const cur = headcount.get(r.department) ?? { total: 0, active: 0, inactive: 0, invited: 0 };
    cur.total += r.totalUsers;
    cur.active += r.activeUsers;
    cur.inactive += r.inactiveUsers;
    cur.invited += r.invitedUsers;
    headcount.set(r.department, cur);
  }

  const totalStaff = Array.from(headcount.values()).reduce((s, d) => s + d.total, 0);
  const mostActive = activity[0] ?? null;                       // already sorted desc by events
  const leastActive = activity.length > 1 ? activity[activity.length - 1] : null;
  const maxEvents = Math.max(1, ...activity.map((d) => d.events));
  const hasActivity = activity.length > 0;
  const hasHeadcount = headcount.size > 0;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={120_000} />
      <PageHeader
        title="Department Analytics"
        description="How engagement and headcount break down across departments and teams."
        actions={
          <ExportButton
            filename="department-activity"
            headers={['Department', 'Events (30d)', 'Active users', 'Sessions', 'Errors']}
            rows={activity.map((d) => [d.department, d.events, d.users, d.sessions, d.errors])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Staff in directory" value={fmt.format(totalStaff)} icon={Users}
          trend={{ direction: 'flat', label: `${headcount.size} departments` }} />
        <KpiCard label="Departments active (30d)" value={String(activity.length)} icon={Building2}
          trend={{ direction: 'flat', label: 'with recorded activity' }} />
        <KpiCard label="Most active" value={mostActive?.department ?? '—'} icon={TrendingUp}
          trend={mostActive ? { direction: 'up', label: `${fmt.format(mostActive.events)} actions` } : { direction: 'flat', label: 'no data' }} />
        <KpiCard label="Least active" value={leastActive?.department ?? '—'} icon={TrendingDown}
          trend={leastActive ? { direction: 'down', label: `${fmt.format(leastActive.events)} actions` } : { direction: 'flat', label: 'needs 2+ depts' }} />
      </section>

      {!hasActivity && !hasHeadcount ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No department data yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Department and team come from each app&apos;s <code>identify()</code> call. Once staff are
            tagged with a department, their activity rolls up here.
          </p>
        </div>
      ) : (
        <>
          {hasActivity && (
            <ChartCard
              title={`Activity by department — ${rangeLabel(range).toLowerCase()}`}
              description="Which teams are getting the most value out of the products"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-2 py-2 text-left font-medium">Department</th>
                      <th className="px-2 py-2 text-right font-medium">Actions</th>
                      <th className="px-2 py-2 text-right font-medium">Active users</th>
                      <th className="px-2 py-2 text-right font-medium">Sessions</th>
                      <th className="px-2 py-2 text-right font-medium">Problems</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((d) => (
                      <tr key={d.department} className="border-b last:border-b-0 hover:bg-muted/40">
                        <td className="px-2 py-2 font-medium">{d.department}</td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(d.events / maxEvents) * 100}%` }} />
                            </div>
                            <span className="tabular-nums font-semibold">{fmt.format(d.events)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt.format(d.users)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(d.sessions)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt.format(d.errors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {hasHeadcount && (
            <ChartCard
              title="Headcount by department"
              description="Directory composition — active, inactive, and invited staff per department"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-2 py-2 text-left font-medium">Department</th>
                      <th className="px-2 py-2 text-right font-medium">Total</th>
                      <th className="px-2 py-2 text-right font-medium">Active</th>
                      <th className="px-2 py-2 text-right font-medium">Inactive</th>
                      <th className="px-2 py-2 text-right font-medium">Invited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(headcount.entries())
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([dept, h]) => (
                        <tr key={dept} className="border-b last:border-b-0 hover:bg-muted/40">
                          <td className="px-2 py-2 font-medium">{dept}</td>
                          <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmt.format(h.total)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmt.format(h.active)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(h.inactive)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(h.invited)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
