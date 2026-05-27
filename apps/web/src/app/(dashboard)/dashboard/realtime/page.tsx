import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/analytics/PageHeader';
import { PORTAL_COLOR } from '@/components/charts/ChartTheme';
import { getPortalConfig } from '@/config/portals';
import { fetchPortalSummaries, fetchRecentActivity } from '@/lib/data/fetchers';
import { RealtimeFeed } from '@/features/realtime-feed/components/RealtimeFeed';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-US');

export default async function RealtimePage() {
  // Server-render initial state for an instant first paint, then hand off
  // to the client-side Realtime subscription.
  const [initial, portals] = await Promise.all([
    fetchRecentActivity(40),
    fetchPortalSummaries(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Realtime Activity"
        description="Live event stream from every connected portal."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {portals.map((p) => (
          <Card key={p.portalId}>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {getPortalConfig(p.portalId).name.replace(' Portal', '')}
              </CardTitle>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PORTAL_COLOR[p.portalId] }}
              />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{fmt.format(p.users24h)}</div>
              <div className="text-xs text-muted-foreground">active users / 24h</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <RealtimeFeed initial={initial} />
    </div>
  );
}
