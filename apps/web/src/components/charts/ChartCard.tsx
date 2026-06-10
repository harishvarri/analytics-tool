import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ACCENT_BAR, accentFromLabel } from '@/lib/accent';

interface ChartCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, actions, children, className }: ChartCardProps) {
  // Small colored marker before the title, stable per-title — ties cards into
  // the house palette without shouting.
  const bar = ACCENT_BAR[accentFromLabel(title)];
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-2.5">
          <span className={cn('mt-1 h-4 w-1 shrink-0 rounded-full', bar)} aria-hidden />
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description ? <CardDescription className="mt-1 text-xs">{description}</CardDescription> : null}
          </div>
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
