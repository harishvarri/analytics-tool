import { Network } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { PortalsBarChart } from '@/components/charts/PortalsBarChart';
import { CHART_COLORS } from '@/components/charts/ChartTheme';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { PortalStatRow } from '@/components/analytics/PortalStatRow';
import { getPortalConfig } from '@/config/portals';
import { fetchPortalSummaries } from '@/lib/data/fetchers';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ app?: string }>;
}

export default async function PortalsAnalyticsPage({ searchParams }: PageProps) {
  const { app: selectedApp } = await searchParams;
  const allSummaries = await fetchPortalSummaries();
  // BUG-012: scope to selected app when filter is active
  const summaries = selectedApp ? allSummaries.filter((s) => s.portalId === selectedApp) : allSummaries;
  const chartData = summaries.map((s) => ({
    name: getPortalConfig(s.portalId).name.replace(' Portal', ''),
    Events: s.events24h,
    Users: s.users24h,
  }));

  const productsConnected = summaries.length;
  const productsActiveToday = summaries.filter((s) => s.users24h > 0).length;
  const mostActivePortal = summaries.length > 0
    ? getPortalConfig([...summaries].sort((a, b) => b.events24h - a.events24h)[0]!.portalId).name
    : '—';

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title="All Products"
        description="Which products are being used, by how many staff, and how active is each one?"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Products connected" value={String(productsConnected)} icon={Network} trend={{ direction: 'flat', label: 'in the registry' }} />
        <KpiCard label="Products active today" value={String(productsActiveToday)} icon={Network} trend={{ direction: 'flat', label: 'with staff activity' }} />
        <KpiCard label="Most active product" value={mostActivePortal} icon={Network} trend={{ direction: 'flat', label: 'by actions today' }} />
      </section>

      <ChartCard
        title="Product activity today"
        description="How much your staff used each product in the last 24 hours"
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
          All Products
        </h2>
        {summaries.map((s) => (
          <PortalStatRow key={s.portalId} summary={s} />
        ))}
      </section>
    </div>
  );
}
