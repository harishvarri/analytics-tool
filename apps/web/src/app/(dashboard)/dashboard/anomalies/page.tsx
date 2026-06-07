import Link from 'next/link';
import { AlertTriangle, ArrowDown, ArrowUp, Bug, Clock, Gauge, LogIn, ShieldAlert, Sigma, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { fetchAnomalySignals, fetchAnomalySummary, fetchOperationalRisks } from '@/lib/data/fetchers';
import { friendlyEventName } from '@/lib/event-labels';
import { getPortalConfig } from '@/config/portals';
import type { AnomalySignal, RiskKind, RiskSignal } from '@/lib/repositories/anomalies';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

const RISK_ICON: Record<RiskKind, typeof Bug> = {
  login_failures: LogIn, usage_drop: TrendingDown, error_spike: Bug, inactivity: Clock, performance: Gauge,
};
const RISK_HREF: Record<RiskKind, string> = {
  login_failures: '/dashboard/logins', usage_drop: '/dashboard/retention', error_spike: '/dashboard/reliability',
  inactivity: '/dashboard/health', performance: '/dashboard/health',
};

const SEVERITY_PILL: Record<AnomalySignal['severity'], string> = {
  warning:  'border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/5',
  critical: 'border-rose-500/50  text-rose-700  dark:text-rose-400  bg-rose-500/5',
};

const SEVERITY_LABEL: Record<AnomalySignal['severity'], string> = {
  warning:  'Caution',
  critical: 'Urgent',
};

const DIRECTION_LABEL: Record<AnomalySignal['direction'], string> = {
  spike: 'sudden increase',
  dip:   'sudden drop',
};

const DIRECTION_TONE: Record<AnomalySignal['direction'], string> = {
  spike: 'text-rose-600 dark:text-rose-400',
  dip:   'text-sky-600  dark:text-sky-400',
};

function fmtHour(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default async function AnomaliesPage() {
  const [risks, signals, summary] = await Promise.all([
    fetchOperationalRisks(),
    fetchAnomalySignals(),
    fetchAnomalySummary(),
  ]);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title="Risk & Anomaly"
        description="Concrete operational risks across products — login failures, usage drops, error spikes, inactivity and slow performance — plus statistical activity anomalies."
        actions={
          <Badge variant="outline" className={risks.total > 0
            ? 'border-rose-500/40 text-rose-600 dark:text-rose-400'
            : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'}>
            {risks.total > 0 ? `${risks.total} active risk${risks.total === 1 ? '' : 's'}` : 'No active risks'}
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active risks" value={String(risks.total)} icon={AlertTriangle}
          trend={{ direction: risks.total > 0 ? 'up' : 'flat', label: risks.total === 0 ? 'all products healthy' : 'need a look' }} invertTrend />
        <KpiCard label="Urgent" value={String(risks.critical)} icon={ShieldAlert}
          trend={{ direction: risks.critical > 0 ? 'up' : 'flat', label: 'act now' }} invertTrend />
        <KpiCard label="Cautions" value={String(risks.warning)} icon={AlertTriangle}
          trend={{ direction: risks.warning > 0 ? 'up' : 'flat', label: 'keep an eye on' }} invertTrend />
        <KpiCard label="Activity anomalies" value={String(summary.totalActive)} icon={Sigma}
          trend={{ direction: summary.totalActive > 0 ? 'up' : 'flat', label: 'statistical spikes / dips' }} invertTrend />
      </section>

      {/* Operational risks — the useful, explainable signals */}
      {risks.signals.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-sm font-medium">No operational risks right now</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            No product currently has elevated login failures, error spikes, usage drops, prolonged inactivity, or slow
            performance. Risks appear here automatically the moment any of those cross a threshold.
          </p>
        </div>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {risks.signals.map((s, i) => (
            <RiskCard key={`${s.kind}-${s.portalId}-${i}`} signal={s} />
          ))}
        </section>
      )}

      {/* Statistical anomalies — secondary */}
      {signals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Statistical activity anomalies</h2>
          <p className="text-xs text-muted-foreground">Hours where a product was much busier or quieter than its 7-day norm.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {signals.map((s, i) => (
              <AnomalyCard key={`${s.portalId}-${s.eventName}-${i}`} signal={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RiskCard({ signal: s }: { signal: RiskSignal }) {
  const Icon = RISK_ICON[s.kind];
  const tone = s.severity === 'critical'
    ? 'border-rose-500/50 bg-rose-500/5'
    : 'border-amber-500/50 bg-amber-500/5';
  const sevTone = s.severity === 'critical' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400';
  return (
    <Card className={`overflow-hidden ${tone}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
            <Icon className={`h-3.5 w-3.5 ${sevTone}`} />{s.title}
          </CardTitle>
          <Badge variant="outline" className={`shrink-0 ${sevTone}`}>{s.severity === 'critical' ? 'Urgent' : 'Caution'}</Badge>
        </div>
        <div className={`text-sm font-bold tabular-nums ${sevTone}`}>{s.metric}</div>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 text-[11px]">
        <p className="text-muted-foreground">{s.detail}</p>
        <p><span className="font-medium text-amber-600 dark:text-amber-400">Action: </span><span className="text-muted-foreground">{s.action}</span></p>
        <Link href={RISK_HREF[s.kind]} className="inline-block text-primary hover:underline">Investigate →</Link>
      </CardContent>
    </Card>
  );
}

function AnomalyCard({ signal: s }: { signal: AnomalySignal }) {
  const Arrow = s.direction === 'spike' ? ArrowUp : ArrowDown;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-xs font-semibold" title={s.eventName}>
            {friendlyEventName(s.eventName)}
          </CardTitle>
          <Badge variant="outline" className={`shrink-0 ${SEVERITY_PILL[s.severity]}`}>
            {SEVERITY_LABEL[s.severity]}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {getPortalConfig(s.portalId).name} · observed {fmtHour(s.observedHour)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <Arrow className={`h-5 w-5 ${DIRECTION_TONE[s.direction]}`} />
              <span className={`text-2xl font-bold tabular-nums ${DIRECTION_TONE[s.direction]}`}>
                {s.currentEvents}
              </span>
            </div>
            <span className={`text-[11px] ${DIRECTION_TONE[s.direction]}`}>{DIRECTION_LABEL[s.direction]}</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              z-score
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {s.zScore > 0 ? '+' : ''}{s.zScore.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t pt-3 text-[11px]">
          <div>
            <div className="text-muted-foreground">Baseline μ</div>
            <div className="font-medium tabular-nums">{s.baselineMean.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Baseline σ</div>
            <div className="font-medium tabular-nums">{s.baselineStd.toFixed(1)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
