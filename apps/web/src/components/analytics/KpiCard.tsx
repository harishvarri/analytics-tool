import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from '@/components/charts/Sparkline';
import { cn } from '@/lib/utils';
import { ACCENT_BAR, ACCENT_CHIP, ACCENT_TEXT, accentFromLabel, type AccentKey } from '@/lib/accent';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  sparkline?: ReadonlyArray<{ value: number }>;
  sparklineColor?: string;
  invertTrend?: boolean; // when up = bad (e.g. error rate)
  /** When set, the whole card becomes a link to this route (drill-down). */
  href?: string;
  /** Override the auto-assigned accent. Defaults to a stable color from the label. */
  accent?: AccentKey;
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
  // Every KPI gets a colored icon chip + top accent bar so metric bands read as
  // a rich, multi-color system. Hue is stable per label across renders/pages.
  const key = accent ?? accentFromLabel(label);
  const tone = { chipBg: ACCENT_CHIP[key], chipFg: ACCENT_TEXT[key], bar: ACCENT_BAR[key] };
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
