'use client';

import { Boxes } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useFilters } from '@/hooks/useFilters';
import { filtersForPath } from '@/lib/page-filters';
import type { ApplicationOption } from '@/lib/repositories/workspace';

interface Props {
  applications: ApplicationOption[];
}

/**
 * Topbar Application/Product scope filter. Writes ?app=<slug> into the URL via
 * useFilters so the chosen scope flows into every downstream dashboard via
 * server-readable searchParams.
 *
 * Self-hides on pages that don't support the app filter (see lib/page-filters)
 * so we never show a control that does nothing. The legacy "Project" sub-filter
 * was removed — it was wired to nothing and only rendered "No projects yet".
 */
export function WorkspaceFilter({ applications }: Props) {
  const { app, setFilters } = useFilters();
  const pathname = usePathname();

  if (!filtersForPath(pathname).app) return null;

  return (
    <div className="hidden items-center gap-2 md:flex">
      <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 transition-colors hover:bg-accent/40">
        <span className="text-muted-foreground"><Boxes className="h-3.5 w-3.5" /></span>
        <select
          aria-label="Application filter"
          value={app ?? ''}
          onChange={(e) => setFilters({ app: e.target.value || null })}
          className="bg-transparent text-xs font-medium outline-none"
        >
          <option value="">All products</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
