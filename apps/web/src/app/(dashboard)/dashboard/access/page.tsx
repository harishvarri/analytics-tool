import { KeyRound, TrendingDown, Users } from 'lucide-react';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchProjectAccessVsUsage } from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

function adoptionTone(pct: number): string {
  if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600  dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function AccessVsUsagePage() {
  const rows = await fetchProjectAccessVsUsage();
  const withAccess = rows.filter((r) => r.usersWithAccess > 0);

  const totalNeverUsed = rows.reduce((s, r) => s + r.accessNeverUsed, 0);
  const avgAdoption =
    withAccess.length > 0
      ? Math.round((withAccess.reduce((s, r) => s + r.adoptionPct, 0) / withAccess.length) * 10) / 10
      : 0;
  const maxAccess = Math.max(1, ...rows.map((r) => r.usersWithAccess));
  const hasData = withAccess.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access vs Usage"
        description="Who is allowed to use each app vs who actually does — so you can spot unused access and low adoption."
        actions={
          <ExportButton
            filename="access-vs-usage"
            headers={['Application', 'Users with access', 'Actually used (30d)', 'Adoption %', 'Access never used']}
            rows={rows.map((r) => [r.projectName, r.usersWithAccess, r.adoptedUsers, r.adoptionPct, r.accessNeverUsed])}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Apps with access granted" value={String(withAccess.length)} icon={KeyRound}
          trend={{ direction: 'flat', label: `${rows.length} apps total` }} />
        <KpiCard label="Avg adoption of access" value={`${avgAdoption}%`} icon={Users}
          trend={{ direction: avgAdoption >= 50 ? 'flat' : 'down', label: 'Used ÷ allowed (30d)' }} />
        <KpiCard label="Access never used" value={totalNeverUsed.toLocaleString()} icon={TrendingDown}
          trend={{ direction: totalNeverUsed > 0 ? 'up' : 'flat', label: 'People with unused access' }} invertTrend />
      </section>

      {!hasData ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No access data yet</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            This view compares who is <strong>allowed</strong> to use each app against who actually does.
            It fills in once your central login system pushes the user directory (with each person&apos;s
            allowed projects) to <code className="rounded bg-muted px-1 text-[10px]">/api/v1/directory</code>.
          </p>
        </div>
      ) : (
        <ChartCard
          title="Adoption of access by application"
          description="For everyone allowed to use an app, how many actually used it in the last 30 days"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Application</th>
                  <th className="px-2 py-2 text-right font-medium">Has access</th>
                  <th className="px-2 py-2 text-right font-medium">Actually used</th>
                  <th className="px-2 py-2 text-right font-medium">Never used</th>
                  <th className="px-2 py-2 text-right font-medium">Adoption</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.projectSlug} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2 font-medium">{r.projectName}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.usersWithAccess / maxAccess) * 100}%` }} />
                        </div>
                        <span className="tabular-nums font-semibold">{r.usersWithAccess}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.adoptedUsers}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.accessNeverUsed}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-semibold ${adoptionTone(r.adoptionPct)}`}>{r.adoptionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">What this tells you</div>
        <ul className="ml-4 list-disc space-y-1">
          <li><strong>Low adoption</strong> = many people can use the app but don&apos;t — a training gap or an app that isn&apos;t pulling its weight.</li>
          <li><strong>Access never used</strong> = potential unused licences / permissions to clean up.</li>
          <li>Access comes from your central login directory; usage comes from real events.</li>
        </ul>
      </section>
    </div>
  );
}
