import { UserX } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchInactiveUsers } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InactiveUsersPage() {
  const rows = await fetchInactiveUsers(200);
  const neverActive = rows.filter((r) => r.daysInactive === null).length;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inactive Users"
        description="People who have access to an app but haven't used anything in the last 30 days (or never have)."
        actions={
          <ExportButton
            filename="inactive-users"
            headers={['Name', 'Email', 'Department', 'Projects with access', 'Last active', 'Days inactive']}
            rows={rows.map((r) => [
              r.displayName ?? '—', r.email ?? r.userId, r.department ?? '',
              r.projectsWithAccess, r.lastActiveAt ?? 'never', r.daysInactive ?? '',
            ])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Inactive (≥30 days)" value={rows.length.toLocaleString()} icon={UserX}
          trend={{ direction: rows.length > 0 ? 'up' : 'flat', label: 'Have access, not using' }} invertTrend />
        <KpiCard label="Never active" value={neverActive.toLocaleString()} icon={UserX}
          trend={{ direction: neverActive > 0 ? 'up' : 'flat', label: 'Access granted, never logged activity' }} invertTrend />
      </section>

      {!hasData ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <UserX className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-sm font-medium">No inactive users</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Everyone with access has been active recently — or the directory + access map hasn&apos;t been
            populated yet (pushed from your central login system to{' '}
            <code className="rounded bg-muted px-1 text-[10px]">/api/v1/directory</code>).
          </p>
        </div>
      ) : (
        <ChartCard title="Idle people with access" description="Longest-idle first">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Person</th>
                  <th className="px-2 py-2 text-left font-medium">Department</th>
                  <th className="px-2 py-2 text-right font-medium">Access to</th>
                  <th className="px-2 py-2 text-right font-medium">Last active</th>
                  <th className="px-2 py-2 text-right font-medium">Idle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.displayName ?? '—'}</div>
                      <div className="text-[10px] text-muted-foreground">{r.email ?? r.userId.slice(0, 8)}</div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{r.department ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.projectsWithAccess} app{r.projectsWithAccess === 1 ? '' : 's'}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {r.lastActiveAt ? formatRelativeTime(r.lastActiveAt) : 'never'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">
                      {r.daysInactive === null ? 'never used' : `${r.daysInactive}d`}
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
