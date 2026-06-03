/**
 * Staff activity risk — a manager-facing traffic-light for "is this person
 * still working in our products?". Shared by the Staff Directory, user profile,
 * department intelligence, and engagement pages so the signal is consistent.
 *
 *   green  — active today / very recently
 *   yellow — no activity for 7+ days
 *   red    — no activity for 30+ days (effectively dormant)
 */

export type RiskLevel = 'green' | 'yellow' | 'red';

export interface RiskMeta {
  level: RiskLevel;
  label: string;
  dot: string;   // tailwind bg- class
  tone: string;  // tailwind text/border classes for badges
}

const META: Record<RiskLevel, RiskMeta> = {
  green:  { level: 'green',  label: 'Active',         dot: 'bg-emerald-500', tone: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  yellow: { level: 'yellow', label: 'Quiet 7d+',      dot: 'bg-amber-500',   tone: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  red:    { level: 'red',    label: 'Inactive 30d+',  dot: 'bg-rose-500',    tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400' },
};

/** Days since a user was last active, or null if never. */
export function daysSince(lastActiveAt: string | null | undefined): number | null {
  if (!lastActiveAt) return null;
  const ms = Date.now() - new Date(lastActiveAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

/** Risk level from a last-active timestamp. Never-active → red. */
export function riskFromLastActive(lastActiveAt: string | null | undefined): RiskMeta {
  const d = daysSince(lastActiveAt);
  if (d === null || d >= 30) return META.red;
  if (d >= 7) return META.yellow;
  return META.green;
}

/** Risk level directly from a known days-inactive number. */
export function riskFromDays(days: number | null | undefined): RiskMeta {
  if (days === null || days === undefined || days >= 30) return META.red;
  if (days >= 7) return META.yellow;
  return META.green;
}

export const RISK_META = META;
