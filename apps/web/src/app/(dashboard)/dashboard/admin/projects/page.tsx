import { Boxes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { AddProjectForm } from '@/components/admin/AddProjectForm';
import { ProjectSnippetRow, type ProjectStatusInfo } from '@/components/admin/ProjectSnippetRow';
import { listProjectsRegistry, type Project } from '@/lib/repositories/projects';
import { fetchProjectIntelligence } from '@/lib/data/fetchers';

export const dynamic = 'force-dynamic';

function envTone(env: string): string {
  if (env === 'production') return 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400';
  if (env === 'staging')    return 'border-amber-500/40 text-amber-600 dark:text-amber-400';
  return 'border-sky-500/40 text-sky-600 dark:text-sky-400';
}

export default async function ManageProjectsPage() {
  let projects: Project[] = [];
  let loadError: string | null = null;
  const statusBySlug = new Map<string, ProjectStatusInfo>();
  try {
    projects = await listProjectsRegistry();
    const intel = await fetchProjectIntelligence();
    for (const p of intel) {
      statusBySlug.set(p.slug, {
        status: p.status, healthScore: p.healthScore,
        lastActivityAt: p.lastActivityAt, activeUsers7d: p.activeUsers7d,
      });
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load projects.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connected Products"
        description="Add a product, then follow its 2-step setup: paste the script (page views, clicks, sessions, and JS errors are captured automatically) and add one identify call for real names. Disconnect any product anytime — its history is kept."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            {projects.length} products connected
          </Badge>
        }
      />

      <AddProjectForm />

      <ChartCard
        title="All connected products"
        description="Click any product to see its integration snippet"
      >
        {loadError ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400">
            Could not load the registry: {loadError}.
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-[120px] flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Boxes className="h-5 w-5" />
            No products connected yet — add your first one above.
          </div>
        ) : (
          <div className="space-y-1">
            {projects.map((p) => (
              <ProjectSnippetRow key={p.slug} project={p} envToneClass={envTone(p.environment)} status={statusBySlug.get(p.slug) ?? null} />
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
