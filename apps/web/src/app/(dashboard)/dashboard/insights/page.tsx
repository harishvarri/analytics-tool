import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  HeartPulse,
  Lightbulb,
  LineChart,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ReportExport, type ReportSection } from '@/components/shared/ReportExport';
import { fetchInsights, fetchUserProfileSummaries, isUsingMockData } from '@/lib/data/fetchers';
import { computeProductivity } from '@/lib/productivity';
import type { ExecutiveOperationsReport, MetricDelta } from '@/lib/repositories/insights';
import {
  dayToWeek,
  getReportPeriod,
  monthName,
  monthShort,
  periodNavLinks,
  weekRangeLabel,
  calendarWeekBounds,
  type WeekNumber,
} from '@/lib/report-periods';

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
  if (delta.deltaPct === null) return delta.value > 0 ? 'new this period' : 'no change';
  if (delta.deltaPct === 0) return 'flat vs prior period';
  return `${delta.deltaPct > 0 ? '+' : ''}${delta.deltaPct}% vs prior period`;
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

function hasReportSignals(report: ExecutiveOperationsReport): boolean {
  return (
    report.productRanking.length > 0 ||
    report.engagement.activeUsers.value > 0 ||
    report.adoption.mostUsed !== null ||
    report.risks.length > 0 ||
    report.incidents.open > 0 ||
    report.incidents.critical > 0
  );
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string; w?: string; period?: string }>;
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const nowWeek = dayToWeek(now.getDate());

  // Parse URL params — default to current calendar week
  const year = sp.y ? parseInt(sp.y, 10) : nowY;
  const month = sp.m ? parseInt(sp.m, 10) : nowM;
  // sp.w: '1'|'2'|'3'|'4' for weeks, 'month' for monthly; backward compat: sp.period='month'
  const rawW = sp.w ?? (sp.period === 'month' ? 'month' : undefined);
  const isMonthlyView = rawW === 'month';
  const week: WeekNumber | null = isMonthlyView ? null
    : rawW ? (parseInt(rawW, 10) as WeekNumber)
    : nowWeek;

  const period = getReportPeriod(year, month, week);
  const nav = periodNavLinks(year, month, week);

  const [report, people] = await Promise.all([
    fetchInsights(period),
    fetchUserProfileSummaries(300),
  ]);

  const hasData = hasReportSignals(report);

  // Top performers by productivity
  const topUsers = people
    .filter((u) => u.totalEvents > 0)
    .map((u) => ({
      u,
      prod: computeProductivity({
        activeMinutes: u.totalSessions * 8,
        businessActions: u.totalEvents,
        sessions: u.totalSessions,
        productsUsed: u.appsUsed,
        errors: 0,
      }).score,
    }))
    .sort((a, b) => b.prod - a.prod || b.u.totalEvents - a.u.totalEvents)
    .slice(0, 8);

  // Build comprehensive export sections
  const exportSections: ReportSection[] = [
    {
      title: 'Report Period',
      headers: ['Field', 'Value'],
      rows: [
        ['Period', period.displayLabel],
        ['Date Range', `${report.week.startDate} to ${report.week.endDate}`],
        ['Compared with', `${report.week.previousStartDate} to ${report.week.previousEndDate}`],
        ['Platform Status', statusLabel(report.platformStatus)],
        ['Overall Status', statusLabel(report.scorecard.overallStatus)],
      ],
    },
    {
      title: 'Key Metrics',
      headers: ['Metric', 'This Period', 'Previous Period', 'Δ Change'],
      rows: [
        ['Active Users', report.engagement.activeUsers.value, report.engagement.activeUsers.previous, deltaLabel(report.engagement.activeUsers)],
        ['Sessions', report.engagement.sessions.value, report.engagement.sessions.previous, deltaLabel(report.engagement.sessions)],
        ['Successful Logins', report.engagement.logins.value, report.engagement.logins.previous, deltaLabel(report.engagement.logins)],
        ['Open Incidents', report.incidents.open, '', ''],
        ['Critical Incidents', report.incidents.critical, '', ''],
        ['Returning Users', report.engagement.returningUsers, '', ''],
        ['New Users', report.engagement.newUsers, '', ''],
        ['Avg Sessions / User', report.engagement.avgSessionsPerUser, '', ''],
        ['Avg Logins / User', report.engagement.avgLoginsPerUser, '', ''],
        ['Engagement Trend', report.engagement.trend, '', ''],
      ],
    },
    {
      title: 'Product Performance',
      headers: ['Product', 'Active Users', 'Sessions', 'Health Score', 'Trend', 'Growth %', 'Errors', 'Reliability'],
      rows: report.productRanking.map((r) => [
        r.name, r.activeUsers, r.sessions, r.healthScore, r.trend,
        r.weeklyGrowthPct !== null ? `${r.weeklyGrowthPct}%` : 'New',
        r.errorCount, r.reliabilityScore,
      ]),
    },
    {
      title: 'User Intelligence — Top Performers',
      headers: ['User', 'Email', 'Actions', 'Sessions', 'Products Used', 'Productivity Score'],
      rows: topUsers.map(({ u, prod }) => [
        u.displayName ?? '', u.email ?? u.userId, u.totalEvents, u.totalSessions, u.appsUsed, prod,
      ]),
    },
    {
      title: 'Operational Scorecard',
      headers: ['Dimension', 'Score'],
      rows: [
        ['Platform Health', `${report.scorecard.platformHealth}/100`],
        ['Engagement', `${report.scorecard.engagement}/100`],
        ['Reliability', `${report.scorecard.reliability}/100`],
        ['Adoption', `${report.scorecard.adoption}/100`],
        ['Risk Level', report.scorecard.risk],
        ['Overall Status', statusLabel(report.scorecard.overallStatus)],
      ],
    },
    {
      title: 'Risk Intelligence',
      headers: ['Priority', 'Risk', 'Count (This Period)', 'Count (Previous)', 'Potential Causes', 'Recommended Action'],
      rows: report.risks.map((r) => [
        r.priority.toUpperCase(), r.title, r.current, r.previous ?? '',
        r.potentialCauses.join('; '), r.recommendedAction,
      ]),
    },
    {
      title: 'Recommendations',
      headers: ['Priority', 'Action', 'Detail'],
      rows: report.recommendations.map((r) => [r.priority.toUpperCase(), r.title, r.detail]),
    },
    {
      title: 'Executive Summary',
      headers: ['Point'],
      rows: report.executiveSummary.map((s) => [s]),
    },
    {
      title: 'Product Intelligence Notes',
      headers: ['Note'],
      rows: report.productIntelligence.map((s) => [s]),
    },
  ];

  const exportFilename = `operations-report-${period.year}-${String(period.month).padStart(2, '0')}${period.week ? `-w${period.week}` : ''}`;
  const exportTitle = `Operations Report — ${period.displayLabel} (${period.dateRangeLabel})`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Report"
        description={`${period.displayLabel} · ${period.dateRangeLabel} — user activity, product performance, reliability, and risk.`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={STATUS_STYLE[report.platformStatus]}>
              {statusLabel(report.platformStatus)}
            </Badge>
            <ReportExport filename={exportFilename} title={exportTitle} sections={exportSections} />
          </div>
        }
      />

      {isUsingMockData ? (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
              <div className="font-medium text-amber-900 dark:text-amber-100">Live analytics data unavailable</div>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                Restore the analytics connection before relying on these metrics for management decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Period Navigator ─────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        {/* Month navigation row */}
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={nav.prevMonthHref}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {nav.prevMonthName}
          </Link>
          <span className="text-sm font-semibold">{monthName(month)} {year}</span>
          {nav.nextMonthHref ? (
            <Link
              href={nav.nextMonthHref}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {nav.nextMonthName}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground/40 cursor-not-allowed">
              {nav.nextMonthName}
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {/* Week / Monthly tabs */}
        <div className="flex gap-1.5">
          {([1, 2, 3, 4] as WeekNumber[]).map((w) => {
            const isActive = !isMonthlyView && week === w;
            const isCurrentWeek = nav.isCurrentMonth && nowWeek === w;
            const rangeLabel = weekRangeLabel(year, month, w);
            const [wStart] = calendarWeekBounds(year, month, w);
            const isFuture = wStart > now;
            return (
              <Link
                key={w}
                href={isFuture ? '#' : nav.currentWeekHref(w)}
                aria-disabled={isFuture}
                className={`flex-1 rounded-md border px-2 py-2 text-center transition-colors ${
                  isFuture
                    ? 'cursor-not-allowed opacity-40'
                    : isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-xs font-semibold">
                  W{w}
                  {isCurrentWeek && !isFuture && (
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary-foreground' : 'bg-primary'}`} />
                  )}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight opacity-80">{rangeLabel}</div>
              </Link>
            );
          })}
          <Link
            href={`/dashboard/insights?y=${year}&m=${month}&w=month`}
            className={`flex-1 rounded-md border px-2 py-2 text-center transition-colors ${
              isMonthlyView
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="text-xs font-semibold">Monthly</div>
            <div className="mt-0.5 text-[10px] leading-tight opacity-80">
              {monthShort(month)} 1–{lastDayOfMonth(year, month)}
            </div>
          </Link>
        </div>

        {/* Comparison note */}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Comparing <span className="font-medium text-foreground">{report.week.startDate}</span> – <span className="font-medium text-foreground">{report.week.endDate}</span>
          {' '}with <span className="text-foreground">{report.week.previousStartDate} – {report.week.previousEndDate}</span>
        </p>
      </div>

      {/* ── Summary card ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              {period.periodLabel} Operations Summary
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {period.displayLabel}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{period.dateRangeLabel}</p>
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

      {/* ── KPI band ─────────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active users" value={fmt.format(report.engagement.activeUsers.value)} icon={Users}
          trend={{ direction: trendDirection(report.engagement.activeUsers), label: deltaLabel(report.engagement.activeUsers) }} />
        <KpiCard label="Sessions" value={fmt.format(report.engagement.sessions.value)} icon={LineChart}
          trend={{ direction: trendDirection(report.engagement.sessions), label: deltaLabel(report.engagement.sessions) }} />
        <KpiCard label="Successful logins" value={fmt.format(report.engagement.logins.value)} icon={ShieldAlert}
          trend={{ direction: trendDirection(report.engagement.logins), label: deltaLabel(report.engagement.logins) }} />
        <KpiCard label="Open incidents" value={fmt.format(report.incidents.open)} icon={AlertTriangle}
          trend={{ direction: report.incidents.critical > 0 ? 'up' : 'flat', label: `${fmt.format(report.incidents.critical)} critical` }}
          invertTrend />
      </section>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Lightbulb className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">No data for this period</div>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              The report will populate automatically once connected products send events, sessions, and logins during this calendar period.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ── User Intelligence ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            User Intelligence — most productive staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topUsers.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No user activity recorded this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">User</th>
                    <th className="px-2 py-2 text-right font-medium">Actions</th>
                    <th className="px-2 py-2 text-right font-medium">Sessions</th>
                    <th className="px-2 py-2 text-right font-medium">Products</th>
                    <th className="px-2 py-2 text-right font-medium">Productivity</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map(({ u, prod }, i) => (
                    <tr key={u.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/people/${u.userId}`} className="font-medium hover:underline">
                          {i === 0 ? '🏆 ' : ''}{u.displayName ?? u.email ?? u.userId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(u.totalEvents)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(u.totalSessions)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt.format(u.appsUsed)}</td>
                      <td className={`px-2 py-2 text-right font-semibold tabular-nums ${scoreTone(prod)}`}>{prod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Product Performance + Intelligence ───────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
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
              Product Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {report.productIntelligence.length ? report.productIntelligence.map((item) => (
                <li key={item} className="rounded-md bg-muted/35 p-3 text-muted-foreground">{item}</li>
              )) : (
                <li className="rounded-md border border-dashed p-3 text-muted-foreground">No product movement detected yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* ── Engagement + Scorecard ────────────────────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              User Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricTile label="Avg sessions / user" value={report.engagement.avgSessionsPerUser.toFixed(1)} />
              <MetricTile label="Avg logins / user" value={report.engagement.avgLoginsPerUser.toFixed(1)} />
              <MetricTile label="Returning users" value={fmt.format(report.engagement.returningUsers)} />
              <MetricTile label="New users" value={fmt.format(report.engagement.newUsers)} />
            </div>
            <div className="rounded-md bg-muted/35 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Engagement trend</div>
              <div className="mt-1 font-medium">{report.engagement.trend}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
              {period.periodLabel} Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreLine label="Platform Health" value={report.scorecard.platformHealth} />
            <ScoreLine label="Engagement" value={report.scorecard.engagement} />
            <ScoreLine label="Reliability" value={report.scorecard.reliability} />
            <ScoreLine label="Adoption" value={report.scorecard.adoption} />
            <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
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

      {/* ── Risk Intelligence ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            Operational Risk Intelligence
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
                    {fmt.format(risk.current)} detected this period{risk.previous !== null ? `; previous: ${fmt.format(risk.previous)}.` : '.'}
                  </p>
                </div>
                <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No material operational risks detected this period.</div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
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

