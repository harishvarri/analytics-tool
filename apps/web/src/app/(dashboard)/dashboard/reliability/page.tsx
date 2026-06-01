import { Activity, AlertOctagon, Bug, Gauge, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ErrorRateChart } from '@/components/charts/ErrorRateChart';
import { ExportButton } from '@/components/shared/ExportButton';
import {
  fetchErrorGroups,
  fetchErrorRateTrend,
  fetchReliabilityKpis,
} from '@/lib/data/fetchers';
import type { ErrorGroup } from '@/lib/repositories/reliability';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function sloTone(errorFreePct: number, target: number): string {
  if (errorFreePct >= target) return 'text-emerald-600 dark:text-emerald-400';
  if (errorFreePct >= target - 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function burnTone(burnPct: number): string {
  if (burnPct < 50) return 'text-emerald-600 dark:text-emerald-400';
  if (burnPct < 100) return 'text-amber-600  dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps { searchParams: Promise<{ app?: string }> }

export default async function ReliabilityPage({ searchParams }: PageProps) {
  const { app: appId } = await searchParams;
  const [kpis, trend, groups] = await Promise.all([
    fetchReliabilityKpis(appId),
    fetchErrorRateTrend(appId),
    fetchErrorGroups(40, appId),
  ]);

  const chartData = trend.map((p) => ({ bucket: p.bucket, rate: p.errorRatePct }));
  const peakRate = trend.reduce((max, p) => Math.max(max, p.errorRatePct), 0);
  const hasData = kpis.totalErrors24h > 0 || groups.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Errors"
        description="How many errors are our products throwing, what are they, and are we within acceptable limits?"
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● Quality target {kpis.sloTargetPct}%
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Problem-free sessions"
          value={`${kpis.errorFreePct}%`}
          icon={ShieldCheck}
          trend={{
            direction: kpis.errorFreePct >= kpis.sloTargetPct ? 'flat' : 'down',
            label:
              kpis.errorFreePct >= kpis.sloTargetPct
                ? `Within quality target`
                : `Below quality target`,
          }}
        />
        <KpiCard
          label="Error headroom used"
          value={`${kpis.budgetBurnPct}%`}
          icon={Gauge}
          trend={{
            direction: kpis.budgetBurnPct >= 100 ? 'up' : 'flat',
            label: kpis.budgetBurnPct >= 100 ? 'Error allowance exhausted' : 'Within error allowance',
          }}
          invertTrend
        />
        <KpiCard
          label="Problems today"
          value={kpis.totalErrors24h.toLocaleString()}
          icon={Bug}
          trend={{
            direction: kpis.totalErrors24h > 0 ? 'up' : 'flat',
            label: `${kpis.errorGroups24h} distinct groups`,
          }}
          invertTrend
        />
        <KpiCard
          label="Staff affected today"
          value={kpis.affectedUsers24h.toLocaleString()}
          icon={Users}
          trend={{
            direction: kpis.affectedUsers24h > 0 ? 'up' : 'flat',
            label: `${kpis.newErrorGroups24h} new error groups`,
          }}
          invertTrend
        />
      </section>

      {/* SLO summary banner */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                kpis.errorFreePct >= kpis.sloTargetPct ? 'bg-emerald-500/15' : 'bg-rose-500/15'
              }`}
            >
              <Gauge className={`h-6 w-6 ${sloTone(kpis.errorFreePct, kpis.sloTargetPct)}`} />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {kpis.errorFreePct >= kpis.sloTargetPct
                  ? 'All products within quality target'
                  : 'Quality target breached — action needed'}
              </div>
              <div className="text-xs text-muted-foreground">
                {kpis.erroredSessions} of {kpis.totalSessions} sessions hit an error in the last 24h.
                {' '}Target: {kpis.sloTargetPct}% error-free.
              </div>
            </div>
          </div>
          {/* Budget burn bar */}
          <div className="w-full max-w-xs">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Error allowance used</span>
              <span className={`font-semibold tabular-nums ${burnTone(kpis.budgetBurnPct)}`}>
                {kpis.budgetBurnPct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  kpis.budgetBurnPct < 50
                    ? 'bg-emerald-500'
                    : kpis.budgetBurnPct < 100
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(kpis.budgetBurnPct, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-sm font-medium">No errors captured</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Error events arrive via <code className="rounded bg-muted px-1 text-[10px]">analyticsError()</code>{' '}
            and uncaught error boundaries from connected portals. When errors occur they are
            grouped by fingerprint and shown here with affected-user counts.
          </p>
        </div>
      )}

      {/* Error rate trend */}
      {chartData.length > 0 && (
        <ChartCard
          title="Problem rate — last 24 hours"
          description={`Hourly error events as a % of all events. Peak: ${peakRate}%.`}
        >
          <ErrorRateChart
            data={chartData}
            xKey="bucket"
            series={[{ dataKey: 'rate', label: 'Error rate', color: '#f43f5e' }]}
            height={240}
          />
        </ChartCard>
      )}

      {/* Top error groups */}
      {groups.length > 0 && (
        <ChartCard
          title="Recurring problems"
          description="Similar problems grouped together, most frequent first (last 24 hours)"
          actions={
            <ExportButton
              filename="error-groups"
              headers={[
                'Sample message', 'Error name', 'Types', 'Occurrences 24h', 'Occurrences total',
                'Affected users', 'Affected sessions', 'First seen', 'Last seen',
              ]}
              rows={groups.map((g) => [
                g.sampleMessage, g.errorName, g.errorTypes.join('|'), g.occurrences24h,
                g.totalOccurrences, g.affectedUsers, g.affectedSessions, g.firstSeen, g.lastSeen,
              ])}
            />
          }
        >
          <div className="space-y-2">
            {groups.map((g) => (
              <ErrorGroupRow key={g.fingerprint} group={g} />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Methodology footer */}
      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">How quality is measured</div>
        <ol className="ml-4 list-decimal space-y-1">
          <li>
            Problems are counted whenever a connected product reports an issue to the platform.
            Similar problems are grouped together so you can see patterns at a glance.
          </li>
          <li>
            <strong>Problem rate</strong> = problem events ÷ all events, bucketed hourly over the last 24h.
          </li>
          <li>
            <strong>Quality target</strong>: {kpis.sloTargetPct}% of sessions should be problem-free over 24h. The{' '}
            <strong>error allowance</strong> is the remaining {(100 - kpis.sloTargetPct).toFixed(1)}%.
          </li>
          <li>
            <strong>Error headroom used</strong> = how much of that allowance the current problem-session rate has
            consumed. Over 100% means the quality target is breached for the window.
          </li>
        </ol>
      </section>
    </div>
  );
}

// ── ErrorGroupRow ──────────────────────────────────────────────────────────────

function ErrorGroupRow({ group: g }: { group: ErrorGroup }) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card px-3 py-3 hover:bg-muted/30">
      <div className="mt-0.5 shrink-0">
        <AlertOctagon className="h-4 w-4 text-rose-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium" title={g.sampleMessage}>
            {g.sampleMessage}
          </span>
          {g.isNew && (
            <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-600 dark:text-amber-400">
              first seen today
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {g.errorName && <code className="rounded bg-muted px-1 py-0.5">{g.errorName}</code>}
          {g.errorTypes.map((t) => (
            <code key={t} className="rounded bg-muted px-1 py-0.5">{t}</code>
          ))}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {g.affectedUsers} {g.affectedUsers === 1 ? 'user' : 'users'}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {g.affectedSessions} {g.affectedSessions === 1 ? 'session' : 'sessions'}
          </span>
          <span>last {relTime(g.lastSeen)}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
          {g.occurrences24h.toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">24h</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
          {g.totalOccurrences.toLocaleString()} total
        </div>
      </div>
    </div>
  );
}
