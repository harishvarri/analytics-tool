/**
 * House accent palette. Used to weave a consistent, multi-color look across the
 * app (KPI chips, card title bars, nav section markers…). A label maps to a
 * stable hue so the same metric/section always keeps the same color.
 */
export const ACCENT_ORDER = ['indigo', 'emerald', 'violet', 'amber'] as const;
export type AccentKey = (typeof ACCENT_ORDER)[number];

export const ACCENT_BAR: Record<AccentKey, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
};

export const ACCENT_TEXT: Record<AccentKey, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  violet: 'text-violet-600 dark:text-violet-400',
  amber: 'text-amber-600 dark:text-amber-400',
};

export const ACCENT_CHIP: Record<AccentKey, string> = {
  indigo: 'bg-indigo-500/10',
  emerald: 'bg-emerald-500/10',
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/10',
};

/** Deterministic hue from a label (same input → same color, every render). */
export function accentFromLabel(label: string): AccentKey {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return ACCENT_ORDER[h % ACCENT_ORDER.length]!;
}
