/**
 * Global date-range options for the dashboard time-range picker.
 *
 * Stored in the URL as ?range=30d (plus ?start=&end= for custom) so it is
 * deep-linkable, survives navigation, and is readable by both server components
 * (via searchParams) and client components (via useSearchParams / useFilters).
 *
 * Two presets are *calendar-anchored* (yesterday, last_month) and need an
 * explicit upper bound — so the canonical resolver is `rangeToBounds`, which
 * returns { since, until }. `rangeToDays` (window span) is derived from it for
 * the older rolling-window fetchers.
 */

export const RANGE_OPTIONS = [
  { value: 'today',      label: 'Today' },
  { value: 'yesterday',  label: 'Yesterday' },
  { value: '7d',         label: 'Last 7 days' },
  { value: '30d',        label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom',     label: 'Custom range' },
] as const;

export type RangeValue = (typeof RANGE_OPTIONS)[number]['value'];

export const DEFAULT_RANGE: RangeValue = '30d';

const DAY = 86_400_000;

export interface RangeBounds {
  since: string;        // inclusive lower bound (ISO)
  until: string | null; // exclusive upper bound (ISO), null = "up to now"
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Resolve a range value (+ optional custom start/end "YYYY-MM-DD") into concrete
 * { since, until } bounds. This is the source of truth — fetchers that support
 * an upper bound should use this; rolling-window fetchers can use rangeToDays.
 */
export function rangeToBounds(range?: string | null, start?: string | null, end?: string | null): RangeBounds {
  const now = new Date();
  const sod = startOfDay(now);

  switch (range) {
    case 'today':
      return { since: sod.toISOString(), until: null };
    case 'yesterday':
      return { since: new Date(sod.getTime() - DAY).toISOString(), until: sod.toISOString() };
    case '7d':
      return { since: new Date(now.getTime() - 7 * DAY).toISOString(), until: null };
    case 'this_month':
      return { since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), until: null };
    case 'last_month': {
      const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { since: firstLast.toISOString(), until: firstThis.toISOString() };
    }
    case 'custom': {
      if (start) {
        const s = startOfDay(new Date(start));
        // end is inclusive of the chosen day → exclusive bound is next midnight
        const u = end ? new Date(startOfDay(new Date(end)).getTime() + DAY) : null;
        if (!Number.isNaN(s.getTime())) return { since: s.toISOString(), until: u && !Number.isNaN(u.getTime()) ? u.toISOString() : null };
      }
      // fall through to default when custom dates are missing/invalid
      return { since: new Date(now.getTime() - 30 * DAY).toISOString(), until: null };
    }
    case '30d':
    default:
      return { since: new Date(now.getTime() - 30 * DAY).toISOString(), until: null };
  }
}

/** Window span in whole days (for rolling-window SQL that uses `now - n days`). */
export function rangeToDays(range?: string | null, start?: string | null, end?: string | null): number {
  const { since, until } = rangeToBounds(range, start, end);
  const hi = until ? new Date(until).getTime() : Date.now();
  return Math.max(1, Math.round((hi - new Date(since).getTime()) / DAY));
}

/** Window span in hours (for hourly time-series fetchers). */
export function rangeToHours(range?: string | null, start?: string | null, end?: string | null): number {
  return rangeToDays(range, start, end) * 24;
}

/** Human label for a range value. */
export function rangeLabel(range?: string | null): string {
  return RANGE_OPTIONS.find((o) => o.value === range)?.label
    ?? RANGE_OPTIONS.find((o) => o.value === DEFAULT_RANGE)!.label;
}

/** Normalize an arbitrary string into a valid RangeValue (fallback to default). */
export function normalizeRange(range?: string | null): RangeValue {
  return (RANGE_OPTIONS.find((o) => o.value === range)?.value ?? DEFAULT_RANGE) as RangeValue;
}
