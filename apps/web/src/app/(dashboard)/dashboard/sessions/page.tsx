import { Clock, Timer, Users, Zap } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import { fetchSessionList } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { formatRelativeTime } from '@/lib/utils';
import { rangeToDays, rangeLabel } from '@/lib/range';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

interface PageProps {
  searchParams: Promise<{ app?: string; range?: string }>;
}

function fmtDuration(min: number): string {
  if (min < 1) return '<1m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default async function SessionsPage({ searchParams }: PageProps) {
  const { app, range } = await searchParams;
  const days = rangeToDays(range);
  const rows = await fetchSessionList({ ...(app ? { appId: app } : {}), days, limit: 200 });

  const totalMin = rows.reduce((s, r) => s + r.durationMin, 0);
  const avgMin = rows.length ? Math.round(totalMin / rows.length) : 0;
  const distinctUsers = new Set(rows.map((r) => r.userId).filter(Boolean)).size;
  const totalActions = rows.reduce((s, r) => s + r.eventCount, 0);

  // Most active users by session count (within window).
  const byUser = new Map<string, { name: string; sessions: number; minutes: number }>();
  for (const r of rows) {
    const key = r.userId ?? 'anon';
    const name = r.displayName ?? r.email ?? (r.userId ? r.userId.slice(0, 8) : 'Anonymous');
    const cur = byUser.get(key) ?? { name, sessions: 0, minutes: 0 };
    cur.sessions += 1; cur.minutes += r.durationMin;
    byUser.set(key, cur);
  }
  const topUsers = Array.from(byUser.values()).sort((a, b) => b.sessions - a.sessions).slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Sessions"
        description={`How long people worked and how active each session was, ${rangeLabel(range).toLowerCase()}${app ? ` · ${portalName(app)}` : ''}.`}
        actions={<Badge variant="outline">{fmt.format(rows.length)} sessions</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sessions" value={fmt.format(rows.length)} icon={Zap} trend={{ direction: 'flat', label: rangeLabel(range).toLowerCase() }} />
        <KpiCard label="Distinct people" value={fmt.format(distinctUsers)} icon={Users} trend={{ direction: 'flat', label: 'active in window' }} />
        <KpiCard label="Avg session" value={fmtDuration(avgMin)} icon={Timer} trend={{ direction: 'flat', label: 'time per session' }} />
        <KpiCard label="Total actions" value={fmt.format(totalActions)} icon={Clock} trend={{ direction: 'flat', label: 'across all sessions' }} />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No work sessions in this window.
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-3">
          <ChartCard title="Recent sessions" description="Newest first — person, product, duration, activity" className="xl:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Person</th>
                    <th className="px-2 py-2 text-left font-medium">Product</th>
                    <th className="px-2 py-2 text-right font-medium">Duration</th>
                    <th className="px-2 py-2 text-right font-medium">Actions</th>
                    <th className="px-2 py-2 text-right font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.sessionId} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2 font-medium">{r.displayName ?? r.email ?? (r.userId ? r.userId.slice(0, 8) : 'Anonymous')}</td>
                      <td className="px-2 py-2">{portalName(r.portalId)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtDuration(r.durationMin)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(r.eventCount)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{formatRelativeTime(r.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          <ChartCard title="Most active people" description="By session count in this window">
            <ul className="divide-y">
              {topUsers.map((u, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-xs">
                  <span className="truncate font-medium">{u.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{u.sessions} sessions · {fmtDuration(u.minutes)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        </section>
      )}
    </div>
  );
}

function portalName(slug: string): string {
  try { return getPortalConfig(slug).name; } catch { return slug; }
}
