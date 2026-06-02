'use client';

import { CalendarRange } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useFilters } from '@/hooks/useFilters';
import { filtersForPath } from '@/lib/page-filters';
import { RANGE_OPTIONS, DEFAULT_RANGE } from '@/lib/range';

/**
 * Global date-range picker. Writes ?range= into the URL via useFilters so the
 * selection is deep-linkable, survives navigation, and is readable by server
 * components through searchParams. Pages that honor the range read it and pass
 * the resolved day/hour count to their fetchers.
 */
export function RangePicker() {
  const { range, setFilters } = useFilters();
  const pathname = usePathname();
  const current = range ?? DEFAULT_RANGE;

  if (!filtersForPath(pathname).range) return null;

  return (
    <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 transition-colors hover:bg-accent/40">
      <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        aria-label="Date range"
        value={current}
        onChange={(e) => setFilters({ range: e.target.value })}
        className="bg-transparent text-xs font-medium outline-none"
      >
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
