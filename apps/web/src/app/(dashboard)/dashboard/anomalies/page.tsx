import { AlertTriangle, ArrowDown, ArrowUp, ShieldAlert, Sigma } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { fetchAnomalySignals, fetchAnomalySummary } from '@/lib/data/fetchers';
import { friendlyEventName } from '@/lib/event-labels';
import { getPortalConfig } from '@/config/portals';
import type { AnomalySignal } from '@/lib/repositories/anomalies';

export const dynamic = 'force-dynamic';

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
  const [signals, summary] = await Promise.all([
    fetchAnomalySignals(),
    fetchAnomalySummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unusual Activity"
        description="Automatic alerts when activity suddenly spikes or drops compared to what's normal."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● Statistical baseline
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active alerts"
          value={String(summary.totalActive)}
          icon={AlertTriangle}
          trend={{
            direction: summary.totalActive > 0 ? 'up' : 'flat',
            label: summary.totalActive === 0 ? 'All metrics within bounds' : 'Above baseline 2σ',
          }}
          invertTrend
        />
        <KpiCard
          label="Urgent alerts"
          value={String(summary.critical)}
          icon={ShieldAlert}
          trend={{
            direction: summary.critical > 0 ? 'up' : 'flat',
            label: 'Much more than usual',
          }}
          invertTrend
        />
        <KpiCard
          label="Cautions"
          value={String(summary.warning)}
          icon={AlertTriangle}
          trend={{
            direction: summary.warning > 0 ? 'up' : 'flat',
            label: 'Noticeably more than usual',
          }}
          invertTrend
        />
        <KpiCard
          label="Detection method"
          value="Statistical baseline"
          icon={Sigma}
          trend={{ direction: 'flat', label: 'Compared against the last 7 days' }}
        />
      </section>

      {/* Signals */}
      {signals.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <Sigma className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-sm font-medium">All products are behaving normally</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            No product&apos;s activity is currently outside normal patterns. Alerts appear automatically when something is much busier or quieter than usual.
          </p>
        </div>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {signals.map((s, i) => (
            <AnomalyCard key={`${s.portalId}-${s.eventName}-${i}`} signal={s} />
          ))}
        </section>
      )}

      {/* Method footer */}
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground mt-2">The platform tracks typical hourly activity in each product. When something is much busier or quieter than usual, it raises an alert automatically — no configuration required.</p>
      </div>
    </div>
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
