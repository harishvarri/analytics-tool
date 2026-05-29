import {
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/analytics/PageHeader';
import { fetchInsights } from '@/lib/data/fetchers';
import type { Insight, InsightSeverity } from '@/lib/repositories/insights';

export const dynamic = 'force-dynamic';

const SEVERITY_STYLE: Record<InsightSeverity, { border: string; chip: string; label: string }> = {
  critical: { border: 'border-l-rose-500',    chip: 'border-rose-500/50 text-rose-600 dark:text-rose-400',       label: 'Critical' },
  warning:  { border: 'border-l-amber-500',   chip: 'border-amber-500/50 text-amber-600 dark:text-amber-400',    label: 'Warning' },
  positive: { border: 'border-l-emerald-500', chip: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400', label: 'Positive' },
  info:     { border: 'border-l-sky-500',     chip: 'border-sky-500/50 text-sky-600 dark:text-sky-400',          label: 'Info' },
};

export default async function InsightsPage() {
  const { insights, intelligence } = await fetchInsights();
  const hasData = insights.length > 0 || intelligence.mostAdopted !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Insights"
        description="Plain-English highlights of what changed this week versus last week — generated automatically."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● Rule-based · WoW
          </Badge>
        }
      />

      {/* Feature Intelligence scorecard */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <IntelCard
          label="Most adopted"
          icon={Sparkles}
          value={intelligence.mostAdopted?.feature ?? '—'}
          sub={intelligence.mostAdopted ? `${intelligence.mostAdopted.users} users this week` : 'No data'}
          tone="emerald"
        />
        <IntelCard
          label="Fastest growing"
          icon={TrendingUp}
          value={intelligence.fastestGrowing?.feature ?? '—'}
          sub={intelligence.fastestGrowing ? `+${intelligence.fastestGrowing.deltaPct}% WoW` : 'No growth signal'}
          tone="sky"
        />
        <IntelCard
          label="Least used"
          icon={TrendingDown}
          value={intelligence.leastUsed?.feature ?? '—'}
          sub={intelligence.leastUsed ? `${intelligence.leastUsed.users} users this week` : 'No data'}
          tone="slate"
        />
        <IntelCard
          label="Churn risk"
          icon={ArrowDownRight}
          value={intelligence.churnRisk?.feature ?? '—'}
          sub={intelligence.churnRisk ? `${intelligence.churnRisk.deltaPct}% WoW` : 'None detected'}
          tone="rose"
        />
      </section>

      {/* Insights feed */}
      {insights.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {insights.length} insight{insights.length === 1 ? '' : 's'} this week
          </h2>
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </section>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Lightbulb className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">{hasData ? 'No notable changes this week' : 'No insights yet'}</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Insights surface when a metric or feature moves significantly week-over-week
            (≥ 25% change). As activity accumulates over two weeks, callouts appear here automatically.
          </p>
        </div>
      )}

      {/* Method footer */}
      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">How insights are generated</div>
        <ol className="ml-4 list-decimal space-y-1">
          <li>Each platform metric (active users, sessions, logins, errors, login failures) and each feature is compared <strong>this week vs the prior week</strong>.</li>
          <li>A change of <strong>≥ 25%</strong> is notable; <strong>≥ 50%</strong> is a spike/drop. New traction and full churn (usage → 0) are flagged explicitly.</li>
          <li>Severity is rule-based: rising errors/failures are warnings; rising usage is positive; falling usage is info/warning by magnitude.</li>
          <li>Entirely deterministic — <strong>no external AI/LLM</strong> is used, so output is explainable and reproducible.</li>
        </ol>
      </section>
    </div>
  );
}

// ── IntelCard ─────────────────────────────────────────────────────────────────

function IntelCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Sparkles;
  tone: 'emerald' | 'sky' | 'slate' | 'rose';
}) {
  const toneClass = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    sky:     'text-sky-600 dark:text-sky-400',
    slate:   'text-muted-foreground',
    rose:    'text-rose-600 dark:text-rose-400',
  }[tone];

  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className="truncate text-lg font-semibold capitalize" title={value}>{value}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

// ── InsightCard ─────────────────────────────────────────────────────────────

function InsightCard({ insight: ins }: { insight: Insight }) {
  const style = SEVERITY_STYLE[ins.severity];
  const DirIcon = ins.direction === 'up' ? ArrowUpRight : ins.direction === 'down' ? ArrowDownRight : Lightbulb;

  return (
    <Card className={`border-l-4 ${style.border}`}>
      <CardContent className="flex items-start gap-3 py-4">
        <div className="mt-0.5">
          <DirIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{ins.title}</span>
            <Badge variant="outline" className={style.chip}>{style.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{ins.detail}</p>
        </div>
        {ins.deltaPct !== null && (
          <div className={`shrink-0 text-sm font-bold tabular-nums ${ins.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {ins.deltaPct > 0 ? '+' : ''}{ins.deltaPct}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
