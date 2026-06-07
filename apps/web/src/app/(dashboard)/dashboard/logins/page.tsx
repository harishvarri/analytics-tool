import { LogIn, LogOut, ShieldX, UserPlus } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import { fetchLoginHistory } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { formatRelativeTime } from '@/lib/utils';
import { rangeToBounds, rangeLabel } from '@/lib/range';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

interface PageProps {
  searchParams: Promise<{ app?: string; range?: string; start?: string; end?: string }>;
}

const KIND_META = {
  login:  { label: 'Signed in',     tone: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  logout: { label: 'Signed out',    tone: 'border-slate-500/40 text-slate-600 dark:text-slate-400' },
  failed: { label: 'Failed sign-in', tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400' },
  signup: { label: 'Signed up',     tone: 'border-violet-500/40 text-violet-600 dark:text-violet-400' },
} as const;

export default async function LoginsPage({ searchParams }: PageProps) {
  const { app, range, start, end } = await searchParams;
  const { since, until } = rangeToBounds(range, start, end);
  const rows = await fetchLoginHistory({ ...(app ? { appId: app } : {}), since, ...(until ? { until } : {}), limit: 200 });

  const logins = rows.filter((r) => r.kind === 'login').length;
  const logouts = rows.filter((r) => r.kind === 'logout').length;
  const failures = rows.filter((r) => r.kind === 'failed').length;
  const signups = rows.filter((r) => r.kind === 'signup').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sign-in History"
        description={`Who signed in and out, from which device, ${rangeLabel(range).toLowerCase()}${app ? ` · ${portalName(app)}` : ''}.`}
        actions={<Badge variant="outline">{fmt.format(rows.length)} events</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sign-ins" value={fmt.format(logins)} icon={LogIn} trend={{ direction: 'flat', label: rangeLabel(range).toLowerCase() }} />
        <KpiCard label="Sign-outs" value={fmt.format(logouts)} icon={LogOut} trend={{ direction: 'flat', label: 'sessions ended' }} />
        <KpiCard label="Failed sign-ins" value={fmt.format(failures)} icon={ShieldX} trend={{ direction: failures > 0 ? 'up' : 'flat', label: 'authentication failures' }} invertTrend />
        <KpiCard label="New accounts" value={fmt.format(signups)} icon={UserPlus} trend={{ direction: 'flat', label: 'sign-ups' }} />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No sign-in activity in this window.
        </div>
      ) : (
        <ChartCard title="Recent sign-in activity" description="Newest first — person, product, device, and time">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Person</th>
                  <th className="px-2 py-2 text-left font-medium">Event</th>
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-left font-medium">Device</th>
                  <th className="px-2 py-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const meta = KIND_META[r.kind];
                  return (
                    <tr key={`${r.occurredAt}-${i}`} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <div className="font-medium">{r.displayName ?? r.email ?? (r.userId ? r.userId.slice(0, 8) : 'Anonymous')}</div>
                        {r.email && r.displayName ? <div className="text-muted-foreground">{r.email}</div> : null}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-2 py-2">{portalName(r.portalId)}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {[r.browser, r.os, r.deviceType].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{formatRelativeTime(r.occurredAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function portalName(slug: string): string {
  try { return getPortalConfig(slug).name; } catch { return slug; }
}
