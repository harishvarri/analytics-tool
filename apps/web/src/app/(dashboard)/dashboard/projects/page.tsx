import { AlertTriangle, CheckCircle2, FolderKanban, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/analytics/PageHeader';
import { KpiCard } from '@/components/analytics/KpiCard';
import {
  fetchPortfolioSummary,
  fetchProjectHealthList,
} from '@/lib/data/fetchers';
import type { ProjectHealth } from '@/lib/repositories/projectHealth';

export const dynamic = 'force-dynamic';

// ── Tier styling ────────────────────────────────────────────────────────────

const TIER_LABEL: Record<ProjectHealth['tier'], string> = {
  healthy:  'Healthy',
  at_risk:  'At risk',
  critical: 'Critical',
};

const TIER_PILL: Record<ProjectHealth['tier'], string> = {
  healthy:  'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5',
  at_risk:  'border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/5',
  critical: 'border-rose-500/50 text-rose-700 dark:text-rose-400 bg-rose-500/5',
};

const TIER_BAR: Record<ProjectHealth['tier'], string> = {
  healthy:  'bg-emerald-500',
  at_risk:  'bg-amber-500',
  critical: 'bg-rose-500',
};

// Factor bars — color tracks "is this factor healthy?" not the project tier
function factorTone(value: number): { bar: string; text: string } {
  if (value >= 75) return { bar: 'bg-emerald-500',  text: 'text-emerald-600 dark:text-emerald-400' };
  if (value >= 50) return { bar: 'bg-amber-500',    text: 'text-amber-600 dark:text-amber-400' };
  return                   { bar: 'bg-rose-500',     text: 'text-rose-600 dark:text-rose-400' };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function ProjectsPage() {
  const [summary, projects] = await Promise.all([
    fetchPortfolioSummary(),
    fetchProjectHealthList(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Health"
        description="Composite PHI score per project — Velocity (40%) + Quality (30%) + On-track (30%)."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● 28-day window
          </Badge>
        }
      />

      {/* Portfolio KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Portfolio Average PHI"
          value={summary.avgPhi !== null ? String(summary.avgPhi) : '—'}
          icon={FolderKanban}
          trend={{ direction: 'flat', label: `${summary.total} project${summary.total === 1 ? '' : 's'} tracked` }}
        />
        <KpiCard
          label="Healthy"
          value={String(summary.healthy)}
          icon={CheckCircle2}
          trend={{ direction: 'flat', label: 'PHI ≥ 75' }}
        />
        <KpiCard
          label="At Risk"
          value={String(summary.atRisk)}
          icon={AlertTriangle}
          trend={{ direction: summary.atRisk > 0 ? 'up' : 'flat', label: '50 ≤ PHI < 75' }}
          invertTrend
        />
        <KpiCard
          label="Critical"
          value={String(summary.critical)}
          icon={ShieldAlert}
          trend={{ direction: summary.critical > 0 ? 'up' : 'flat', label: 'PHI < 50' }}
          invertTrend
        />
      </section>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No projects tracked yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            PHI is computed from <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">ticket.created</code>,{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">ticket.status_changed</code>, and{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">bug.reported</code> events. Once
            Sentinel users start creating and moving tickets, projects will appear here automatically.
          </p>
        </div>
      )}

      {/* Portfolio grid */}
      {projects.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectHealthCard key={p.projectId} project={p} />
          ))}
        </section>
      )}

      {/* Formula footer */}
      {projects.length > 0 && (
        <section className="rounded-md border p-4 text-xs text-muted-foreground">
          <div className="mb-2 font-semibold uppercase tracking-wide">How PHI is computed</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="font-medium text-foreground">Velocity (40%)</div>
              <p>Tickets reaching Done in last 28 days vs the prior 28 days. New projects target ~20/month.</p>
            </div>
            <div>
              <div className="font-medium text-foreground">Quality (30%)</div>
              <p>100 − (bugs ÷ total tickets) × 100, last 28 days. Lower bug rate → higher score.</p>
            </div>
            <div>
              <div className="font-medium text-foreground">On-track (30%)</div>
              <p>Open tickets dwelling within stage p75. Aging tickets penalize the score linearly.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function ProjectHealthCard({ project: p }: { project: ProjectHealth }) {
  const velTone = factorTone(p.velocityNorm);
  const qaTone  = factorTone(p.qualityNorm);
  const otTone  = factorTone(p.ontrackNorm);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-sm font-semibold" title={p.projectName}>
            {p.projectName}
          </CardTitle>
          <Badge variant="outline" className={`shrink-0 ${TIER_PILL[p.tier]}`}>
            {TIER_LABEL[p.tier]}
          </Badge>
        </div>

        {/* PHI score + bar */}
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold tracking-tight tabular-nums">
              {p.phiScore.toFixed(0)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${TIER_BAR[p.tier]}`}
              style={{ width: `${Math.max(2, Math.min(100, p.phiScore))}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {/* Factor breakdown */}
        <FactorBar
          label="Velocity"
          value={p.velocityNorm}
          tone={velTone}
          context={`${p.done28d} done · prev ${p.donePrev28d}`}
        />
        <FactorBar
          label="Quality"
          value={p.qualityNorm}
          tone={qaTone}
          context={`${p.bugCount} bugs of ${p.workCount} tickets`}
        />
        <FactorBar
          label="On-track"
          value={p.ontrackNorm}
          tone={otTone}
          context={`${p.agingCount} aging of ${p.openCount} open`}
        />
      </CardContent>
    </Card>
  );
}

function FactorBar({
  label,
  value,
  tone,
  context,
}: {
  label: string;
  value: number;
  tone: { bar: string; text: string };
  context: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${tone.text}`}>{value.toFixed(0)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-muted-foreground">{context}</div>
    </div>
  );
}
