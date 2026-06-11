import { Building2, Clock, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchAppUsers, fetchUserProfileSummaries } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { PeopleTable, type PersonRow } from './PeopleTable';

export const dynamic = 'force-dynamic';

/** Compact human duration for an average/mean session length in minutes. */
function fmtAvg(min: number): string {
  if (!min || min < 1) return '—';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

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
  const rows: PersonRow[] = users.map((u) => ({
    userId: u.userId, displayName: u.displayName, email: u.email, department: u.department,
    appsUsed: 1, totalEvents: u.totalEvents, totalSessions: u.totalSessions,
    avgSessionMinutes: 0, lastActiveAt: u.lastActiveAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${appName} — Staff`}
        description={`Staff active in ${appName}, with their activity and when they were last seen.`}
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

      <section className="grid gap-4 sm:grid-cols-2">
        <KpiCard label={`Staff in ${appName}`} value={users.length.toLocaleString()} icon={Users}
          trend={{ direction: 'flat', label: `Active in ${appName}` }} />
        <KpiCard label="Guest sessions" value={users.filter((u) => !u.email).length.toLocaleString()} icon={Building2}
          trend={{ direction: 'flat', label: 'Auto-named once the app identifies them' }} />
      </section>

      {users.length === 0 ? (
        <EmptyState appName={appName} />
      ) : (
        <ChartCard title={`People in ${appName}`} description="Search, filter and sort — click anyone for their full activity profile">
          <PeopleTable rows={rows} mode="app" />
        </ChartCard>
      )}
    </div>
  );
}

async function CrossAppDirectory() {
  const users = await fetchUserProfileSummaries(200);
  // Org-wide mean session length, over staff who have at least one timed session.
  const timed = users.filter((u) => u.avgSessionMinutes > 0);
  const orgAvgSessionMin = timed.length
    ? Math.round(timed.reduce((s, u) => s + u.avgSessionMinutes, 0) / timed.length)
    : 0;
  const rows: PersonRow[] = users.map((u) => ({
    userId: u.userId, displayName: u.displayName, email: u.email, department: u.department,
    appsUsed: u.appsUsed, totalEvents: u.totalEvents, totalSessions: u.totalSessions,
    avgSessionMinutes: u.avgSessionMinutes, lastActiveAt: u.lastActiveAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Directory"
        description="Which staff members are actively using which products, and who has gone quiet?"
        actions={
          <ExportButton
            filename="people"
            headers={['Name', 'Email / ID', 'Apps used', 'Events', 'Sessions', 'Avg session (min)', 'Total time (min)', 'Last active']}
            rows={users.map((u) => [
              u.displayName ?? '—', u.email ?? u.userId, u.appsUsed, u.totalEvents, u.totalSessions,
              u.avgSessionMinutes, u.totalSessionMinutes, u.lastActiveAt ?? '',
            ])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="People tracked" value={users.length.toLocaleString()} icon={Building2}
          trend={{ direction: 'flat', label: 'Across all products' }} />
        <KpiCard label="Avg session time" value={fmtAvg(orgAvgSessionMin)} icon={Clock}
          trend={{ direction: 'flat', label: 'Mean login-to-logout, all staff' }} />
        <KpiCard label="Guest sessions" value={users.filter((u) => !u.email).length.toLocaleString()} icon={Users}
          trend={{ direction: 'flat', label: 'Auto-named once a product identifies them' }} />
      </section>

      {users.length === 0 ? (
        <EmptyState />
      ) : (
        <ChartCard title="People" description="Search, filter and sort — click anyone for their full activity profile">
          <PeopleTable rows={rows} mode="cross" />
        </ChartCard>
      )}
    </div>
  );
}

function EmptyState({ appName }: { appName?: string }) {
  const where = appName ?? 'a connected product';
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
      <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">No staff found yet</div>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Staff appear here once they sign into {where}. Names appear automatically when the product passes identity information.
      </p>
    </div>
  );
}
