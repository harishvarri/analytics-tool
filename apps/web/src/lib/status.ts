/**
 * Canonical status vocabulary for the whole platform.
 *
 * Before this, every page hand-rolled emerald/amber/rose classes for
 * "healthy / warning / critical". That drifted (different greens, different
 * dark-mode handling) and made the status convention impossible to change in
 * one place. `statusStyle()` is now the single source of truth — use it (or the
 * <StatusBadge> built on top of it) everywhere a health/severity colour appears.
 */

export type Status = 'healthy' | 'warning' | 'critical' | 'info' | 'neutral';

export interface StatusStyle {
  /** Human label, e.g. "Healthy". */
  label: string;
  /** bg-* class for a solid status dot. */
  dot: string;
  /** Full badge classes (border + text), for outline-style badges. */
  badge: string;
  /** text-* class only. */
  text: string;
  /** Tinted surface (bg + border), for callout strips. */
  surface: string;
}

const STYLES: Record<Status, StatusStyle> = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    surface: 'border-emerald-500/30 bg-emerald-500/5',
  },
  warning: {
    label: 'Warning',
    dot: 'bg-amber-500',
    badge: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    surface: 'border-amber-500/30 bg-amber-500/5',
  },
  critical: {
    label: 'Critical',
    dot: 'bg-rose-500',
    badge: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    surface: 'border-rose-500/30 bg-rose-500/5',
  },
  info: {
    label: 'Info',
    dot: 'bg-sky-500',
    badge: 'border-sky-500/40 text-sky-600 dark:text-sky-400',
    text: 'text-sky-600 dark:text-sky-400',
    surface: 'border-sky-500/30 bg-sky-500/5',
  },
  neutral: {
    label: 'Neutral',
    dot: 'bg-muted-foreground/50',
    badge: 'border-border text-muted-foreground',
    text: 'text-muted-foreground',
    surface: 'border-border bg-muted/30',
  },
};

export function statusStyle(status: Status): StatusStyle {
  return STYLES[status] ?? STYLES.neutral;
}

/** Map a 0–100 health score to a status. */
export function statusFromScore(score: number): Status {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  return 'critical';
}

/** Map common string tiers (healthy/warning/critical/at_risk/...) to a Status. */
export function statusFromTier(tier: string | null | undefined): Status {
  switch ((tier ?? '').toLowerCase()) {
    case 'healthy':
    case 'good':
    case 'ok':
      return 'healthy';
    case 'warning':
    case 'at_risk':
    case 'degraded':
      return 'warning';
    case 'critical':
    case 'down':
    case 'failing':
      return 'critical';
    default:
      return 'neutral';
  }
}
