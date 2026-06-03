import Link from 'next/link';
import { AlertOctagon, Bug, Boxes, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchErrorIntelligence, fetchErrorGroups } from '@/lib/data/fetchers';
import { getPortalConfig } from '@/config/portals';
import { friendlyEventName } from '@/lib/event-labels';
import { formatRelativeTime } from '@/lib/utils';
import type { ErrorCategory } from '@/lib/repositories/errorIntelligence';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const CAT_TONE: Record<ErrorCategory, string> = {
  api: 'bg-rose-500', database: 'bg-orange-500', authentication: 'bg-amber-500',
  authorization: 'bg-yellow-500', network: 'bg-sky-500', frontend: 'bg-violet-500',
};

function relTime(iso: string): string {
  return formatRelativeTime(iso);
}

export default async function ErrorIntelligencePage() {
  const [intel, groups] = await Promise.all([
    fetchErrorIntelligence(7),
    fetchErrorGroups(30),
  ]);

  const maxCat = Math.max(1, ...intel.categories.map((c) => c.count));
  const hasErrors = intel.totalErrors > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Error Intelligence Center"
        description="What's failing, where, and who it impacts — categorized errors across every product (last 7 days)."
        actions={
          <ExportButton
            filename="error-intelligence"
            headers={['Category', 'Errors', 'Users impacted']}
            rows={intel.categories.map((c) => [c.label, c.count, c.users])}
          />
        }
      />

      {/* Top cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Critical errors" value={fmt.format(intel.criticalErrors)} icon={AlertOctagon}
          trend={{ direction: intel.criticalErrors > 0 ? 'up' : 'flat', label: 'API / DB / auth' }} invertTrend />
        <KpiCard label="Active incidents" value={fmt.format(intel.activeIncidents)} icon={Bug}
          trend={{ direction: intel.activeIncidents > 0 ? 'up' : 'flat', label: 'critical, last 24h' }} invertTrend />
        <KpiCard label="Users impacted" value={fmt.format(intel.usersImpacted)} icon={Users}
          trend={{ direction: 'flat', label: 'distinct people hitting errors' }} invertTrend />
        <KpiCard label="Products impacted" value={fmt.format(intel.projectsImpacted)} icon={Boxes}
          trend={{ direction: 'flat', label: 'with errors this week' }} invertTrend />
      </section>

      {!hasErrors ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Bug className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-sm font-medium">No errors in the last 7 days</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            When products report errors (or auth failures), this center categorizes them by type, shows who&apos;s
            affected, and pinpoints the worst-hit products. Tag errors with <code>errorType</code> in event metadata
            for sharper categorization.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {/* Category breakdown */}
          <ChartCard title="Error categories" description="Where the failures are concentrated">
            <ul className="space-y-3 pt-1">
              {intel.categories.map((c) => (
                <li key={c.category} className="text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">
                      {c.label}{c.critical && <span className="ml-1 text-[10px] uppercase text-rose-500">critical</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{fmt.format(c.count)} · {fmt.format(c.users)} users</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${CAT_TONE[c.category]}`} style={{ width: `${(c.count / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </ChartCard>

          {/* Most affected projects */}
          <ChartCard title="Most affected products" description="Where to look first — click to open the product">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Product</th>
                    <th className="px-2 py-2 text-left font-medium">Top issue</th>
                    <th className="px-2 py-2 text-right font-medium">Errors</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.byProject.map((p) => (
                    <tr key={p.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/projects/${p.slug}`} className="font-medium hover:underline">{getPortalConfig(p.slug).name}</Link>
                      </td>
                      <td className="px-2 py-2 capitalize text-muted-foreground">{p.topCategory ?? '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmt.format(p.errors)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(p.users)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </section>
      )}

      {/* Error timeline */}
      {hasErrors && (
        <ChartCard title="Error timeline" description="Most recent failures — type, product, person, and when">
          <ul className="divide-y">
            {intel.timeline.slice(0, 25).map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-2 text-xs">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CAT_TONE[e.errorCategory]}`} title={e.errorCategory} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{e.errorCategory}</span>
                    <span className="text-muted-foreground">· {getPortalConfig(e.portalId).name}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground">{relTime(e.occurredAt)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-muted-foreground" title={String(e.metadata?.['message'] ?? e.eventName)}>
                    {String(e.metadata?.['message'] ?? friendlyEventName(e.eventName))}
                    {(e.userDisplayName || e.userEmail) && <span className="text-foreground/70"> · {e.userDisplayName ?? e.userEmail}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {/* Error groups (deduped by fingerprint) */}
      {groups.length > 0 && (
        <ChartCard title="Grouped errors" description="Distinct error signatures, ranked by impact (last 30 days)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Error</th>
                  <th className="px-2 py-2 text-right font-medium">Occurrences</th>
                  <th className="px-2 py-2 text-right font-medium">Users</th>
                  <th className="px-2 py-2 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.fingerprint} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <div className="max-w-[420px] truncate font-medium" title={g.sampleMessage}>{g.sampleMessage || g.errorName || 'Unknown error'}</div>
                      {g.isNew && <Badge variant="outline" className="mt-0.5 border-rose-500/40 text-[9px] text-rose-600 dark:text-rose-400">NEW</Badge>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt.format(g.totalOccurrences)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt.format(g.affectedUsers)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{relTime(g.lastSeen)}</td>
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
