import { GitBranch, Route, Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/analytics/KpiCard';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { JourneySankey } from '@/components/charts/JourneySankey';
import { fetchJourneyGraph } from '@/lib/data/fetchers';
import { rangeToDays, rangeLabel } from '@/lib/range';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function JourneysPage({ searchParams }: PageProps) {
  const { range } = await searchParams;
  const days = rangeToDays(range);
  const graph = await fetchJourneyGraph(days);

  const hasData = graph.nodes.length > 0 && graph.links.length > 0;
  const entryNodes = graph.nodes.filter((n) => n.step === 1).length;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={120_000} />
      <PageHeader
        title="User Journeys"
        description="The paths people take through your app — where they go next, and where they drop off."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            ● {rangeLabel(range)}
          </Badge>
        }
      />

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Flow transitions"
          value={graph.totalTransitions.toLocaleString()}
          icon={Workflow}
          trend={{ direction: 'flat', label: 'Step-to-step movements' }}
        />
        <KpiCard
          label="Entry points"
          value={String(entryNodes)}
          icon={Route}
          trend={{ direction: 'flat', label: 'Distinct first actions' }}
        />
        <KpiCard
          label="Flow nodes"
          value={String(graph.nodes.length)}
          icon={GitBranch}
          trend={{ direction: 'flat', label: 'Across all steps' }}
        />
      </section>

      {!hasData ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Route className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">Not enough session data to build a flow</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Journey flows are reconstructed from the ordered events within each session.
            As users navigate across multiple steps in a session, the Sankey diagram fills in.
            Try widening the date range.
          </p>
        </div>
      ) : (
        <ChartCard
          title="Most common paths (first 5 steps)"
          description="Each column is one step in a visit. Thicker bands mean more people took that path."
        >
          <JourneySankey nodes={graph.nodes} links={graph.links} height={460} />
        </ChartCard>
      )}

      {/* Method footer */}
      <section className="rounded-md border p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold uppercase tracking-wide">How the flow is built</div>
        <ol className="ml-4 list-decimal space-y-1">
          <li>The pages each visitor opens in a session are ordered by time (step 1, 2, 3…).</li>
          <li>Page names come from each page&apos;s address, so they match your app (e.g. /sprint-board → &quot;Sprint Board&quot;).</li>
          <li>Repeated views of the same page are collapsed, and the same page at different steps is a separate column — so the flow reads left-to-right with no loops.</li>
          <li>Only the most common paths per step are drawn to keep the diagram legible.</li>
        </ol>
      </section>
    </div>
  );
}
