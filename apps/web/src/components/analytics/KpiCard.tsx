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
}: KpiCardProps) {
  const trendColor =
    !trend || trend.direction === 'flat'
      ? 'text-muted-foreground'
      : (trend.direction === 'up') === !invertTrend
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

  const card = (
    <Card
      className={cn(
        'h-full overflow-hidden transition-shadow hover:shadow-md',
        href && 'group cursor-pointer hover:border-primary/40',
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {href ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : Icon ? (
          <Icon className="h-4 w-4 text-muted-foreground" />
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
