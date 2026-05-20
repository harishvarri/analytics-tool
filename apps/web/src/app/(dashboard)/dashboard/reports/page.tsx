import { Calendar, FileText, Plus, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/analytics/PageHeader';

export const dynamic = 'force-dynamic';

interface ReportSummary {
  id: string;
  name: string;
  description: string;
  schedule: string | null;
  shared: boolean;
  lastRun: string;
}

// Placeholder until the reports table has data. Phase 5 ships the UI shell;
// the live list lands when scheduled reports begin executing in Phase 8.
const SAMPLE_REPORTS: ReportSummary[] = [
  {
    id: 'r-1',
    name: 'Weekly Engagement Digest',
    description: 'Active users, sessions, and top features per portal.',
    schedule: 'Mondays · 09:00 IST',
    shared: true,
    lastRun: '2 days ago',
  },
  {
    id: 'r-2',
    name: 'Error Rate Monitor',
    description: 'Per-portal error rates with paging if > 1% sustained.',
    schedule: 'Every 15 min',
    shared: true,
    lastRun: '12 min ago',
  },
  {
    id: 'r-3',
    name: 'Onboarding Funnel — Training',
    description: 'Drop-off across the first three lessons.',
    schedule: null,
    shared: false,
    lastRun: 'On demand',
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Saved analytics views, scheduled deliveries, and shared dashboards."
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" /> New report
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_REPORTS.map((r) => (
          <Card key={r.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                {r.shared ? (
                  <Badge variant="outline" className="text-xs">
                    <Share2 className="mr-1 h-3 w-3" /> shared
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="mt-3 text-base">{r.name}</CardTitle>
              <CardDescription className="text-sm">{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{r.schedule ?? 'On demand'}</span>
              </div>
              <div className="mt-1">Last run · {r.lastRun}</div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm" variant="outline" className="flex-1">Open</Button>
              <Button size="sm" variant="ghost" className="flex-1">Run now</Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );
}
