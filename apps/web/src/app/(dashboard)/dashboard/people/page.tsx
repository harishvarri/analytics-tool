import Link from 'next/link';
import { Building2, UserCheck, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchAppUsers, fetchUserProfileSummaries } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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
  const users = await fetchUserProfileSummaries(200);
  const identified = users.filter((u) => u.email);

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Everyone who has used your apps — the apps they use and when they were last active. Pick an app in the top filter to focus on one."
        actions={
          <ExportButton
            filename="people"
            headers={['Name', 'Email / ID', 'Apps used', 'Events', 'Sessions', 'Last active']}
            rows={users.map((u) => [
              u.displayName ?? '—', u.email ?? u.userId, u.appsUsed, u.totalEvents, u.totalSessions, u.lastActiveAt ?? '',
            ])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="People seen" value={users.length.toLocaleString()} icon={Building2}
          trend={{ direction: 'flat', label: 'Across all apps' }} />
        <KpiCard label="Identified" value={identified.length.toLocaleString()} icon={UserCheck}
          trend={{ direction: 'flat', label: 'Logged-in (have a name/email)' }} />
        <KpiCard label="Anonymous" value={(users.length - identified.length).toLocaleString()} icon={Users}
          trend={{ direction: 'flat', label: 'Not yet identified by the app' }} />
      </section>

      {users.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No people yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            People appear once your apps send events. To show real names instead of
            &quot;Anonymous&quot;, each app calls{' '}
            <code className="rounded bg-muted px-1 text-[10px]">window.ncpl.identify(...)</code> on login.
          </p>
        </div>
      ) : (
        <ChartCard title="People" description="Most recently active first — click anyone for their full activity profile">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Person</th>
                  <th className="px-2 py-2 text-right font-medium">Apps used</th>
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
                    <td className="px-2 py-2 text-right tabular-nums">{u.appsUsed}</td>
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
