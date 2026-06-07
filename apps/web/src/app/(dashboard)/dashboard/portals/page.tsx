import { PageHeader } from '@/components/analytics/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewPanel } from '@/features/product-analytics/OverviewPanel';
import { AdoptionPanel } from '@/features/product-analytics/AdoptionPanel';
import { FeaturesPanel } from '@/features/product-analytics/FeaturesPanel';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ app?: string; tab?: string }>;
}

const TABS = ['overview', 'adoption', 'features'] as const;
type TabKey = (typeof TABS)[number];

/**
 * Product Analytics — the single home for product usage, adoption, and feature
 * activity. Consolidates the former Products Directory, Access Analytics, and
 * Feature Adoption pages into one tabbed surface (P2 consolidation).
 */
export default async function ProductAnalyticsPage({ searchParams }: PageProps) {
  const { app, tab } = await searchParams;
  const active: TabKey = (TABS as readonly string[]).includes(tab ?? '') ? (tab as TabKey) : 'overview';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Analytics"
        description="Usage, adoption, and feature activity for every connected product."
      />

      <Tabs defaultValue={active}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="adoption">Adoption</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel appId={app} />
        </TabsContent>
        <TabsContent value="adoption">
          <AdoptionPanel />
        </TabsContent>
        <TabsContent value="features">
          <FeaturesPanel appId={app} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
