'use client';

import { CalendarRange } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useFilters } from '@/hooks/useFilters';
import { filtersForPath } from '@/lib/page-filters';
import { RANGE_OPTIONS, DEFAULT_RANGE } from '@/lib/range';

/**
 * Global date-range picker. Writes ?range= (plus ?start=&end= for the custom
 * range) into the URL via useFilters so the selection is deep-linkable, survives
 * navigation, and is readable by server components through searchParams. Pages
 * that honor the range read it and resolve concrete bounds via rangeToBounds().
 */
export function RangePicker() {
  const { range, start, end, setFilters } = useFilters();
  const pathname = usePathname();
  const current = range ?? DEFAULT_RANGE;

  if (!filtersForPath(pathname).range) return null;

  const selectCls =
    'bg-transparent text-xs font-medium text-foreground outline-none [&>option]:bg-popover [&>option]:text-popover-foreground';
  const dateCls =
    'rounded-md border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary/50 [color-scheme:light] dark:[color-scheme:dark]';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 transition-colors hover:bg-accent/40">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          aria-label="Date range"
          value={current}
          onChange={(e) => setFilters({ range: e.target.value })}
          className={selectCls}
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {current === 'custom' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="date"
            aria-label="Start date"
            value={start ?? ''}
            max={end ?? undefined}
            onChange={(e) => setFilters({ range: 'custom', start: e.target.value || null })}
            className={dateCls}
          />
          <span>→</span>
          <input
            type="date"
            aria-label="End date"
            value={end ?? ''}
            min={start ?? undefined}
            onChange={(e) => setFilters({ range: 'custom', end: e.target.value || null })}
            className={dateCls}
          />
        </div>
      )}
    </div>
  );
}
