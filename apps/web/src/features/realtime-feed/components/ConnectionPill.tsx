'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConnectionState } from '../use-realtime-activity';

const STYLES: Record<ConnectionState, { label: string; dot: string; tone: string }> = {
  open: {
    label: 'Streaming',
    dot: 'bg-emerald-500 animate-pulse',
    tone: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  },
  connecting: {
    label: 'Connecting…',
    dot: 'bg-amber-500 animate-pulse',
    tone: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  },
  closed: {
    label: 'Offline',
    dot: 'bg-slate-400',
    tone: 'border-slate-400/40 text-muted-foreground',
  },
  error: {
    label: 'Connection error',
    dot: 'bg-rose-500',
    tone: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
  },
};

interface ConnectionPillProps {
  state: ConnectionState;
}

export function ConnectionPill({ state }: ConnectionPillProps) {
  const cfg = STYLES[state];
  return (
    <Badge variant="outline" className={cn('gap-1.5', cfg.tone)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </Badge>
  );
}
