import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ACCENT_BAR, accentFromLabel } from '@/lib/accent';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const bar = ACCENT_BAR[accentFromLabel(title)];
  return (
    <header className="flex flex-col items-start justify-between gap-3 border-b pb-4 md:flex-row md:items-end">
      <div className="flex items-stretch gap-3">
        <span className={cn('mt-0.5 w-1 shrink-0 rounded-full', bar)} aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
