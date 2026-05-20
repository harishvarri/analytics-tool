'use client';

import { useMemo } from 'react';
import { Boxes, Layers } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import type { ApplicationOption, ProjectOption } from '@/lib/repositories/workspace';

interface Props {
  applications: ApplicationOption[];
  projects:     ProjectOption[];
}

/**
 * Topbar workspace filter — two cascading selects (Application → Project).
 *
 * Mirrors enterprise analytics platforms (Datadog "Service", Mixpanel
 * "Project", PostHog "Project") where the chosen scope flows into every
 * downstream dashboard via URL state.
 */
export function WorkspaceFilter({ applications, projects }: Props) {
  const { app, project, setFilters } = useFilters();

  // If an app is selected, narrow the visible projects to that app's list.
  const visibleProjects = useMemo(
    () => (app ? projects.filter((p) => p.appId === app || p.appId === null) : projects),
    [app, projects],
  );

  return (
    <div className="hidden items-center gap-2 md:flex">
      <SelectShell icon={<Boxes className="h-3.5 w-3.5" />}>
        <select
          aria-label="Application filter"
          value={app ?? ''}
          onChange={(e) => setFilters({ app: e.target.value || null, project: null })}
          className="bg-transparent text-xs font-medium outline-none"
        >
          <option value="">All applications</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </SelectShell>

      <SelectShell icon={<Layers className="h-3.5 w-3.5" />}>
        <select
          aria-label="Project filter"
          value={project ?? ''}
          onChange={(e) => setFilters({ project: e.target.value || null })}
          className="max-w-[180px] truncate bg-transparent text-xs font-medium outline-none"
          disabled={visibleProjects.length === 0}
        >
          <option value="">
            {visibleProjects.length === 0 ? 'No projects yet' : 'All projects'}
          </option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </SelectShell>
    </div>
  );
}

function SelectShell({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 transition-colors hover:bg-accent/40">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}
