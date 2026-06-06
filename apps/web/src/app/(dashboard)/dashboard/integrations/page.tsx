import Link from 'next/link';
import { Check, X, Plug, UserX, Database, Activity } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { fetchIntegrationHealth } from '@/lib/data/fetchers';
import type { IntegrationChecks } from '@/lib/repositories/integrationHealth';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

function scoreTone(s: number): string {
  if (s >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

const CHECK_LABELS: { key: keyof IntegrationChecks; label: string }[] = [
  { key: 'scriptInstalled', label: 'Script' },
  { key: 'eventsFlowing', label: 'Events' },
  { key: 'usersIdentified', label: 'Users' },
  { key: 'errorsCaptured', label: 'Errors' },
  { key: 'businessEvents', label: 'Business' },
];

export default async function IntegrationHealthPage() {
  const data = await fetchIntegrationHealth();
  const dq = data.dataQuality;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Health & Data Quality"
        description="Is each product actually wired up — script, events, identified users, errors, and business events?"
      />

      {/* Org-level data quality */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg integration score" value={String(data.avgScore)} icon={Plug}
          trend={{ direction: data.avgScore >= 80 ? 'flat' : 'down', label: `${dq.productsTotal} products` }} />
        <KpiCard label="Anonymous users" value={`${dq.anonymousPct}%`} icon={UserX}
          trend={{ direction: dq.anonymousPct > 50 ? 'up' : 'flat', label: `${fmt.format(dq.anonymousUsers)} of ${fmt.format(dq.totalUsers)} unnamed` }} invertTrend />
        <KpiCard label="Missing business events" value={String(dq.productsMissingBusinessEvents)} icon={Activity}
          trend={{ direction: dq.productsMissingBusinessEvents > 0 ? 'up' : 'flat', label: 'products not tracking actions' }} invertTrend />
        <KpiCard label="No identified users" value={String(dq.productsWithoutIdentifiedUsers)} icon={Database}
          trend={{ direction: dq.productsWithoutIdentifiedUsers > 0 ? 'up' : 'flat', label: 'products missing identify()' }} invertTrend />
      </section>

      {data.projects.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No products connected yet. Add one from Admin → Connected Products.
        </div>
      ) : (
        <section className="space-y-4">
          {data.projects.map((p) => (
            <div key={p.slug} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/projects/${p.slug}`} className="text-sm font-semibold hover:underline">{p.name}</Link>
                    <span className={`text-lg font-bold tabular-nums ${scoreTone(p.score)}`}>{p.score}%</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.lastActivityAt ? `Last activity ${formatRelativeTime(p.lastActivityAt)}` : 'No activity yet'} · {fmt.format(p.events7d)} events (7d) · {fmt.format(p.activeUsers7d)} active users
                  </div>
                </div>
                {/* Checklist */}
                <div className="flex flex-wrap gap-3">
                  {CHECK_LABELS.map(({ key, label }) => {
                    const ok = p.checks[key];
                    return (
                      <span key={key} className={`inline-flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-rose-500" />}{label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${p.score >= 80 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${p.score}%` }} />
              </div>

              {/* What's missing */}
              {p.missing.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {p.missing.map((m) => (
                    <li key={m} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span>{m}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="text-[11px] text-muted-foreground">
        Integration score = Script 30% + Events 25% + Identified users 25% + Business events 15% + Errors captured 5%.
        Open <Link href="/dashboard/admin/projects" className="text-primary hover:underline">Connected Products</Link> for each product&apos;s integration kit.
      </div>
    </div>
  );
}
