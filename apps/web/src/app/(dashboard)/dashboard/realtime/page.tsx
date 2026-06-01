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
    // Fetch everything (incl. debug) so the client-side "Important only" toggle
    // can filter without a server round-trip.
    fetchRecentActivity(60, undefined, 'debug'),
    fetchPortalSummaries(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Activity"
        description="A live stream of what your staff is doing across every product, right now."
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
              <div className="text-xs text-muted-foreground">staff active (24h)</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <RealtimeFeed initial={initial} />
    </div>
  );
}
