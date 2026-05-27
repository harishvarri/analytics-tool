import Link from 'next/link';
import { Filter, TrendingDown, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { fetchFunnel } from '@/lib/data/fetchers';
import { FUNNELS, getFunnelById } from '@/config/funnels';
import { rangeToDays, rangeLabel } from '@/lib/range';
import { cn } from '@/lib/utils';
import type { FunnelStepResult } from '@/lib/repositories/funnels';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ funnel?: string; range?: string }>;
}

function buildHref(funnelId: string, range?: string): string {
  const params = new URLSearchParams();
  params.set('funnel', funnelId);
  if (range) params.set('range', range);
  return `/dashboard/funnels?${params.toString()}`;
}

export default async function FunnelsPage({ searchParams }: PageProps) {
  const { funnel: funnelId, range } = await searchParams;
  const def = getFunnelById(funnelId);
  const days = rangeToDays(range);
  const funnel = await fetchFunnel(def, days);

  const hasData = funnel.entered > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funnel Analytics"
        description="Ordered, first-touch conversion through a defined sequence of events."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● {rangeLabel(range)}
          </Badge>
        }
      />

      {/* Funnel selector */}
      <div className="flex flex-wrap gap-2">
        {FUNNELS.map((f) => (
          <Link
            key={f.id}
            href={buildHref(f.id, range)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              f.id === def.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'hover:bg-accent/40 text-muted-foreground',
            )}
          >
            {f.name}
          </Link>
        ))}
      </div>

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Entered funnel"
          value={funnel.entered.toLocaleString()}
          icon={Users}
          trend={{ direction: 'flat', label: `Reached "${def.steps[0]?.label}"` }}
        />
        <KpiCard
          label="Completed"
          value={funnel.completed.toLocaleString()}
          icon={Users}
          trend={{ direction: 'flat', label: `Reached "${def.steps[def.steps.length - 1]?.label}"` }}
        />
        <KpiCard
          label="Overall conversion"
          value={`${funnel.overallPct}%`}
          icon={TrendingDown}
          trend={{
            direction: funnel.overallPct >= 50 ? 'flat' : 'down',
            label: 'End-to-end completion',
          }}
        />
      </section>

      {!hasData && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Filter className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No users entered this funnel</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            The funnel starts at <code className="rounded bg-muted px-1 text-[10px]">{def.steps[0]?.event}</code>.
            Once authenticated users fire that event (and the following steps), conversion and
            drop-off will appear here. Try widening the date range.
          </p>
        </div>
      )}

      {/* Funnel visualization */}
      {hasData && (
        <ChartCard
          title={def.name}
          description={def.description}
        >
          <div className="space-y-3">
            {funnel.steps.map((step) => (
              <FunnelBar
                key={step.index}
                step={step}
                entered={funnel.entered}
                isBiggestDrop={step.index === funnel.biggestDropIndex}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Drop-off insight */}
      {hasData && funnel.biggestDropIndex !== null && (
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-4 text-sm">
          <div className="font-medium text-amber-700 dark:text-amber-400">Biggest drop-off</div>
          <p className="mt-1 text-xs text-muted-foreground">
            The largest single-step loss is between{' '}
            <strong>{funnel.steps[funnel.biggestDropIndex - 1]?.label}</strong> and{' '}
            <strong>{funnel.steps[funnel.biggestDropIndex]?.label}</strong> —{' '}
            <strong>{funnel.steps[funnel.biggestDropIndex]?.dropOff}</strong> users (
            {(100 - (funnel.steps[funnel.biggestDropIndex]?.stepPct ?? 0)).toFixed(1)}% of the prior
            step) did not continue. This is the highest-leverage place to investigate friction.
          </p>
        </div>
      )}

      {/* Method footer */}
      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">How funnels are computed</div>
        <ol className="ml-4 list-decimal space-y-1">
          <li>For each user we take the <strong>first time</strong> they fired each step&apos;s event.</li>
          <li>A user reaches step N only if first(step N) ≥ first(step N−1) — i.e. they did the steps in order.</li>
          <li><strong>Conversion %</strong> is relative to step 1; <strong>step %</strong> is relative to the previous step.</li>
          <li>Funnels are defined in <code className="rounded bg-muted px-1 text-[10px]">config/funnels.ts</code> — add a new one without a schema change.</li>
        </ol>
      </section>
    </div>
  );
}

// ── FunnelBar ─────────────────────────────────────────────────────────────────

function FunnelBar({
  step,
  entered,
  isBiggestDrop,
}: {
  step: FunnelStepResult;
  entered: number;
  isBiggestDrop: boolean;
}) {
  const widthPct = entered > 0 ? Math.max((step.users / entered) * 100, 2) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
            {step.index + 1}
          </span>
          <span className="font-medium">{step.label}</span>
          <code className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{step.event}</code>
        </span>
        <span className="flex items-center gap-3 tabular-nums">
          <span className="font-semibold">{step.users.toLocaleString()}</span>
          <span className="text-muted-foreground">{step.conversionPct}%</span>
        </span>
      </div>
      <div className="relative h-7 overflow-hidden rounded-md bg-muted/50">
        <div
          className={cn(
            'flex h-full items-center justify-end rounded-md px-2 text-[10px] font-medium text-primary-foreground transition-all',
            isBiggestDrop ? 'bg-amber-500' : 'bg-primary',
          )}
          style={{ width: `${widthPct}%` }}
        >
          {step.index > 0 && (
            <span className="whitespace-nowrap">
              {step.stepPct}% of prev
            </span>
          )}
        </div>
      </div>
      {step.index > 0 && step.dropOff > 0 && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-rose-500">
          <TrendingDown className="h-3 w-3" />
          −{step.dropOff.toLocaleString()} dropped
        </div>
      )}
    </div>
  );
}
