import Link from 'next/link';
import { Activity, ArrowLeft, Boxes, Clock, LogIn, ShieldCheck, Timer, Zap, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { UserTimeline } from '@/components/analytics/UserTimeline';
import { fetchUserDetail, fetchUserActivityWindow } from '@/lib/data/fetchers';
import type { ActivityRange } from '@/lib/repositories/operational';
import { getPortalConfig } from '@/config/portals';
import { riskFromLastActive } from '@/lib/user-risk';
import { computeProductivity } from '@/lib/productivity';
import { friendlyEventName } from '@/lib/event-labels';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ range?: string }>;
}

const fmt = new Intl.NumberFormat('en-US');

function fmtDuration(min: number): string {
  if (min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const RANGES: { key: ActivityRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const RANGE_NOUN: Record<ActivityRange, string> = {
  today: 'today', yesterday: 'yesterday', week: 'this week', month: 'this month', all: 'all time',
};

const STATUS_TONE: Record<string, string> = {
  active:   'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  inactive: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
  invited:  'border-amber-500/40 text-amber-600 dark:text-amber-400',
};

function isRange(v: string | undefined): v is ActivityRange {
  return v === 'today' || v === 'yesterday' || v === 'week' || v === 'month' || v === 'all';
}

export default async function UserDetailPage({ params, searchParams }: PageProps) {
  const { userId } = await params;
  const { range: rangeParam } = await searchParams;
  const range: ActivityRange = isRange(rangeParam) ? rangeParam : 'all';

  const [u, win] = await Promise.all([fetchUserDetail(userId), fetchUserActivityWindow(userId, range)]);

  if (!u) {
    return (
      <div className="space-y-6">
        <PageHeader title="User" description="No activity found for this user." />
        <Link href="/dashboard/people" className="text-sm text-primary hover:underline">← Back to Staff Directory</Link>
      </div>
    );
  }

  const name = u.displayName ?? u.email ?? 'Guest';
  const risk = riskFromLastActive(u.lastActiveAt);
  const noun = RANGE_NOUN[range];

  // Productivity for the selected period (event-driven).
  const productivity = computeProductivity({
    activeMinutes: win.activeMinutes,
    businessActions: win.businessActions,
    sessions: win.sessions,
    productsUsed: win.productsUsed,
    errors: win.errors,
  });
  const prodTone = productivity.band === 'high'
    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
    : productivity.band === 'medium'
      ? 'border-amber-500/40 text-amber-600 dark:text-amber-400'
      : 'border-rose-500/40 text-rose-600 dark:text-rose-400';

  // App usage for the period.
  const totalAppEvents = win.apps.reduce((s, a) => s + a.events, 0) || 1;
  const appUsage = win.apps
    .map((a) => ({ slug: a.slug, name: getPortalConfig(a.slug).name, events: a.events, pct: Math.round((a.events / totalAppEvents) * 100) }));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/people" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Staff Directory
      </Link>

      <PageHeader
        title={name}
        description={
          [u.email, u.title, u.department && (u.team ? `${u.department} · ${u.team}` : u.department)]
            .filter(Boolean).join('  ·  ') || 'Guest — not yet identified by the product'
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

      {/* Lifetime context line */}
      <p className="-mt-2 text-xs text-muted-foreground">
        {u.firstSeenAt ? `First seen ${formatRelativeTime(u.firstSeenAt)}` : 'No activity yet'}
        {u.lastActiveAt ? `  ·  last active ${formatRelativeTime(u.lastActiveAt)}` : ''}
        {`  ·  ${fmt.format(u.totalEvents)} lifetime actions`}
      </p>

      {/* ── Page-level period filter ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Period:</span>
        {RANGES.map((r) => {
          const active = r.key === range;
          return (
            <Link
              key={r.key}
              href={`/dashboard/people/${userId}?range=${r.key}`}
              scroll={false}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* ── Period analytics — clean 4-up grid, no orphan cards ───────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Events" value={fmt.format(win.events)} icon={Activity}
          trend={{ direction: 'flat', label: `all events ${noun}` }} />
        <KpiCard label="Business actions" value={fmt.format(win.businessActions)} icon={Activity}
          trend={{ direction: 'flat', label: 'meaningful work' }} />
        <KpiCard label="Active time" value={fmtDuration(win.activeMinutes)} icon={Clock}
          trend={{ direction: 'flat', label: `${fmt.format(win.sessions)} sessions` }} />
        <KpiCard label="Avg session" value={fmtDuration(win.avgSessionMin)} icon={Timer}
          trend={{ direction: 'flat', label: 'average time per visit' }} />

        <KpiCard label="Sessions" value={fmt.format(win.sessions)} icon={Zap}
          trend={{ direction: 'flat', label: `started ${noun}` }} />
        <KpiCard label="Logins" value={fmt.format(win.logins)} icon={LogIn}
          trend={{ direction: 'flat', label: 'sign-ins' }} />
        <KpiCard label="Errors" value={fmt.format(win.errors)} icon={ShieldCheck} invertTrend
          trend={{ direction: win.errors > 0 ? 'up' : 'flat', label: 'triggered' }} />
        <KpiCard label="Active days" value={fmt.format(win.activeDays)} icon={CalendarDays}
          trend={{ direction: 'flat', label: `days worked ${noun}` }} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* App usage breakdown for the period */}
        <ChartCard title="App usage" description={`Share of activity across products — ${noun}`}>
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
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No activity {noun}</div>
          )}
        </ChartCard>

        {/* Most frequent actions for the period */}
        <ChartCard title="Most frequent actions" description={`What this person did most — ${noun}`}>
          {win.topActions.length > 0 ? (
            <ul className="space-y-2 pt-1">
              {win.topActions.map((a) => (
                <li key={a.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                    {friendlyEventName(a.label, null, null)}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">×{fmt.format(a.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No business actions {noun}</div>
          )}
        </ChartCard>
      </section>

      {/* Activity timeline for the period */}
      <ChartCard title="Important activities" description={`Business actions across every product, ${noun} — newest first (page views & clicks hidden)`}>
        <UserTimeline events={win.timeline} userName={name} empty={`No business activity ${noun}.`} />
      </ChartCard>

      {!u.email && (
        <section className="rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-4 text-xs text-muted-foreground">
          This is a <strong>guest</strong> — the product hasn&apos;t identified them yet. Add{' '}
          <code className="rounded bg-muted px-1 text-[10px]">window.ncpl.identify(null, &#123; email, name &#125;)</code> on login to
          see the real person here.
        </section>
      )}
    </div>
  );
}
