import { Button } from '@/components/ui/button';
import { ChartCard } from '@/components/charts/ChartCard';
import { PortalsBarChart } from '@/components/charts/PortalsBarChart';
import { CHART_COLORS, PORTAL_COLOR } from '@/components/charts/ChartTheme';
import { PageHeader } from '@/components/analytics/PageHeader';
import { PortalStatRow } from '@/components/analytics/PortalStatRow';
import { getPortalConfig, PORTAL_LIST } from '@/config/portals';
import { fetchPortalSummaries } from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

export default async function PortalsAnalyticsPage() {
  const summaries = await fetchPortalSummaries();
  const chartData = summaries.map((s) => ({
    name: getPortalConfig(s.portalId).name.replace(' Portal', ''),
    Events: s.events24h,
    Users: s.users24h,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portals"
        description="Per-portal usage, performance, and error rates."
        actions={<Button variant="outline" size="sm">Configure portals</Button>}
      />

      <ChartCard
        title="Events & users by portal — last 24h"
        description="Compare engagement across every connected portal"
      >
        <PortalsBarChart
          data={chartData}
          xKey="name"
          series={[
            { dataKey: 'Events', label: 'Events', color: CHART_COLORS.primary },
            { dataKey: 'Users', label: 'Users', color: CHART_COLORS.emerald },
          ]}
          height={300}
        />
      </ChartCard>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          All Portals
        </h2>
        {summaries.map((s) => (
          <PortalStatRow key={s.portalId} summary={s} />
        ))}
      </section>

      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">Portal registry</div>
        <div className="flex flex-wrap gap-2">
          {PORTAL_LIST.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PORTAL_COLOR[p.id] }}
              />
              {p.id}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
