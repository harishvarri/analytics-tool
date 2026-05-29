import { Boxes, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { AddProjectForm } from '@/components/admin/AddProjectForm';
import { listProjectsRegistry, type Project } from '@/lib/repositories/projects';

export const dynamic = 'force-dynamic';

function maskKey(key: string): string {
  if (key.length <= 12) return '••••••';
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

function envTone(env: string): string {
  if (env === 'production') return 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400';
  if (env === 'staging')    return 'border-amber-500/40 text-amber-600 dark:text-amber-400';
  return 'border-sky-500/40 text-sky-600 dark:text-sky-400';
}

export default async function ManageProjectsPage() {
  let projects: Project[] = [];
  let loadError: string | null = null;
  try {
    projects = await listProjectsRegistry();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load projects.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Add a new app to start tracking it. You'll get a tracking snippet to paste in — no redeploy needed."
        actions={
          <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
            {projects.length} registered
          </Badge>
        }
      />

      <AddProjectForm />

      <ChartCard
        title="Your apps"
        description="Every app set up to send data to this dashboard"
      >
        {loadError ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400">
            Could not load the registry: {loadError}. Make sure migration 0017 has been run.
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-[120px] flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Boxes className="h-5 w-5" />
            No projects yet — add your first one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Project</th>
                  <th className="px-2 py-2 text-left font-medium">Slug</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th className="px-2 py-2 text-left font-medium">Env</th>
                  <th className="px-2 py-2 text-left font-medium">Owner</th>
                  <th className="px-2 py-2 text-left font-medium">Tracking</th>
                  <th className="px-2 py-2 text-left font-medium">API key</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.slug} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-[10px] text-muted-foreground">{p.description}</div>}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px]">{p.slug}</td>
                    <td className="px-2 py-2 capitalize">{p.projectType}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className={envTone(p.environment)}>{p.environment}</Badge>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{p.teamOwner ?? '—'}</td>
                    <td className="px-2 py-2">
                      {p.trackingEnabled
                        ? <span className="text-emerald-600 dark:text-emerald-400">● live</span>
                        : <span className="text-muted-foreground">○ paused</span>}
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        <KeyRound className="h-3 w-3" />{maskKey(p.apiKey)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
