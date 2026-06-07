import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Activity, AlertTriangle, Gauge, HeartPulse, ShieldCheck, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { fetchProjectIntelligenceBySlug, fetchProjectRecentActivity, fetchAppUsers, fetchIssueStatuses } from '@/lib/data/fetchers';
import { issueKey, ACTIVE_ISSUE_STATUSES, type IssueStatus } from '@/lib/repositories/issues';
import { IssueStatusControl } from './IssueStatusControl';
import { isOperationalEvent } from '@/lib/importance';
import { aggregateActivity } from '@/features/realtime-feed/aggregate';
import { formatRelativeTime } from '@/lib/utils';
import type { ProjectStatus, RiskLevel } from '@/lib/repositories/projectIntelligence';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-US');

interface PageProps {
  params: Promise<{ slug: string }>;
}

const STATUS_META: Record<ProjectStatus, { label: string; tone: string }> = {
  healthy:  { label: 'Healthy',  tone: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  warning:  { label: 'Warning',  tone: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400' },
};
const RISK_META: Record<RiskLevel, { label: string; tone: string }> = {
  low:    { label: 'Low risk',    tone: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  medium: { label: 'Medium risk', tone: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  high:   { label: 'High risk',   tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400' },
};

function scoreTone(s: number): string {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function ProjectIntelligencePage({ params }: PageProps) {
  const { slug } = await params;
  const [p, rawActivity, staff] = await Promise.all([
    fetchProjectIntelligenceBySlug(slug),
    fetchProjectRecentActivity(slug, 150),
    fetchAppUsers(slug, 50),
  ]);

  if (!p) notFound();

  const recent = aggregateActivity(rawActivity.filter((a) => isOperationalEvent(a.category, a.eventName))).slice(0, 15);
  const status = STATUS_META[p.status];
  const risk = RISK_META[p.riskLevel];

  // Attach lifecycle status to each derived issue; hide resolved/closed from active.
  const issueItems = p.issues.map((text) => ({ text, key: issueKey(p.slug, text) }));
  const issueStatusMap = await fetchIssueStatuses(issueItems.map((i) => i.key));
  const issuesWithStatus = issueItems.map((i) => ({ ...i, status: (issueStatusMap.get(i.key)?.status ?? 'open') as IssueStatus }));
  const activeIssues = issuesWithStatus.filter((i) => ACTIVE_ISSUE_STATUSES.has(i.status));
  const resolvedIssues = issuesWithStatus.filter((i) => !ACTIVE_ISSUE_STATUSES.has(i.status));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/portals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All products
      </Link>

      <PageHeader
        title={p.name}
        description={p.description || `${p.projectType} · ${p.environment}${p.teamOwner ? ` · ${p.teamOwner}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
            <Badge variant="outline" className={risk.tone}>{risk.label}</Badge>
          </div>
        }
      />

      {/* Usage */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active users (7d)" value={fmt.format(p.activeUsers7d)} icon={Users}
          trend={{ direction: 'flat', label: `${fmt.format(p.activeUsersToday)} today` }} />
        <KpiCard label="Sessions (7d)" value={fmt.format(p.sessions7d)} icon={Zap}
          trend={{ direction: 'flat', label: 'work sessions' }} />
        <KpiCard label="Usage / engagement" value={String(p.adoptionNorm)} icon={Activity}
          trend={{ direction: 'flat', label: `${fmt.format(p.activeUsers7d)} active users (7d)` }} />
        <KpiCard label="Business activity (7d)" value={fmt.format(p.businessEvents7d)} icon={Activity}
          trend={{ direction: 'flat', label: 'operational actions — view analytics' }}
          href={`/dashboard/projects/${p.slug}/activity`} />
      </section>

      {/* Health */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Health score" value={String(p.healthScore)} icon={HeartPulse}
          trend={{ direction: p.healthScore >= 75 ? 'flat' : 'down', label: status.label }} />
        <KpiCard label="Reliability" value={String(p.reliabilityNorm)} icon={ShieldCheck}
          trend={{ direction: 'flat', label: `${p.errorRatePct}% error rate` }} invertTrend />
        <KpiCard label="Performance" value={String(p.performanceNorm)} icon={Gauge}
          trend={{ direction: 'flat', label: p.p95LoadMs != null ? `${fmt.format(p.p95LoadMs)}ms p95` : 'no data' }} />
        <KpiCard label="Errors (30d)" value={fmt.format(p.errors30d)} icon={AlertTriangle}
          trend={{ direction: p.errors30d > 0 ? 'up' : 'flat', label: 'problems' }} invertTrend
          href={`/dashboard/reliability?app=${p.slug}`} />
      </section>

      {/* Why this health score — always explain a non-perfect score */}
      {p.healthReasons.length > 0 && (
        <ChartCard
          title={`Why health is ${p.healthScore}/100`}
          description={p.topHealthDriver ? `Biggest drag: ${p.topHealthDriver}` : 'What is pulling the score down'}
        >
          <ul className="space-y-2">
            {p.healthReasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span>{r}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {/* Issues + alerts */}
      {(p.issues.length > 0 || p.alerts.length > 0) && (
        <ChartCard title="What needs attention" description="Current issues and urgent alerts for this product">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Issues</div>
              {activeIssues.length === 0 ? (
                <div className="text-xs text-muted-foreground">No standing issues.</div>
              ) : (
                <ul className="space-y-2">
                  {activeIssues.map((i) => (
                    <li key={i.key} className="flex items-start justify-between gap-2 text-xs">
                      <span className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{i.text}</span>
                      <IssueStatusControl slug={p.slug} issueKey={i.key} current={i.status} />
                    </li>
                  ))}
                </ul>
              )}
              {resolvedIssues.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground">Resolved &amp; closed ({resolvedIssues.length})</summary>
                  <ul className="mt-2 space-y-2">
                    {resolvedIssues.map((i) => (
                      <li key={i.key} className="flex items-start justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="line-through">{i.text}</span>
                        <IssueStatusControl slug={p.slug} issueKey={i.key} current={i.status} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Critical alerts</div>
              {p.alerts.length === 0 ? (
                <div className="text-xs text-muted-foreground">No active alerts.</div>
              ) : (
                <ul className="space-y-1.5">
                  {p.alerts.map((a) => (
                    <li key={a} className="flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5" />{a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ChartCard>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {/* Recent operational activity */}
        <ChartCard title="Recent activity" description="Important actions in this product — newest first, repeats grouped">
          <ActivityFeed items={recent} empty="No recent operational activity." />
        </ChartCard>

        {/* Staff active in this project */}
        <ChartCard title="Staff using this product" description="People active here, by most recent">
          {staff.length === 0 ? (
            <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No staff activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Person</th>
                    <th className="px-2 py-2 text-left font-medium">Department</th>
                    <th className="px-2 py-2 text-right font-medium">Sessions</th>
                    <th className="px-2 py-2 text-right font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.slice(0, 20).map((u) => (
                    <tr key={u.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/people/${u.userId}`} className="font-medium hover:underline">
                          {u.displayName ?? u.email ?? u.userId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{u.department ?? '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt.format(u.totalSessions)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </section>

      <div className={`text-[11px] ${scoreTone(p.healthScore)}`}>
        Health {p.healthScore}/100 — usage {p.adoptionNorm}, reliability {p.reliabilityNorm}, performance {p.performanceNorm}, momentum {p.activityNorm}.
      </div>
    </div>
  );
}
