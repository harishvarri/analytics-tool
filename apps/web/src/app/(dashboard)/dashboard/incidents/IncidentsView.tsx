import Link from 'next/link';
import { Clock, ShieldAlert, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';
import type { IncidentBoard, IncidentSeverity } from '@/lib/repositories/incidents';
import { IncidentStatusControl } from './IncidentStatusControl';

const fmt = new Intl.NumberFormat('en-US');

const SEV: Record<IncidentSeverity, { label: string; tone: string; dot: string }> = {
  critical: { label: 'Critical', tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  high:     { label: 'High',     tone: 'border-orange-500/40 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   tone: 'border-amber-500/40 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
};

/** Actionable incident board — set lifecycle status; resolved/closed stop reducing health. */
export function IncidentsView({ board }: { board: IncidentBoard }) {
  return (
    <div className="space-y-4">
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
                    <div className="mt-2 flex justify-end"><IncidentStatusControl incidentKey={inc.id} current={inc.status} /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved / closed — kept for the record, not shown as active problems */}
      {board.resolved.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Resolved &amp; closed <span className="text-muted-foreground">({board.resolved.length})</span>
          </summary>
          <div className="space-y-2 border-t px-4 py-3">
            {board.resolved.map((inc) => (
              <div key={inc.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <code className="text-[10px] text-muted-foreground">{inc.id}</code>
                  <span className="truncate font-medium text-muted-foreground line-through">{inc.title}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{inc.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {inc.statusUpdatedAt && <span className="text-muted-foreground">{formatRelativeTime(inc.statusUpdatedAt)}</span>}
                  <IncidentStatusControl incidentKey={inc.id} current={inc.status} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="text-[11px] text-muted-foreground">
        Incidents are auto-detected from current signals. Set each one&apos;s status (Open → Investigating → Resolved →
        Closed). Resolving or closing an incident immediately stops its errors reducing the product&apos;s health.
      </div>
    </div>
  );
}
