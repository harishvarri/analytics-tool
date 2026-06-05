import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Gauge,
  HeartPulse,
  Lightbulb,
  LineChart,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchInsights, isUsingMockData } from '@/lib/data/fetchers';
import type { ExecutiveOperationsReport, MetricDelta } from '@/lib/repositories/insights';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

const STATUS_STYLE: Record<ExecutiveOperationsReport['platformStatus'], string> = {
  healthy: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const PRIORITY_STYLE = {
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
} as const;

function statusLabel(status: ExecutiveOperationsReport['platformStatus']): string {
  if (status === 'critical') return 'Critical';
  if (status === 'warning') return 'Warning';
  return 'Healthy';
}

function deltaLabel(delta: MetricDelta): string {
  if (delta.deltaPct === null) return delta.value > 0 ? 'new this week' : 'no change';
  if (delta.deltaPct === 0) return 'flat vs last week';
  return `${delta.deltaPct > 0 ? '+' : ''}${delta.deltaPct}% vs last week`;
}

function trendDirection(delta: MetricDelta): 'up' | 'down' | 'flat' {
  return delta.direction;
}

function percent(value: number | null): string {
  if (value === null) return 'New';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function metricTone(value: number): string {
  if (value >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function hasReportSignals(report: ExecutiveOperationsReport): boolean {
  return (
    report.productRanking.length > 0 ||
    report.engagement.activeUsers.value > 0 ||
    report.adoption.mostUsed !== null ||
    report.departments.rows.length > 0 ||
    report.risks.length > 0 ||
    report.incidents.open > 0 ||
    report.incidents.critical > 0
  );
}

export default async function InsightsPage() {
  const report = await fetchInsights();
  const hasData = hasReportSignals(report);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={120_000} />
      <PageHeader
        title="Executive Operations Report"
        description="Weekly operational intelligence across products, departments, adoption, reliability, and risk."
        actions={
          <Badge variant="outline" className={STATUS_STYLE[report.platformStatus]}>
            {statusLabel(report.platformStatus)}
          </Badge>
        }
      />

      {isUsingMockData ? (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
              <div className="font-medium text-amber-900 dark:text-amber-100">Live analytics data unavailable</div>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                This report is currently rendered from fallback data. Restore the analytics connection before relying on these weekly metrics for management decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Weekly Operations Summary
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {report.week.startDate} - {report.week.endDate}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compared with {report.week.previousStartDate} - {report.week.previousEndDate}
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 px-4 py-3">
            <div className="text-xs text-muted-foreground">Overall status</div>
            <div className={`mt-1 text-2xl font-semibold ${scoreTone(report.scorecard.platformHealth)}`}>
              {statusLabel(report.platformStatus)}
            </div>
          </div>
        </div>
        <ul className="mt-5 grid gap-2 text-sm md:grid-cols-2">
          {report.executiveSummary.map((item) => (
            <li key={item} className="flex gap-2 rounded-md bg-muted/35 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active users"
          value={fmt.format(report.engagement.activeUsers.value)}
          icon={Users}
          trend={{ direction: trendDirection(report.engagement.activeUsers), label: deltaLabel(report.engagement.activeUsers) }}
        />
        <KpiCard
          label="Sessions"
          value={fmt.format(report.engagement.sessions.value)}
          icon={LineChart}
          trend={{ direction: trendDirection(report.engagement.sessions), label: deltaLabel(report.engagement.sessions) }}
        />
        <KpiCard
          label="Successful logins"
          value={fmt.format(report.engagement.logins.value)}
          icon={ShieldAlert}
          trend={{ direction: trendDirection(report.engagement.logins), label: deltaLabel(report.engagement.logins) }}
        />
        <KpiCard
          label="Open incidents"
          value={fmt.format(report.incidents.open)}
          icon={AlertTriangle}
          trend={{ direction: report.incidents.critical > 0 ? 'up' : 'flat', label: `${fmt.format(report.incidents.critical)} critical` }}
          invertTrend
        />
      </section>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Lightbulb className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">No weekly operations data yet</div>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              The executive report will populate automatically when connected products send events, sessions, logins, departments, and error data.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Product Performance Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Product</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                    <th className="px-2 py-2 text-right font-medium">Sessions</th>
                    <th className="px-2 py-2 text-right font-medium">Health</th>
                    <th className="px-2 py-2 text-right font-medium">Growth</th>
                    <th className="px-2 py-2 text-right font-medium">Errors</th>
                    <th className="px-2 py-2 text-right font-medium">Reliability</th>
                  </tr>
                </thead>
                <tbody>
                  {report.productRanking.map((product) => (
                    <tr key={product.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-[11px] text-muted-foreground">{product.trend}</div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(product.activeUsers)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(product.sessions)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums font-semibold ${scoreTone(product.healthScore)}`}>{product.healthScore}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{percent(product.weeklyGrowthPct)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(product.errorCount)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums font-semibold ${scoreTone(product.reliabilityScore)}`}>{product.reliabilityScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Product Intelligence Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {report.productIntelligence.length ? report.productIntelligence.map((item) => (
                <li key={item} className="rounded-md bg-muted/35 p-3 text-muted-foreground">{item}</li>
              )) : (
                <li className="rounded-md border border-dashed p-3 text-muted-foreground">No product movement detected yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Adoption Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <CapabilityCard title="Most Used Capability" item={report.adoption.mostUsed} />
            <CapabilityCard title="Fastest Growing Capability" item={report.adoption.fastestGrowing} />
            <CapabilityCard title="Least Used Capability" item={report.adoption.leastUsed} />
            <CapabilityCard title="Declining Capability" item={report.adoption.declining} />
            {report.adoption.newlyAdopted.length > 0 ? (
              <div className="rounded-md border p-3 md:col-span-2">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Newly Adopted Features</div>
                <div className="flex flex-wrap gap-2">
                  {report.adoption.newlyAdopted.map((item) => (
                    <Badge key={item.feature} variant="secondary">{item.feature}: {item.usersThisWeek} users</Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              User Engagement Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetricLine label="Avg sessions/user" value={report.engagement.avgSessionsPerUser.toFixed(1)} />
            <MetricLine label="Avg logins/user" value={report.engagement.avgLoginsPerUser.toFixed(1)} />
            <MetricLine label="Returning users" value={fmt.format(report.engagement.returningUsers)} />
            <MetricLine label="New users" value={fmt.format(report.engagement.newUsers)} />
            <div className="rounded-md bg-muted/35 p-3">
              <div className="text-xs text-muted-foreground">Engagement trend</div>
              <div className="mt-1 font-medium">{report.engagement.trend}</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Department Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <DepartmentHighlight
                title="Most Active Department"
                item={report.departments.mostActive}
                tone="emerald"
              />
              <DepartmentHighlight
                title="Least Active Department"
                item={report.departments.leastActive}
                tone="amber"
              />
            </div>
            {report.departments.rows.length ? report.departments.rows.map((department) => (
              <div key={department.department} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{department.department}</div>
                    <div className="text-xs text-muted-foreground">{department.summary}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold tabular-nums">{percent(department.growthPct)}</div>
                    <div className="text-muted-foreground">{department.adoptionLabel}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Department data is not available yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Risk Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.risks.length ? report.risks.map((risk) => (
              <div key={risk.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{risk.title}</span>
                      <Badge variant="outline" className={PRIORITY_STYLE[risk.priority]}>{risk.priority.toUpperCase()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmt.format(risk.current)} detected this week{risk.previous !== null ? `; previous week: ${fmt.format(risk.previous)}.` : '.'}
                    </p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                  <div>
                    <div className="font-medium">Potential causes</div>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {risk.potentialCauses.map((cause) => <li key={cause}>{cause}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium">Recommended action</div>
                    <p className="mt-1 text-muted-foreground">{risk.recommendedAction}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No material operational risks detected this week.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <IncidentMetric label="Created" value={report.incidents.created} />
              <IncidentMetric label="Resolved" value={report.incidents.resolved} />
              <IncidentMetric label="Open" value={report.incidents.open} tone="amber" />
              <IncidentMetric label="Critical" value={report.incidents.critical} tone={report.incidents.critical > 0 ? 'rose' : 'emerald'} />
            </div>
            <div className="rounded-md bg-muted/35 p-3 text-xs text-muted-foreground">
              {report.incidents.summary}
            </div>
            {report.recommendations.map((recommendation) => (
              <div key={`${recommendation.priority}-${recommendation.title}`} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={PRIORITY_STYLE[recommendation.priority]}>{recommendation.priority.toUpperCase()}</Badge>
                  <span className="text-sm font-medium">{recommendation.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{recommendation.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
              Weekly Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreLine label="Platform Health" value={report.scorecard.platformHealth} />
            <ScoreLine label="Engagement" value={report.scorecard.engagement} />
            <ScoreLine label="Reliability" value={report.scorecard.reliability} />
            <ScoreLine label="Adoption" value={report.scorecard.adoption} />
            <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
              <div className="rounded-md bg-muted/35 p-3">
                <div className="text-xs text-muted-foreground">Risk</div>
                <div className="font-semibold">{report.scorecard.risk}</div>
              </div>
              <div className="rounded-md bg-muted/35 p-3">
                <div className="text-xs text-muted-foreground">Overall</div>
                <div className="font-semibold">{statusLabel(report.scorecard.overallStatus)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function CapabilityCard({ title, item }: { title: string; item: ExecutiveOperationsReport['adoption']['mostUsed'] }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {item ? (
        <>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold capitalize">{item.feature}</div>
            <Badge variant="outline">{percent(item.growthPct)}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.narrative}</p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No signal detected this week.</p>
      )}
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${scoreTone(value)}`}>{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function DepartmentHighlight({
  title,
  item,
  tone,
}: {
  title: string;
  item: ExecutiveOperationsReport['departments']['mostActive'];
  tone: 'emerald' | 'amber';
}) {
  const colorClass =
    tone === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : 'border-amber-500/20 bg-amber-500/5';

  return (
    <div className={`rounded-md border p-3 ${colorClass}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {item ? (
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{item.department}</div>
            <div className="text-xs text-muted-foreground">{item.summary}</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-semibold tabular-nums ${metricTone(item.activeUsers)}`}>{fmt.format(item.activeUsers)}</div>
            <div className="text-xs text-muted-foreground">{item.adoptionLabel}</div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No department activity captured yet.</p>
      )}
    </div>
  );
}

function IncidentMetric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | null;
  tone?: 'slate' | 'amber' | 'rose' | 'emerald';
}) {
  const classes =
    tone === 'amber'
      ? 'border-amber-500/20 bg-amber-500/5'
      : tone === 'rose'
        ? 'border-rose-500/20 bg-rose-500/5'
        : tone === 'emerald'
          ? 'border-emerald-500/20 bg-emerald-500/5'
        : 'border-border bg-background';

  return (
    <div className={`rounded-md border p-3 ${classes}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${value === null ? 'text-muted-foreground' : ''}`}>
        {value === null ? 'N/A' : fmt.format(value)}
      </div>
    </div>
  );
}
