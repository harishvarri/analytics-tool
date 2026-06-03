import Link from 'next/link';
import { AlertOctagon, Clock, ShieldAlert, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { Badge } from '@/components/ui/badge';
import { fetchIncidents } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';
import type { IncidentSeverity } from '@/lib/repositories/incidents';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const SEV: Record<IncidentSeverity, { label: string; tone: string; dot: string }> = {
  critical: { label: 'Critical', tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  high:     { label: 'High',     tone: 'border-orange-500/40 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   tone: 'border-amber-500/40 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
};

export default async function IncidentManagementPage() {
  const board = await fetchIncidents();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Management"
        description="Auto-detected operational incidents from errors and product health — most severe first."
        actions={<Badge variant="outline">{fmt.format(board.open)} open</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open incidents" value={fmt.format(board.open)} icon={AlertOctagon}
          trend={{ direction: board.open > 0 ? 'up' : 'flat', label: 'auto-detected' }} invertTrend />
        <KpiCard label="Critical incidents" value={fmt.format(board.critical)} icon={ShieldAlert}
          trend={{ direction: board.critical > 0 ? 'up' : 'flat', label: 'need immediate action' }} invertTrend />
        <KpiCard label="Products at risk" value={fmt.format(board.projectsAtRisk)} icon={ShieldAlert}
          trend={{ direction: 'flat', label: 'with active incidents' }} href="/dashboard/health" />
        <KpiCard label="Users affected" value={fmt.format(board.usersAffected)} icon={Users}
          trend={{ direction: 'flat', label: 'across open incidents' }} />
      </section>

      {board.incidents.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <ShieldAlert className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-sm font-medium">No active incidents</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Incidents are auto-opened from critical errors (database, auth, API) and product outages. When something
            breaks, it appears here with its impact and a recommended action.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {board.incidents.map((inc) => {
            const sev = SEV[inc.severity];
            return (
              <div key={inc.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-[10px] text-muted-foreground">{inc.id}</code>
                        <span className="text-sm font-semibold">{inc.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${sev.tone}`}>{sev.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">Open</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{inc.rootCause}</div>
                      <div className="mt-1.5 text-xs">
                        <span className="font-medium text-amber-600 dark:text-amber-400">Recommended: </span>
                        {inc.recommendedAction}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <Link href={`/dashboard/projects/${inc.projectSlug}`} className="font-medium text-foreground hover:underline">{inc.projectName}</Link>
                    <div className="mt-0.5 flex items-center justify-end gap-1"><Users className="h-3 w-3" /> {fmt.format(inc.usersAffected)} affected</div>
                    <div className="mt-0.5 flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> {formatRelativeTime(inc.detectedAt)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground">
        Incidents are auto-detected (read-only) from current signals. Assigning owners, acknowledging, and resolving
        with MTTR tracking requires a persisted incident log — the planned next step.
      </div>
    </div>
  );
}
