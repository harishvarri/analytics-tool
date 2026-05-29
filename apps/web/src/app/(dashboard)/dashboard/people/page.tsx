import Link from 'next/link';
import { Building2, UserCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchAppUsers, fetchOrgDirectoryRollup, fetchUserProfileSummaries } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = {
  active:   'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  inactive: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
  invited:  'border-amber-500/40 text-amber-600 dark:text-amber-400',
};

interface PageProps {
  searchParams: Promise<{ app?: string }>;
}

export default async function DirectoryPage({ searchParams }: PageProps) {
  const { app } = await searchParams;
  // When an Application is selected in the topbar, show that app's own users
  // (works per-app from each app's login — no central directory required).
  if (app) return <AppDirectory appSlug={app} />;
  return <CrossAppDirectory />;
}

// ── Per-app people (driven by each app identifying its own users) ─────────────
async function AppDirectory({ appSlug }: { appSlug: string }) {
  const users = await fetchAppUsers(appSlug, 200);
  const appName = getPortalConfig(appSlug).name;
  const identified = users.filter((u) => u.email);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${appName} — People`}
        description={`Users active in ${appName}, with their activity and last seen. Identified users appear when the app logs them in.`}
        actions={
          <ExportButton
            filename={`people-${appSlug}`}
            headers={['Name', 'Email / ID', 'Department', 'Events', 'Sessions', 'First seen', 'Last active']}
            rows={users.map((u) => [
              u.displayName ?? '—', u.email ?? u.userId, u.department ?? '',
              u.totalEvents, u.totalSessions, u.firstSeenAt ?? '', u.lastActiveAt ?? '',
            ])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="People in this app" value={users.length.toLocaleString()} icon={Users}
          trend={{ direction: 'flat', label: 'Active in the window' }} />
        <KpiCard label="Identified" value={identified.length.toLocaleString()} icon={UserCheck}
          trend={{ direction: 'flat', label: 'Logged-in (have email)' }} />
        <KpiCard label="Anonymous" value={(users.length - identified.length).toLocaleString()} icon={Building2}
          trend={{ direction: 'flat', label: 'Not yet identified' }} />
      </section>

      {users.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="text-sm font-medium">No people for {appName} yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Once {appName} sends events that identify the logged-in user
            (<code className="rounded bg-muted px-1 text-[10px]">window.ncpl.identify(...)</code> on login),
            its people and their activity appear here.
          </p>
        </div>
      ) : (
        <ChartCard title={`People in ${appName}`} description="Most recently active first">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Person</th>
                  <th className="px-2 py-2 text-left font-medium">Department</th>
                  <th className="px-2 py-2 text-right font-medium">Events</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <Link href={`/dashboard/people/${u.userId}`} className="hover:underline">
                        <div className="font-medium">{u.displayName ?? (u.email ? u.email : 'Anonymous')}</div>
                        <div className="text-[10px] text-muted-foreground">{u.email ?? u.userId.slice(0, 8)}</div>
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{u.department ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{u.totalEvents.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{u.totalSessions.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : '—'}
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

async function CrossAppDirectory() {
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
                      <Link href={`/dashboard/people/${u.userId}`} className="hover:underline">
                        <div className="font-medium">{u.displayName ?? '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{u.email ?? u.userId.slice(0, 8)}</div>
                      </Link>
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
