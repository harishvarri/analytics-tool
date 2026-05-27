/**
 * Global date-range options for the dashboard time-range picker.
 *
 * Stored in the URL as ?range=7d so it is deep-linkable, survives navigation,
 * and is readable by both server components (via searchParams) and client
 * components (via useSearchParams / useFilters).
 */

export const RANGE_OPTIONS = [
  { value: '24h', label: 'Last 24 hours', days: 1,  hours: 24 },
  { value: '7d',  label: 'Last 7 days',   days: 7,  hours: 168 },
  { value: '30d', label: 'Last 30 days',  days: 30, hours: 720 },
  { value: '90d', label: 'Last 90 days',  days: 90, hours: 2160 },
] as const;

export type RangeValue = (typeof RANGE_OPTIONS)[number]['value'];

export const DEFAULT_RANGE: RangeValue = '30d';

function resolve(range?: string | null) {
  return RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS.find((o) => o.value === DEFAULT_RANGE)!;
}

/** Map a ?range= value to a day count for SQL `make_interval(days => n)`. */
export function rangeToDays(range?: string | null): number {
  return resolve(range).days;
}

/** Map a ?range= value to an hour count (for hourly time-series fetchers). */
export function rangeToHours(range?: string | null): number {
  return resolve(range).hours;
}

/** Human label for a range value. */
export function rangeLabel(range?: string | null): string {
  return resolve(range).label;
}

/** Normalize an arbitrary string into a valid RangeValue (fallback to default). */
export function normalizeRange(range?: string | null): RangeValue {
  return resolve(range).value;
}
