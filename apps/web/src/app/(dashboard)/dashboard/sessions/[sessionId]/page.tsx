import Link from 'next/link';
import { ArrowLeft, LogIn, LogOut, Timer, FileText, Activity, ShieldCheck, Boxes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { UserTimeline } from '@/components/analytics/UserTimeline';
import { fetchSessionDetail } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { friendlyEventName } from '@/lib/event-labels';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

function fmtDuration(min: number): string {
  if (min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtClock(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function portalName(slug: string): string {
  try { return getPortalConfig(slug).name; } catch { return slug; }
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  const s = await fetchSessionDetail(sessionId);

  if (!s) {
    return (
      <div className="space-y-6">
        <PageHeader title="Session" description="This session was not found." />
        <Link href="/dashboard/sessions" className="text-sm text-primary hover:underline">← Back to Work Sessions</Link>
      </div>
    );
  }

  const person = s.displayName ?? s.email ?? (s.userId ? s.userId.slice(0, 8) : 'Guest');
  const product = portalName(s.portalId);
  const journey = s.events
    .filter((e) => friendlyEventName(e.name, e.metadata, e.url))
    .reduce<string[]>((acc, e) => {
      const label = friendlyEventName(e.name, e.metadata, e.url);
      if (acc[acc.length - 1] !== label) acc.push(label);
      return acc;
    }, [])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/sessions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Work Sessions
      </Link>

      <PageHeader
        title={`${person}'s session`}
        description={`${product} · ${fmtClock(s.startedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {s.userId && (
              <Link href={`/dashboard/people/${s.userId}`} className="text-xs text-primary hover:underline">View full profile →</Link>
            )}
            <Badge variant="outline">{fmtDuration(s.durationMin)}</Badge>
          </div>
        }
      />

      {/* Session facts */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Login time" value={fmtTime(s.startedAt)} icon={LogIn}
          trend={{ direction: 'flat', label: new Date(s.startedAt).toLocaleDateString() }} />
        <KpiCard label="Logout time" value={s.endedAt ? fmtTime(s.endedAt) : 'still active'} icon={LogOut}
          trend={{ direction: 'flat', label: s.endedAt ? 'ended' : 'open session' }} />
        <KpiCard label="Duration" value={fmtDuration(s.durationMin)} icon={Timer}
          trend={{ direction: 'flat', label: 'time in session' }} />
        <KpiCard label="Product" value={product} icon={Boxes}
          trend={{ direction: 'flat', label: 'where they worked' }} />

        <KpiCard label="Pages visited" value={fmt.format(s.pagesVisited)} icon={FileText}
          trend={{ direction: 'flat', label: 'distinct pages' }} />
        <KpiCard label="Actions performed" value={fmt.format(s.businessActions)} icon={Activity}
          trend={{ direction: 'flat', label: `${fmt.format(s.eventCount)} total events` }} />
        <KpiCard label="Errors" value={fmt.format(s.errors)} icon={ShieldCheck} invertTrend
          trend={{ direction: s.errors > 0 ? 'up' : 'flat', label: 'encountered' }} />
        <KpiCard label="Sign-ins" value={fmt.format(s.logins)} icon={LogIn}
          trend={{ direction: 'flat', label: 'in this session' }} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* User journey */}
        <ChartCard title="User journey" description="The path taken through the product this session">
          {journey.length > 0 ? (
            <ol className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              {journey.map((step, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="rounded bg-muted px-2 py-1 font-medium">{step}</span>
                  {i < journey.length - 1 && <span className="text-muted-foreground">→</span>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">No navigable steps captured.</div>
          )}
        </ChartCard>

        {/* Feature usage */}
        <ChartCard title="Feature usage" description="Most-used actions in this session">
          {s.topActions.length > 0 ? (
            <ul className="space-y-2 pt-1">
              {s.topActions.map((a) => (
                <li key={a.label} className="flex items-center justify-between gap-2 text-xs">
                  <span>{friendlyEventName(a.label, null, null)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">×{fmt.format(a.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">No operational actions in this session.</div>
          )}
        </ChartCard>
      </section>

      {/* Complete event timeline */}
      <ChartCard title="Complete event timeline" description="Every operational action in this session — in order">
        <UserTimeline events={s.events.filter((e) => friendlyEventName(e.name, e.metadata, e.url) && e.category !== 'navigation')} userName={person}
          empty="No operational events recorded in this session." />
      </ChartCard>
    </div>
  );
}
