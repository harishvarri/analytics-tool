import Link from 'next/link';
import { Activity, ArrowLeft, Boxes, Clock, LogIn, ShieldCheck, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { UserTimeline } from '@/components/analytics/UserTimeline';
import { fetchUserDetail } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { isOperationalEvent } from '@/lib/importance';
import { riskFromLastActive } from '@/lib/user-risk';
import { computeProductivity } from '@/lib/productivity';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ userId: string }>;
}

const fmt = new Intl.NumberFormat('en-US');

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
        <Link href="/dashboard/people" className="text-sm text-primary hover:underline">← Back to People</Link>
      </div>
    );
  }

  const name = u.displayName ?? u.email ?? 'Anonymous user';
  const risk = riskFromLastActive(u.lastActiveAt);

  // Operational-only view of recent activity (drop page views / clicks / perf).
  const opEvents = u.recent.filter((e) => isOperationalEvent(e.category, e.name));
  const businessActions = opEvents.length;
  const errorsTriggered = u.recent.filter((e) => e.category === 'error').length;

  // App usage breakdown (% of this person's events per product).
  const totalAppEvents = u.apps.reduce((s, a) => s + a.events, 0) || 1;
  const appUsage = [...u.apps]
    .sort((a, b) => b.events - a.events)
    .map((a) => ({ slug: a.projectSlug, name: getPortalConfig(a.projectSlug).name, events: a.events, pct: Math.round((a.events / totalAppEvents) * 100), lastActive: a.lastActive }));
  const mostUsed = appUsage[0]?.name ?? '—';

  // Productivity score (0–100) from real activity signals.
  const productivity = computeProductivity({
    activeMinutes: u.totalSessionMinutes,
    businessActions,
    sessions: u.totalSessions,
    productsUsed: u.apps.length,
    errors: errorsTriggered,
  });
  const prodTone = productivity.band === 'high'
    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
    : productivity.band === 'medium'
      ? 'border-amber-500/40 text-amber-600 dark:text-amber-400'
      : 'border-rose-500/40 text-rose-600 dark:text-rose-400';

  return (
    <div className="space-y-6">
      <Link href="/dashboard/people" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Staff Directory
      </Link>

      <PageHeader
        title={name}
        description={
          [u.email, u.title, u.department && (u.team ? `${u.department} · ${u.team}` : u.department)]
            .filter(Boolean).join('  ·  ') || 'Anonymous visitor (not yet identified by the app)'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={prodTone}>Productivity {productivity.score}</Badge>
            <Badge variant="outline" className={risk.tone}>
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${risk.dot}`} />{risk.label}
            </Badge>
            <Badge variant="outline" className={STATUS_TONE[u.status] ?? ''}>{u.status}</Badge>
          </div>
        }
      />

      {/* Productivity snapshot */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Productivity score" value={String(productivity.score)} icon={Activity}
          trend={{ direction: productivity.band === 'high' ? 'up' : productivity.band === 'low' ? 'down' : 'flat', label: `${productivity.band} — time+actions+sessions−errors` }} />
        <KpiCard label="Most used product" value={mostUsed} icon={Boxes}
          trend={{ direction: 'flat', label: `${u.apps.length} product(s) used` }} />
        <KpiCard label="Active time" value={fmtDuration(u.totalSessionMinutes)} icon={Clock}
          trend={{ direction: 'flat', label: `${fmt.format(u.totalSessions)} sessions` }} />
        <KpiCard label="Business actions" value={fmt.format(businessActions)} icon={Activity}
          trend={{ direction: 'flat', label: 'operational, recent' }} />
        <KpiCard label="Errors triggered" value={fmt.format(errorsTriggered)} icon={ShieldCheck}
          trend={{ direction: errorsTriggered > 0 ? 'up' : 'flat', label: 'recent' }} invertTrend />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Logins" value={fmt.format(u.logins)} icon={LogIn}
          trend={{ direction: 'flat', label: 'recent sign-ins' }} />
        <KpiCard label="Sessions" value={fmt.format(u.totalSessions)} icon={Zap}
          trend={{ direction: 'flat', label: 'total visits' }} />
        <KpiCard label="Total actions" value={fmt.format(u.totalEvents)} icon={Activity}
          trend={{ direction: 'flat', label: 'all events' }} />
        <KpiCard label="Last active" value={u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : '—'} icon={Clock}
          trend={{ direction: 'flat', label: u.firstSeenAt ? `First seen ${formatRelativeTime(u.firstSeenAt)}` : 'No activity' }} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* App usage breakdown */}
        <ChartCard title="App usage" description="Share of this person's activity across products">
          {appUsage.length > 0 ? (
            <ul className="space-y-3 pt-1">
              {appUsage.map((a) => (
                <li key={a.slug} className="text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="tabular-nums text-muted-foreground">{a.pct}% · {fmt.format(a.events)} actions</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${a.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No app activity</div>
          )}
        </ChartCard>

        {/* Important activities timeline (operational only, across apps) */}
        <ChartCard title="Important activities" description="Business actions across every product — newest first (page views & clicks hidden)">
          <UserTimeline events={opEvents.slice(0, 40)} userName={name} empty="No business activity recorded yet." />
        </ChartCard>
      </section>

      {!u.email && (
        <section className="rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-4 text-xs text-muted-foreground">
          This is an <strong>anonymous visitor</strong> — the app hasn&apos;t identified them yet. Add{' '}
          <code className="rounded bg-muted px-1 text-[10px]">window.ncpl.identify(null, &#123; email, name &#125;)</code> on login to
          see the real person here.
        </section>
      )}
    </div>
  );
}
