import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Activity, Users, CalendarDays } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { fetchProjectIntelligenceBySlug, fetchProjectRecentActivity } from '@/lib/data/fetchers';
import { isOperationalEvent } from '@/lib/importance';
import { aggregateActivity } from '@/features/realtime-feed/aggregate';
import { friendlyEventName } from '@/lib/event-labels';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');
const DAY = 86_400_000;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BusinessActivityPage({ params }: PageProps) {
  const { slug } = await params;
  const [p, raw] = await Promise.all([
    fetchProjectIntelligenceBySlug(slug),
    fetchProjectRecentActivity(slug, 1000),
  ]);
  if (!p) notFound();

  const ops = raw.filter((a) => isOperationalEvent(a.category, a.eventName));

  // Activity history — counts by action type.
  const byAction = new Map<string, number>();
  // User actions — counts by actor.
  const byUser = new Map<string, { name: string; userId: string | null; count: number }>();
  // Daily trend — last 14 days.
  const dayBuckets = new Map<string, number>();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) dayBuckets.set(new Date(today.getTime() - i * DAY).toISOString().slice(0, 10), 0);

  for (const a of ops) {
    const label = friendlyEventName(a.eventName, a.metadata, a.url);
    byAction.set(label, (byAction.get(label) ?? 0) + 1);

    const key = a.userId ?? a.userEmail ?? 'guest';
    const name = a.userDisplayName ?? a.userEmail ?? (a.userId ? a.userId.slice(0, 8) : 'Guest');
    const cur = byUser.get(key) ?? { name, userId: a.userId, count: 0 };
    cur.count += 1; byUser.set(key, cur);

    const d = a.occurredAt.slice(0, 10);
    if (dayBuckets.has(d)) dayBuckets.set(d, (dayBuckets.get(d) ?? 0) + 1);
  }

  const actions = [...byAction.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const users = [...byUser.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  const trend = [...dayBuckets.entries()].map(([day, count]) => ({ day, count }));
  const maxAction = Math.max(1, ...actions.map((a) => a.count));
  const maxDay = Math.max(1, ...trend.map((t) => t.count));
  const timeline = aggregateActivity(ops).slice(0, 25);

  const distinctActors = byUser.size;
  const activeDays = trend.filter((t) => t.count > 0).length;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/projects/${slug}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {p.name}
      </Link>

      <PageHeader
        title={`${p.name} — Business Activity`}
        description="Meaningful business actions in this product — history, who's doing them, trends and timeline (page views & clicks hidden)."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Business actions" value={fmt.format(ops.length)} icon={Activity}
          trend={{ direction: 'flat', label: 'recent (page-view noise hidden)' }} />
        <KpiCard label="People acting" value={fmt.format(distinctActors)} icon={Users}
          trend={{ direction: 'flat', label: 'distinct actors' }} />
        <KpiCard label="Active days" value={fmt.format(activeDays)} icon={CalendarDays}
          trend={{ direction: 'flat', label: 'of the last 14' }} />
      </section>

      {/* Daily trend */}
      <ChartCard title="Activity trend" description="Business actions per day — last 14 days">
        {ops.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">No business activity recorded yet.</div>
        ) : (
          <div className="flex items-end gap-1.5 pt-2" style={{ height: 140 }}>
            {trend.map((t) => (
              <div key={t.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${t.day}: ${t.count}`}>
                <div className="w-full rounded-t bg-primary/70" style={{ height: `${(t.count / maxDay) * 110}px` }} />
                <span className="text-[9px] text-muted-foreground">{t.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* Activity history — action breakdown */}
        <ChartCard title="Activity history" description="Which actions happen most in this product">
          {actions.length === 0 ? (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No actions yet.</div>
          ) : (
            <ul className="space-y-2.5 pt-1">
              {actions.slice(0, 10).map((a) => (
                <li key={a.label} className="text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{a.label}</span>
                    <span className="tabular-nums text-muted-foreground">{fmt.format(a.count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(a.count / maxAction) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        {/* User actions — top actors */}
        <ChartCard title="Who's doing the work" description="People performing the most business actions here">
          {users.length === 0 ? (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No actors yet.</div>
          ) : (
            <ul className="divide-y">
              {users.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2 text-xs">
                  {u.userId ? (
                    <Link href={`/dashboard/people/${u.userId}`} className="min-w-0 truncate font-medium hover:underline">{u.name}</Link>
                  ) : (
                    <span className="min-w-0 truncate font-medium text-muted-foreground">{u.name}</span>
                  )}
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmt.format(u.count)} actions</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </section>

      {/* Timeline */}
      <ChartCard title="Activity timeline" description="Most recent business actions — repeats grouped">
        <ActivityFeed items={timeline} empty="No recent business activity." />
      </ChartCard>
    </div>
  );
}
