import Link from 'next/link';
import { Activity, ArrowLeft, Boxes, Clock, LogIn, MousePointerClick } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { EventBadge } from '@/components/analytics/EventBadge';
import { fetchUserDetail } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { friendlyEventName, eventDescription } from '@/lib/event-labels';
import { formatRelativeTime } from '@/lib/utils';
import type { EventCategory } from '@/types/analytics';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ userId: string }>;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_TONE: Record<string, string> = {
  active:   'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  inactive: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
  invited:  'border-amber-500/40 text-amber-600 dark:text-amber-400',
};

export default async function UserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const u = await fetchUserDetail(userId);

  if (!u) {
    return (
      <div className="space-y-6">
        <PageHeader title="User" description="No activity found for this user." />
        <Link href="/dashboard/people" className="text-sm text-primary hover:underline">
          ← Back to People
        </Link>
      </div>
    );
  }

  const name = u.displayName ?? u.email ?? (u.email ? u.email : 'Anonymous user');

  return (
    <div className="space-y-6">
      <Link href="/dashboard/people" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to People
      </Link>

      <PageHeader
        title={name}
        description={
          [u.email, u.title, u.department && (u.team ? `${u.department} · ${u.team}` : u.department)]
            .filter(Boolean)
            .join('  ·  ') || 'Anonymous visitor (not yet identified by the app)'
        }
        actions={<Badge variant="outline" className={STATUS_TONE[u.status] ?? ''}>{u.status}</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Apps used" value={String(u.apps.length)} icon={Boxes}
          trend={{ direction: 'flat', label: 'Distinct applications' }} />
        <KpiCard label="Logins" value={u.logins.toLocaleString()} icon={LogIn}
          trend={{ direction: 'flat', label: 'auth.login events (recent)' }} />
        <KpiCard label="Sessions" value={u.totalSessions.toLocaleString()} icon={Activity}
          trend={{ direction: 'flat', label: 'Total visits' }} />
        <KpiCard label="Time on apps" value={fmtDuration(u.totalSessionMinutes)} icon={Clock}
          trend={{ direction: 'flat', label: 'Total session time' }} />
        <KpiCard label="Actions" value={u.totalEvents.toLocaleString()} icon={MousePointerClick}
          trend={{ direction: 'flat', label: 'Total events' }} />
        <KpiCard label="Last active" value={u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : '—'} icon={Clock}
          trend={{ direction: 'flat', label: u.firstSeenAt ? `First seen ${formatRelativeTime(u.firstSeenAt)}` : 'No activity' }} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* Apps this person uses */}
        <ChartCard title="Apps used" description="Activity per application">
          {u.apps.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Application</th>
                    <th className="px-2 py-2 text-right font-medium">Events</th>
                    <th className="px-2 py-2 text-right font-medium">Sessions</th>
                    <th className="px-2 py-2 text-right font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {u.apps.map((a) => (
                    <tr key={a.projectSlug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2 font-medium">{getPortalConfig(a.projectSlug).name}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.events.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.sessions.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {a.lastActive ? formatRelativeTime(a.lastActive) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No app activity</div>
          )}
        </ChartCard>

        {/* Recent activity timeline */}
        <ChartCard title="Recent activity" description="Most recent actions, newest first">
          {u.recent.length > 0 ? (
            <ul className="space-y-2">
              {u.recent.slice(0, 20).map((e, i) => (
                <li key={`${e.name}-${i}`} className="flex items-start gap-2 text-xs">
                  <EventBadge category={e.category as EventCategory} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium" title={e.name}>{friendlyEventName(e.name)}</span>
                      <span className="shrink-0 text-muted-foreground">{formatRelativeTime(e.occurredAt)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {eventDescription(e.name)} · {getPortalConfig(e.portalId).name}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No recent activity</div>
          )}
        </ChartCard>
      </section>

      {!u.email && (
        <section className="rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-4 text-xs text-muted-foreground">
          This is an <strong>anonymous visitor</strong> — the app hasn&apos;t identified them yet. Add{' '}
          <code className="rounded bg-muted px-1 text-[10px]">window.ncpl.identify(user.id)</code> (or{' '}
          <code className="rounded bg-muted px-1 text-[10px]">identify(null, &#123; email, name &#125;)</code>) on login to
          see the real person here.
        </section>
      )}
    </div>
  );
}
