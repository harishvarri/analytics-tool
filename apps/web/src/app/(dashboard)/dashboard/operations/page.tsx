import Link from 'next/link';
import { AlertTriangle, Bug, ChevronRight, HeartPulse, Lightbulb, ShieldAlert, TrendingDown, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import { fetchOrganizationHealth } from '@/lib/data/fetchers';
import type { AttentionItem, OrgTier } from '@/lib/repositories/orgHealth';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const TIER_META: Record<OrgTier, { label: string; ring: string; text: string }> = {
  healthy:  { label: 'Healthy',  ring: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  warning:  { label: 'Warning',  ring: 'border-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  at_risk:  { label: 'At risk',  ring: 'border-orange-500',  text: 'text-orange-600 dark:text-orange-400' },
  critical: { label: 'Critical', ring: 'border-rose-500',    text: 'text-rose-600 dark:text-rose-400' },
};

const SEV_META: Record<AttentionItem['severity'], { dot: string; tone: string }> = {
  critical: { dot: 'bg-rose-500',  tone: 'text-rose-600 dark:text-rose-400' },
  warning:  { dot: 'bg-amber-500', tone: 'text-amber-600 dark:text-amber-400' },
  info:     { dot: 'bg-sky-500',   tone: 'text-sky-600 dark:text-sky-400' },
};

const KIND_ICON = {
  project_at_risk: ShieldAlert,
  error_spike: Bug,
  adoption_drop: TrendingDown,
  critical_alert: AlertTriangle,
  inactive_project: TrendingDown,
} as const;

export default async function ExecutiveOperationsCenter() {
  const h = await fetchOrganizationHealth();
  const tier = TIER_META[h.tier];

  const components = [
    { label: 'Project health', v: h.components.projectHealth, weight: '30%' },
    { label: 'Incident severity', v: h.components.incidentSeverity, weight: '25%' },
    { label: 'Error impact', v: h.components.errorImpact, weight: '20%' },
    { label: 'User adoption', v: h.components.userAdoption, weight: '15%' },
    { label: 'Dept engagement', v: h.components.departmentEngagement, weight: '10%' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Operations Center"
        description="What needs attention across the organization right now — health, risks, and recommended actions."
        actions={<Badge variant="outline" className={`${tier.text} border-current`}>● {tier.label}</Badge>}
      />

      {/* Organization health score + headline risk counters */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className={`flex items-center gap-5 rounded-xl border-2 ${tier.ring} bg-card p-6 lg:col-span-1`}>
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-current/20">
            <span className={`text-4xl font-bold tabular-nums ${tier.text}`}>{h.score}</span>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Organization health</div>
            <div className={`text-lg font-semibold ${tier.text}`}>{tier.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">Risk score {h.riskScore}/100</div>
            <Link href="/dashboard/health" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Health breakdown <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2 sm:grid-cols-3">
          <KpiCard label="Critical issues" value={fmt.format(h.criticalIssues)} icon={ShieldAlert}
            trend={{ direction: h.criticalIssues > 0 ? 'up' : 'flat', label: 'need action' }} invertTrend />
          <KpiCard label="Active incidents" value={fmt.format(h.activeIncidents)} icon={AlertTriangle}
            trend={{ direction: h.activeIncidents > 0 ? 'up' : 'flat', label: 'open alerts' }} invertTrend />
          <KpiCard label="Affected users" value={fmt.format(h.affectedUsers)} icon={Users}
            trend={{ direction: 'flat', label: 'on at-risk products' }} />
          <KpiCard label="Healthy products" value={fmt.format(h.totals.healthy)} icon={HeartPulse}
            trend={{ direction: 'flat', label: `of ${h.totals.projects}` }} href="/dashboard/health" />
          <KpiCard label="Warning" value={fmt.format(h.totals.warning)} icon={TrendingDown}
            trend={{ direction: h.totals.warning > 0 ? 'up' : 'flat', label: 'products' }} invertTrend href="/dashboard/health" />
          <KpiCard label="Critical" value={fmt.format(h.totals.critical)} icon={ShieldAlert}
            trend={{ direction: h.totals.critical > 0 ? 'up' : 'flat', label: 'products' }} invertTrend href="/dashboard/health" />
        </div>
      </section>

      {/* Why this status + risk factors */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={`Why ${tier.label.toLowerCase()}?`} description="The factors driving today's organization status">
          <ul className="space-y-2">
            {h.why.map((w, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span>{w.severity === 'critical' ? '🔴' : w.severity === 'warning' ? '🟡' : '🟢'}</span>
                <span className={w.severity === 'ok' ? 'text-muted-foreground' : ''}>{w.text}</span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard title="Risk factors" description="Where operational risk is concentrated (higher = riskier)">
          <ul className="space-y-3 pt-1">
            {h.riskFactors.map((r) => {
              const tone = r.score >= 60 ? 'bg-rose-500' : r.score >= 30 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <li key={r.key} className="text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{r.label}</span>
                    <span className="tabular-nums text-muted-foreground">{r.score}/100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, r.score)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
      </section>

      {/* Health component breakdown */}
      <ChartCard title="How the score is built" description="Weighted blend across the five operational dimensions">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {components.map((c) => (
            <div key={c.label}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium">{c.label}</span>
                <span className="text-[10px] text-muted-foreground">{c.weight}</span>
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{c.v}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, c.v)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* Today's attention items */}
        <ChartCard title="Today's attention items" description="Everything that needs a look, most urgent first">
          {h.attention.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <HeartPulse className="h-6 w-6 text-emerald-500" />
              Nothing needs attention — the organization is healthy.
            </div>
          ) : (
            <ul className="divide-y">
              {h.attention.map((a, i) => {
                const sev = SEV_META[a.severity];
                const Icon = KIND_ICON[a.kind];
                const body = (
                  <div className="flex items-start gap-3 py-2.5">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} />
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.detail}</div>
                    </div>
                    {a.slug && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                );
                return (
                  <li key={`${a.title}-${i}`}>
                    {a.slug ? <Link href={`/dashboard/projects/${a.slug}`} className="block hover:bg-muted/40">{body}</Link> : body}
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        {/* Executive recommendations */}
        <ChartCard title="Executive recommendations" description="Concrete actions, generated from current signals">
          <ul className="space-y-2">
            {h.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2.5 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </section>

      <div className="text-[11px] text-muted-foreground">
        Health = 30% project health + 25% incident severity + 20% error impact + 15% adoption + 10% department engagement.
        Incident severity is currently derived from project status; a dedicated Incident Management module is the next step.
      </div>
    </div>
  );
}
