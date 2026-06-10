import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from '@/components/charts/Sparkline';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  sparkline?: ReadonlyArray<{ value: number }>;
  sparklineColor?: string;
  invertTrend?: boolean; // when up = bad (e.g. error rate)
  /** When set, the whole card becomes a link to this route (drill-down). */
  href?: string;
  /** Override the auto-assigned accent. Defaults to a stable color from the label. */
  accent?: 'indigo' | 'emerald' | 'violet' | 'amber';
}

// House palette — every KPI card gets a colored icon chip + top accent bar so
// the dashboards read as a rich, multi-color system instead of monochrome. The
// color is derived deterministically from the label, so a given metric always
// keeps the same hue across renders/pages.
const ACCENTS = {
  indigo:  { chipBg: 'bg-indigo-500/10',  chipFg: 'text-indigo-600 dark:text-indigo-400',   bar: 'bg-indigo-500'  },
  emerald: { chipBg: 'bg-emerald-500/10', chipFg: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  violet:  { chipBg: 'bg-violet-500/10',  chipFg: 'text-violet-600 dark:text-violet-400',   bar: 'bg-violet-500'  },
  amber:   { chipBg: 'bg-amber-500/10',   chipFg: 'text-amber-600 dark:text-amber-400',     bar: 'bg-amber-500'  },
} as const;
const ACCENT_ORDER = ['indigo', 'emerald', 'violet', 'amber'] as const;

function accentFromLabel(label: string): keyof typeof ACCENTS {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return ACCENT_ORDER[h % ACCENT_ORDER.length]!;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  sparkline,
  sparklineColor,
  invertTrend,
  href,
  accent,
}: KpiCardProps) {
  const tone = ACCENTS[accent ?? accentFromLabel(label)];
  const trendColor =
    !trend || trend.direction === 'flat'
      ? 'text-muted-foreground'
      : (trend.direction === 'up') === !invertTrend
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

  const card = (
    <Card
      className={cn(
        'relative h-full overflow-hidden transition-shadow hover:shadow-md',
        href && 'group cursor-pointer hover:border-primary/40',
      )}
    >
      {/* Top accent bar — distributes the house palette across every KPI band. */}
      <div className={cn('absolute inset-x-0 top-0 h-1', tone.bar)} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-5">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {Icon ? (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone.chipBg)}>
            <Icon className={cn('h-4 w-4', tone.chipFg)} />
          </span>
        ) : href ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {trend ? (
          <div className={cn('flex items-center gap-1 text-xs', trendColor)}>
            {trend.direction === 'up' ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : trend.direction === 'down' ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : null}
            <span>{trend.label}</span>
          </div>
        ) : null}
        {sparkline && sparkline.length > 0 ? (
          <div className="-mx-1">
            {sparklineColor ? (
              <Sparkline data={sparkline} color={sparklineColor} />
            ) : (
              <Sparkline data={sparkline} />
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
        {card}
      </Link>
    );
  }
  return card;
}
