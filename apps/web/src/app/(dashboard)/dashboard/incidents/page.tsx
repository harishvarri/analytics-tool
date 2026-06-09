import Link from 'next/link';
import { AlertOctagon, Bug, ShieldAlert, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fetchIncidents, fetchErrorIntelligence } from '@/lib/data/fetchers';
import { IncidentsView } from './IncidentsView';
import { ErrorsView } from './ErrorsView';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

type View = 'incidents' | 'errors';

const TABS: { key: View; label: string }[] = [
  { key: 'incidents', label: 'Incidents' },
  { key: 'errors', label: 'Error Intelligence' },
];

/**
 * Operations Center — unified reliability operations. Merges the former
 * Incident Management, Error Intelligence Center, and Risk & Anomaly pages into
 * one place: a shared impact KPI band, an actionable incident board, and the
 * error diagnostics that feed it. Tabs are URL-driven (?view=) so the page stays
 * server-rendered and refresh/bookmark friendly.
 */
export default async function OperationsCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view: View = rawView === 'errors' ? 'errors' : 'incidents';

  // Shared fetch for the impact band (both cached → no duplicate queries when
  // the child views read the same sources).
  const [board, intel] = await Promise.all([
    fetchIncidents(),
    fetchErrorIntelligence(7),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Center"
        description="Reliability operations in one place — what's failing, the incidents it opened, and their impact."
        actions={<Badge variant="outline">{fmt.format(board.open)} open</Badge>}
      />

      {/* Unified impact band */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open incidents" value={fmt.format(board.open)} icon={AlertOctagon}
          trend={{ direction: board.open > 0 ? 'up' : 'flat', label: 'auto-detected' }} invertTrend />
        <KpiCard label="Critical errors" value={fmt.format(intel.criticalErrors)} icon={Bug}
          trend={{ direction: intel.criticalErrors > 0 ? 'up' : 'flat', label: 'API / DB / auth (7d)' }} invertTrend />
        <KpiCard label="Users impacted" value={fmt.format(intel.usersImpacted)} icon={Users}
          trend={{ direction: 'flat', label: 'distinct people hitting errors' }} invertTrend />
        <KpiCard label="Products at risk" value={fmt.format(board.projectsAtRisk)} icon={ShieldAlert}
          trend={{ direction: 'flat', label: 'with active incidents' }} href="/dashboard/health" />
      </section>

      {/* URL-driven tabs */}
      <div className="border-b">
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const active = t.key === view;
            const count = t.key === 'incidents' ? board.open : intel.criticalErrors;
            return (
              <Link
                key={t.key}
                href={t.key === 'incidents' ? '/dashboard/incidents' : '/dashboard/incidents?view=errors'}
                scroll={false}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {count > 0 && (
                  <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                    active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {fmt.format(count)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Selected view */}
      {view === 'errors' ? <ErrorsView /> : <IncidentsView board={board} />}
    </div>
  );
}
