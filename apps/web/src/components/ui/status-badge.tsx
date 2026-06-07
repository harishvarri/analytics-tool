import { cn } from '@/lib/utils';
import { statusStyle, type Status } from '@/lib/status';

interface StatusBadgeProps {
  status: Status;
  /** Override the default label ("Healthy"/"Warning"/...). */
  label?: string;
  /** Hide the coloured dot. */
  hideDot?: boolean;
  /** Compact padding/size. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The one badge for health/severity status across the platform. Pulls colours
 * from statusStyle() so the emerald/amber/rose convention is defined once.
 */
export function StatusBadge({ status, label, hideDot, size = 'md', className }: StatusBadgeProps) {
  const s = statusStyle(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        s.badge,
        className,
      )}
    >
      {!hideDot && <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />}
      {label ?? s.label}
    </span>
  );
}
