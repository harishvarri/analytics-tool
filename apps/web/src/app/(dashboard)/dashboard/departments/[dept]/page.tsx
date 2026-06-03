import Link from 'next/link';
import { ArrowLeft, Activity, Boxes, ShieldCheck, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { fetchDepartmentDetail } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { friendlyEventName } from '@/lib/event-labels';
import { aggregateActivity } from '@/features/realtime-feed/aggregate';
import { riskFromLastActive } from '@/lib/user-risk';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

interface PageProps {
  params: Promise<{ dept: string }>;
}

function scoreTone(s: number, invert = false): string {
  const v = invert ? 100 - s : s;
  if (v >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (v >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function DepartmentDetailPage({ params }: PageProps) {
  const { dept } = await params;
  const decoded = decodeURIComponent(dept);
  const d = await fetchDepartmentDetail(decoded, 30);

  if (!d || d.staffCount === 0) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/departments" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Department Analytics
        </Link>
        <PageHeader title={decoded} description="No staff are assigned to this department yet." />
      </div>
    );
  }

  const timeline = aggregateActivity(d.timeline).slice(0, 15);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/departments" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Department Analytics
      </Link>

      <PageHeader
        title={`${decoded} Department`}
        description="Who works here, what they use, and how the department is performing (last 30 days)."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Staff" value={fmt.format(d.staffCount)} icon={Users}
          trend={{ direction: 'flat', label: `${fmt.format(d.activeUsers7d)} active this week` }} />
        <KpiCard label="Business actions" value={fmt.format(d.activities.reduce((s, a) => s + a.count, 0))} icon={Activity}
          trend={{ direction: 'flat', label: 'operational, last 30d' }} />
        <KpiCard label="Work sessions" value={fmt.format(d.totalSessions)} icon={Boxes}
          trend={{ direction: 'flat', label: 'across products' }} />
        <KpiCard label="Adoption" value={`${d.health.adoptionScore}%`} icon={ShieldCheck}
          trend={{ direction: d.health.adoptionScore >= 50 ? 'flat' : 'down', label: 'active this week' }} />
      </section>

      {/* Department health scores */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Activity score', v: d.health.activityScore },
          { label: 'Adoption score', v: d.health.adoptionScore },
          { label: 'Engagement score', v: d.health.engagementScore },
          { label: 'Risk score', v: d.health.riskScore, invert: true },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${scoreTone(s.v, s.invert)}`}>{s.v}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${s.invert ? 'bg-rose-500/60' : 'bg-primary/70'}`} style={{ width: `${Math.min(100, s.v)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {/* Staff */}
        <ChartCard title="Staff" description="People in this department, most active first" className="xl:col-span-1">
          {d.staff.length === 0 ? <Empty /> : (
            <ul className="divide-y">
              {d.staff.slice(0, 15).map((s) => {
                const risk = riskFromLastActive(s.lastActiveAt);
                return (
                  <li key={s.userId} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <Link href={`/dashboard/people/${s.userId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${risk.dot}`} title={risk.label} />
                      <span className="truncate font-medium">{s.name}</span>
                    </Link>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmt.format(s.events)} actions · {s.lastActiveAt ? formatRelativeTime(s.lastActiveAt) : 'never'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        {/* Most used apps */}
        <ChartCard title="Most used products" description="Where this department spends its time" className="xl:col-span-1">
          {d.topApps.length === 0 ? <Empty /> : (
            <ul className="space-y-2 pt-1">
              {d.topApps.map((a) => (
                <li key={a.slug} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{getPortalConfig(a.slug).name}</span>
                  <span className="tabular-nums text-muted-foreground">{fmt.format(a.events)} actions · {a.users} staff</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        {/* Business activities */}
        <ChartCard title="Top activities" description="Business actions this department performs" className="xl:col-span-1">
          {d.activities.length === 0 ? <Empty /> : (
            <ul className="space-y-2 pt-1">
              {d.activities.map((a) => (
                <li key={a.name} className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium" title={a.name}>{friendlyEventName(a.name)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmt.format(a.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </section>

      {/* Department operational timeline */}
      <ChartCard title="Department activity timeline" description="Recent business actions across the team — page views & clicks hidden">
        <ActivityFeed items={timeline} empty="No recent business activity." />
      </ChartCard>
    </div>
  );
}

function Empty() {
  return <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">No data yet</div>;
}
