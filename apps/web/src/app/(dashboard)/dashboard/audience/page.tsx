import { Globe, Languages, Monitor, MonitorSmartphone, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart, type DonutSlice } from '@/components/charts/DonutChart';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchAudienceBreakdown } from '@/lib/data/fetchers';
import { rangeToDays, rangeLabel } from '@/lib/range';
import type { AudienceRow } from '@/lib/repositories/audience';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

const DONUT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#64748b'];

function titleize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AudiencePage({ searchParams }: PageProps) {
  const { range } = await searchParams;
  const days = rangeToDays(range);
  const { byDimension, totalUsers } = await fetchAudienceBreakdown(days);

  const topBrowser = byDimension.browser[0];
  const topOs = byDimension.os[0];
  const deviceRows = byDimension.device_type;
  const mobileRow = deviceRows.find((r) => r.value === 'mobile');
  const mobilePct =
    totalUsers > 0 && mobileRow ? Math.round((mobileRow.users / totalUsers) * 100) : 0;

  const hasData = totalUsers > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audience & Technology"
        description="Device, browser, OS, language, and region breakdowns from session context."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● {rangeLabel(range)}
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Users with context"
          value={totalUsers.toLocaleString()}
          icon={MonitorSmartphone}
          trend={{ direction: 'flat', label: 'Carried device metadata' }}
        />
        <KpiCard
          label="Top browser"
          value={topBrowser ? titleize(topBrowser.value) : '—'}
          icon={Monitor}
          trend={{ direction: 'flat', label: topBrowser ? `${topBrowser.users} users` : 'No data' }}
        />
        <KpiCard
          label="Top OS"
          value={topOs ? titleize(topOs.value) : '—'}
          icon={Monitor}
          trend={{ direction: 'flat', label: topOs ? `${topOs.users} users` : 'No data' }}
        />
        <KpiCard
          label="Mobile share"
          value={`${mobilePct}%`}
          icon={Smartphone}
          trend={{ direction: 'flat', label: 'Of users with context' }}
        />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No audience data in this range</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Device, browser, and OS context is attached to login and session-start events.
            As users sign in, this page fills with technology and region breakdowns.
            Try widening the date range.
          </p>
        </div>
      )}

      {/* Donuts: device type, browser, OS */}
      {hasData && (
        <section className="grid gap-4 lg:grid-cols-3">
          <DonutCard title="Device type" rows={deviceRows} />
          <DonutCard title="Browser" rows={byDimension.browser} />
          <DonutCard title="Operating system" rows={byDimension.os} />
        </section>
      )}

      {/* Tables: region, language, screen */}
      {hasData && (
        <section className="grid gap-4 lg:grid-cols-3">
          <BreakdownTable title="Region" icon={<Globe className="h-4 w-4" />} rows={byDimension.region} unit="users" />
          <BreakdownTable title="Language" icon={<Languages className="h-4 w-4" />} rows={byDimension.language} unit="users" />
          <BreakdownTable title="Screen resolution" icon={<Monitor className="h-4 w-4" />} rows={byDimension.screen} unit="sessions" />
        </section>
      )}

      {/* Detailed timezone table with export */}
      {hasData && byDimension.timezone.length > 0 && (
        <ChartCard
          title="Timezone distribution"
          description="IANA timezones reported by clients — a privacy-safe geo signal (no IP geolocation)."
          actions={
            <ExportButton
              filename="audience-timezones"
              headers={['Timezone', 'Users', 'Sessions', 'Events']}
              rows={byDimension.timezone.map((r) => [r.value, r.users, r.sessions, r.events])}
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Timezone</th>
                  <th className="px-2 py-2 text-right font-medium">Users</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {byDimension.timezone.map((r) => (
                  <tr key={r.value} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2 font-mono text-[11px]">{r.value}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{r.users}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.sessions}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.events}</td>
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

// ── DonutCard ───────────────────────────────────────────────────────────────

function DonutCard({ title, rows }: { title: string; rows: AudienceRow[] }) {
  const slices: DonutSlice[] = rows.slice(0, 7).map((r, i) => ({
    name: titleize(r.value),
    value: r.users || r.sessions || r.events,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));
  const total = slices.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title={title} description={`${rows.length} distinct`}>
      {slices.length > 0 ? (
        <>
          <DonutChart data={slices} height={200} centerValue={String(total)} centerLabel="users" />
          <div className="mt-3 space-y-1">
            {slices.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular-nums text-muted-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
          No data
        </div>
      )}
    </ChartCard>
  );
}

// ── BreakdownTable ──────────────────────────────────────────────────────────

function BreakdownTable({
  title,
  icon,
  rows,
  unit,
}: {
  title: string;
  icon: React.ReactNode;
  rows: AudienceRow[];
  unit: 'users' | 'sessions';
}) {
  const top = rows.slice(0, 8);
  const max = top.reduce((m, r) => Math.max(m, unit === 'users' ? r.users : r.sessions), 0) || 1;

  return (
    <ChartCard title={title}>
      {top.length > 0 ? (
        <div className="space-y-2">
          {top.map((r) => {
            const val = unit === 'users' ? r.users : r.sessions;
            const pct = Math.round((val / max) * 100);
            return (
              <div key={r.value} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-muted-foreground">{icon}</span>
                    <span className="truncate font-medium">{titleize(r.value)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{val}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
          No data
        </div>
      )}
    </ChartCard>
  );
}
