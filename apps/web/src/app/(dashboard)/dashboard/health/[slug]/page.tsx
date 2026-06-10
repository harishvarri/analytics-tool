import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ShieldCheck, TrendingUp, TrendingDown, Minus, Code2, Server,
  Database, KeyRound, Network, Lock, AlertOctagon, Target, MapPin, UserX, LineChart,
} from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { fetchReliabilityHealthBySlug, fetchHealthHistory } from '@/lib/data/fetchers';
import type { ErrorCategory } from '@/lib/repositories/errorIntelligence';
import type { CategoryImpact, HealthStatus } from '@/lib/repositories/reliabilityHealth';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${Number(d)}`;
}

const fmt = new Intl.NumberFormat('en-US');

const STATUS_META: Record<HealthStatus, { label: string; tone: string; bg: string }> = {
  healthy:  { label: 'Healthy',  tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  warning:  { label: 'Warning',  tone: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10' },
  critical: { label: 'Critical', tone: 'text-rose-600 dark:text-rose-400',        bg: 'bg-rose-500/10' },
};

function scoreTone(s: number): string {
  if (s >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

// The tracking script only auto-captures frontend/JS errors, so health is a
// frontend-reliability measure. Backend (API/DB/auth) errors are handled in-app
// and never reach the browser — we don't pretend to measure what we can't see.
const RELIABILITY_DOMAINS: { category: ErrorCategory; label: string; icon: typeof Code2 }[] = [
  { category: 'frontend', label: 'Frontend Reliability', icon: Code2 },
];

const CAT_ICON: Record<ErrorCategory, typeof Code2> = {
  frontend: Code2, api: Server, database: Database, authentication: KeyRound, authorization: Lock, network: Network,
};

export default async function HealthAnalysisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, history] = await Promise.all([
    fetchReliabilityHealthBySlug(slug),
    fetchHealthHistory(slug, 30),
  ]);
  if (!p) notFound();

  const trendData = history.map((h) => ({ label: shortDate(h.date), score: h.score }));

  const meta = STATUS_META[p.status];
  const byCat = new Map<ErrorCategory, CategoryImpact>(p.categories.map((c) => [c.category, c]));
  const activeIncidents = p.incidents.open + p.incidents.investigating;
  const TrendIcon = p.trend > 0 ? TrendingUp : p.trend < 0 ? TrendingDown : Minus;
  const trendTone = p.trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : p.trend < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/dashboard/health" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Project Health
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Health Analysis — reliability, error impact, and incidents (last 7 days).</p>
          </div>
          <div className={`rounded-xl ${meta.bg} px-5 py-3 text-center`}>
            <div className={`text-4xl font-bold tabular-nums ${scoreTone(p.score)}`}>{p.score}</div>
            <div className={`mt-0.5 text-xs font-semibold uppercase tracking-wide ${meta.tone}`}>{meta.label}</div>
            <div className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium ${trendTone}`}>
              <TrendIcon className="h-3 w-3" />{p.trend > 0 ? '+' : ''}{p.trend} vs last week ({p.prevScore})
            </div>
          </div>
        </div>
      </div>

      {/* Score explanation */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Why is health {p.score}?</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">{p.reason}</p>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Starting score</span>
            <span className="font-semibold tabular-nums">100</span>
          </div>
          {p.categories.map((c) => (
            <div key={c.category} className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">
                {c.label} ({c.errors} {c.errors === 1 ? 'error' : 'errors'})
                {c.penalty === 0 && c.acknowledged && <span className="ml-1 text-emerald-600 dark:text-emerald-400">· acknowledged</span>}
              </span>
              {c.penalty === 0
                ? <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">−0</span>
                : <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">−{c.penalty}</span>}
            </div>
          ))}
          {p.incidents.penalty > 0 && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Active incidents ({activeIncidents} open/investigating)</span>
              <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">−{p.incidents.penalty}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-1.5 text-[12px]">
            <span className="font-medium">Total impact</span>
            <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">−{p.totalPenalty}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium">Current health</span>
            <span className={`font-bold tabular-nums ${scoreTone(p.score)}`}>{p.score}</span>
          </div>
        </div>
      </section>

      {/* Health Evolution */}
      <ChartCard
        title="Health Evolution"
        description="Daily reliability score over the last 30 days"
      >
        {trendData.length >= 2 ? (
          <AreaChart
            data={trendData}
            xKey="label"
            series={[{ dataKey: 'score', label: 'Health', color: '#6366f1' }]}
            height={240}
          />
        ) : (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <LineChart className="h-6 w-6 text-muted-foreground/60" />
            <p>Building history — the evolution chart appears after a couple of daily snapshots.</p>
            <p className="text-[11px]">Today&apos;s score ({p.score}) has been recorded.</p>
          </div>
        )}
      </ChartCard>

      {/* User impact band */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Affected users', value: p.affectedUsers },
          { label: 'Affected sessions', value: p.affectedSessions },
          { label: 'Affected areas', value: p.affectedFeatures },
          { label: 'Active incidents', value: activeIncidents },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold tabular-nums">{fmt.format(m.value)}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </section>

      {/* Reliability — frontend/JS errors (what the tracking script captures) */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">Frontend Reliability</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Health reflects uncaught JavaScript errors &amp; promise rejections captured by the tracking script.
          Backend errors (API / database / auth) are handled inside each app and aren&apos;t observed here.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RELIABILITY_DOMAINS.map(({ category, label, icon: Icon }) => {
            const c = byCat.get(category);
            const rel = c ? c.reliability : 100;
            const errs = c ? c.errors : 0;
            return (
              <div key={category} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className={`text-xl font-bold tabular-nums ${scoreTone(rel)}`}>{rel}</span>
                </div>
                <div className="mt-2 text-[12px] font-medium">{label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{errs} {errs === 1 ? 'error' : 'errors'} · {c?.affectedUsers ?? 0} users</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${rel >= 90 ? 'bg-emerald-500' : rel >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${rel}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Error Impact table */}
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Error Impact</h2>
          <p className="text-[11px] text-muted-foreground">Every error category hitting this product, ranked by health impact.</p>
        </div>
        {p.categories.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" /> No errors in the last 7 days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Error type</th>
                  <th className="px-4 py-2 text-right font-medium">Frequency</th>
                  <th className="px-4 py-2 text-right font-medium">Affected users</th>
                  <th className="px-4 py-2 text-right font-medium">Affected sessions</th>
                  <th className="px-4 py-2 text-right font-medium">Health impact</th>
                </tr>
              </thead>
              <tbody>
                {p.categories.map((c) => {
                  const Icon = CAT_ICON[c.category];
                  return (
                    <tr key={c.category} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{c.label}</span>
                          {c.critical && <span className="rounded bg-rose-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-rose-600 dark:text-rose-400">Critical</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt.format(c.errors)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt.format(c.affectedUsers)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt.format(c.affectedSessions)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {c.penalty === 0
                          ? <span className="text-emerald-600 dark:text-emerald-400" title={c.acknowledged ? 'Acknowledged — incident resolved/closed' : 'No health impact'}>{c.acknowledged ? 'ack’d' : '−0'}</span>
                          : <span className="text-rose-600 dark:text-rose-400">−{c.penalty}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Incident Impact + Root Cause */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Incident impact */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><AlertOctagon className="h-4 w-4 text-rose-500" /> Incident Impact</h2>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Open', value: p.incidents.open, tone: 'text-rose-600 dark:text-rose-400' },
              { label: 'Investigating', value: p.incidents.investigating, tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Resolved', value: p.incidents.resolved, tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Closed', value: p.incidents.closed, tone: 'text-muted-foreground' },
            ].map((s) => (
              <div key={s.label} className="rounded-md border bg-muted/30 py-2">
                <div className={`text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {activeIncidents > 0
              ? `${activeIncidents} active incident${activeIncidents === 1 ? '' : 's'} cost this product −${p.incidents.penalty} health. `
              : 'No active incidents reducing health. '}
            Resolved and closed incidents never reduce the score.
          </p>
          <Link href="/dashboard/incidents" className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline">Open Incident Management →</Link>
        </div>

        {/* Root cause analysis */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Target className="h-4 w-4 text-indigo-500" /> Root Cause Analysis</h2>
          <ul className="mt-3 space-y-3 text-[12px]">
            <li className="flex items-start gap-2">
              <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              <div>
                <div className="font-medium">Most common error category</div>
                <div className="text-muted-foreground">{p.rootCause.topCategoryLabel ?? 'None — no errors detected'}</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <div>
                <div className="font-medium">Most impacted area</div>
                <div className="break-all text-muted-foreground">{p.rootCause.mostImpactedArea ?? 'No specific route identified'}</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <UserX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
              <div>
                <div className="font-medium">Most affected user</div>
                <div className="break-all text-muted-foreground">{p.rootCause.mostAffectedUser ?? 'No identified user impacted'}</div>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <div className="text-[11px] text-muted-foreground">
        Health is reliability-only: 100 − weighted error penalties − active incident penalties. Usage, engagement, and growth are tracked under their own intelligence modules.
      </div>
    </div>
  );
}
