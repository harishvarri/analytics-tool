import Link from 'next/link';
import { AlertOctagon, Bug, Boxes, ChevronDown, Clock3, Code2, Database, Users } from 'lucide-react';
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

function dateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
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
          <div className="space-y-2">
            {groups.map((g) => {
              const metadataEntries = Object.entries(g.sampleMetadata ?? {});
              return (
                <details key={g.fingerprint} className="group rounded-md border bg-background">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-3 text-xs hover:bg-muted/40">
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium" title={g.sampleMessage}>
                          {g.sampleMessage || g.errorName || 'Unknown error'}
                        </span>
                        {g.errorName && <Badge variant="secondary" className="text-[10px]">{g.errorName}</Badge>}
                        {g.isNew && <Badge variant="outline" className="border-rose-500/40 text-[9px] text-rose-600 dark:text-rose-400">NEW</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        <span>{fmt.format(g.totalOccurrences)} occurrences</span>
                        <span>{fmt.format(g.affectedUsers)} users</span>
                        <span>{fmt.format(g.affectedSessions)} sessions</span>
                        <span>Last seen {relTime(g.lastSeen)}</span>
                      </div>
                    </div>
                    <div className="hidden text-right tabular-nums text-muted-foreground sm:block">
                      <div>{fmt.format(g.occurrences24h)} / 24h</div>
                      <div>{fmt.format(g.occurrences7d)} / 7d</div>
                    </div>
                  </summary>

                  <div className="border-t px-3 py-4 text-xs">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                      <div className="space-y-4">
                        <section>
                          <div className="mb-2 flex items-center gap-2 font-medium">
                            <Bug className="h-3.5 w-3.5 text-rose-500" />
                            Sample message
                          </div>
                          <div className="rounded-md bg-muted/50 p-3 text-muted-foreground">
                            {g.sampleMessage || 'No sample message recorded.'}
                          </div>
                        </section>

                        <section>
                          <div className="mb-2 flex items-center gap-2 font-medium">
                            <Code2 className="h-3.5 w-3.5 text-sky-500" />
                            Stack trace
                          </div>
                          {g.sampleStack ? (
                            <pre className="max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
                              <code>{g.sampleStack}</code>
                            </pre>
                          ) : (
                            <div className="rounded-md border border-dashed p-3 text-muted-foreground">
                              No stack trace was captured for this sample.
                            </div>
                          )}
                        </section>
                      </div>

                      <div className="space-y-4">
                        <section>
                          <div className="mb-2 flex items-center gap-2 font-medium">
                            <Clock3 className="h-3.5 w-3.5 text-amber-500" />
                            Timing and impact
                          </div>
                          <dl className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3">
                            <dt className="text-muted-foreground">First seen</dt>
                            <dd className="text-right">{dateTime(g.firstSeen)}</dd>
                            <dt className="text-muted-foreground">Last seen</dt>
                            <dd className="text-right">{dateTime(g.lastSeen)}</dd>
                            <dt className="text-muted-foreground">Occurrences</dt>
                            <dd className="text-right tabular-nums">{fmt.format(g.totalOccurrences)}</dd>
                            <dt className="text-muted-foreground">Products</dt>
                            <dd className="text-right tabular-nums">{fmt.format(g.appCount)}</dd>
                          </dl>
                        </section>

                        <section>
                          <div className="mb-2 flex items-center gap-2 font-medium">
                            <Database className="h-3.5 w-3.5 text-emerald-500" />
                            Metadata
                          </div>
                          {metadataEntries.length > 0 ? (
                            <dl className="max-h-72 overflow-auto rounded-md border">
                              {metadataEntries.map(([key, value]) => (
                                <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 border-b px-3 py-2 last:border-b-0">
                                  <dt className="truncate font-mono text-[11px] text-muted-foreground" title={key}>{key}</dt>
                                  <dd className="break-words font-mono text-[11px]">{formatMetadataValue(value)}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <div className="rounded-md border border-dashed p-3 text-muted-foreground">
                              No metadata was captured for this sample.
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
