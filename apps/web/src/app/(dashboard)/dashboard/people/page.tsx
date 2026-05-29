import { Building2, UserCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchOrgDirectoryRollup, fetchUserProfileSummaries } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = {
  active:   'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  inactive: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
  invited:  'border-amber-500/40 text-amber-600 dark:text-amber-400',
};

export default async function DirectoryPage() {
  const [users, rollup] = await Promise.all([
    fetchUserProfileSummaries(100),
    fetchOrgDirectoryRollup(),
  ]);

  const totalKnown = rollup.reduce((s, r) => s + r.totalUsers, 0);
  const totalActive = rollup.reduce((s, r) => s + r.activeUsers, 0);
  const departments = new Set(rollup.map((r) => r.department)).size;
  const hasData = users.length > 0 || rollup.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="People Directory"
        description="Everyone known to the platform — their department, role, the apps they use, and when they were last active."
        actions={
          <ExportButton
            filename="people-directory"
            headers={['Name', 'Email', 'Department', 'Team', 'Status', 'Apps used', 'Events', 'Last active']}
            rows={users.map((u) => [
              u.displayName ?? '—', u.email ?? u.userId, u.department ?? '', u.team ?? '',
              u.status, u.appsUsed, u.totalEvents, u.lastActiveAt ?? '',
            ])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Known people" value={totalKnown.toLocaleString()} icon={Building2}
          trend={{ direction: 'flat', label: 'In the directory' }} />
        <KpiCard label="Active" value={totalActive.toLocaleString()} icon={UserCheck}
          trend={{ direction: 'flat', label: 'Status = active' }} />
        <KpiCard label="Departments" value={String(departments)} icon={Users}
          trend={{ direction: 'flat', label: 'Distinct departments' }} />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No people in the directory yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            The directory fills when your central login system pushes its user list to{' '}
            <code className="rounded bg-muted px-1 text-[10px]">/api/v1/directory</code>, or when apps send
            events that include the user&apos;s email. Anonymous visitors are not shown here.
          </p>
        </div>
      )}

      {rollup.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rollup.map((r) => (
            <div key={`${r.department}-${r.team}`} className="rounded-md border bg-card p-3">
              <div className="text-sm font-semibold">{r.department}</div>
              <div className="text-[11px] text-muted-foreground">{r.team}</div>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className="font-semibold tabular-nums">{r.totalUsers}</span>
                <span className="text-emerald-600 dark:text-emerald-400">{r.activeUsers} active</span>
                {r.inactiveUsers > 0 && <span className="text-rose-600 dark:text-rose-400">{r.inactiveUsers} inactive</span>}
              </div>
            </div>
          ))}
        </section>
      )}

      {users.length > 0 && (
        <ChartCard title="People" description="Sorted by most recent activity">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Person</th>
                  <th className="px-2 py-2 text-left font-medium">Department</th>
                  <th className="px-2 py-2 text-right font-medium">Apps used</th>
                  <th className="px-2 py-2 text-right font-medium">Events</th>
                  <th className="px-2 py-2 text-right font-medium">Last active</th>
                  <th className="px-2 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <div className="font-medium">{u.displayName ?? '—'}</div>
                      <div className="text-[10px] text-muted-foreground">{u.email ?? u.userId.slice(0, 8)}</div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {u.department ?? '—'}{u.team ? ` · ${u.team}` : ''}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{u.appsUsed}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{u.totalEvents.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Badge variant="outline" className={STATUS_TONE[u.status] ?? ''}>{u.status}</Badge>
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
