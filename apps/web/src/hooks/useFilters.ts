'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Global URL-state filters. Mirrors how Datadog/Mixpanel store workspace
 * scope so that:
 *   - filter changes are deep-linkable and shareable
 *   - browser back/forward works naturally
 *   - server components can read the same value via searchParams
 *
 * Usage in a client component:
 *   const { app, project, setFilters } = useFilters();
 *   setFilters({ app: 'sentinel' });
 */
export interface AppFilters {
  app:     string | null;
  project: string | null;
  range:   string | null;
}

export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const app     = search.get('app');
  const project = search.get('project');
  const range   = search.get('range');

  const setFilters = useCallback(
    (patch: Partial<AppFilters>) => {
      const params = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      // Changing app should clear project (different namespace)
      if (patch.app !== undefined && patch.project === undefined) {
        params.delete('project');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, search],
  );

  return { app, project, range, setFilters };
}
