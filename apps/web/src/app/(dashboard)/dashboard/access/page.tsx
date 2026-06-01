import { KeyRound, UserCheck, UserX, Percent } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchAccessVsUsage, fetchInactiveWithAccess } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

function adoptionTone(pct: number): string {
  if (pct >= 60) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function AccessAnalyticsPage() {
  const [rows, inactive] = await Promise.all([
    fetchAccessVsUsage(30),
    fetchInactiveWithAccess(50),
  ]);

  const totalAccess = rows.reduce((s, r) => s + r.usersWithAccess, 0);
  const totalAdopted = rows.reduce((s, r) => s + r.adoptedUsers, 0);
  const totalUnused = rows.reduce((s, r) => s + r.accessNeverUsed, 0);
  const avgAdoption = totalAccess > 0 ? Math.round((totalAdopted / totalAccess) * 100) : 0;
  const maxAccess = Math.max(1, ...rows.map((r) => r.usersWithAccess));
  const hasData = rows.some((r) => r.usersWithAccess > 0);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title="Access Analytics"
        description="Who has access to each product versus who actually uses it — and where licenses are going to waste."
        actions={
          <ExportButton
            filename="access-vs-usage"
            headers={['Product', 'Users with access', 'Adopted (30d)', 'Never used', 'Adoption %']}
            rows={rows.map((r) => [r.projectName, r.usersWithAccess, r.adoptedUsers, r.accessNeverUsed, r.adoptionPct])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total access grants" value={fmt.format(totalAccess)} icon={KeyRound}
          trend={{ direction: 'flat', label: `${rows.length} products` }} />
        <KpiCard label="Actually using (30d)" value={fmt.format(totalAdopted)} icon={UserCheck}
          trend={{ direction: 'flat', label: 'distinct adopters' }} />
        <KpiCard label="Avg adoption" value={`${avgAdoption}%`} icon={Percent}
          trend={{ direction: avgAdoption >= 50 ? 'flat' : 'down', label: 'access that converts to use' }} />
        <KpiCard label="Granted, never used" value={fmt.format(totalUnused)} icon={UserX}
          trend={{ direction: totalUnused > 0 ? 'up' : 'flat', label: 'reclaimable access' }} invertTrend />
      </section>

      {!hasData ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No access grants recorded yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Access data flows from your SSO/directory sync into <code>analytics_user_access</code>.
            Once products report who can access them, this page shows adoption of that access.
          </p>
        </div>
      ) : (
        <ChartCard
          title="Adoption of access, by product"
          description="How many people who can use each product actually did in the last 30 days"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-right font-medium">Has access</th>
                  <th className="px-2 py-2 text-right font-medium">Using (30d)</th>
                  <th className="px-2 py-2 text-right font-medium">Never used</th>
                  <th className="px-2 py-2 text-right font-medium">Adoption</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.projectSlug} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2 font-medium">{r.projectName}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.usersWithAccess / maxAccess) * 100}%` }} />
                        </div>
                        <span className="tabular-nums font-semibold">{fmt.format(r.usersWithAccess)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt.format(r.adoptedUsers)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(r.accessNeverUsed)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${adoptionTone(r.adoptionPct)}`}>{r.adoptionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {inactive.length > 0 && (
        <ChartCard
          title="Has access, gone quiet"
          description="People who can use a product but haven't been active in 30+ days — candidates to follow up or reclaim access"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Person</th>
                  <th className="px-2 py-2 text-left font-medium">Department</th>
                  <th className="px-2 py-2 text-right font-medium">Products w/ access</th>
                  <th className="px-2 py-2 text-right font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {inactive.map((u) => (
                  <tr key={u.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <div className="font-medium">{u.displayName ?? u.email ?? u.userId.slice(0, 8)}</div>
                      {u.email && u.displayName ? <div className="text-muted-foreground">{u.email}</div> : null}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{u.department ?? '—'}{u.team ? ` · ${u.team}` : ''}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{u.projectsWithAccess}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : 'never'}
                    </td>
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
