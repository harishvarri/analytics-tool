'use client';

import { Activity, Users, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RealtimeActivityItem } from '@/types/analytics';
import { useLiveCounters } from '../use-live-counters';

const fmt = new Intl.NumberFormat('en-US');

export function LiveCounters({ items }: { items: RealtimeActivityItem[] }) {
  const c = useLiveCounters(items);
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Counter label="Active users" value={fmt.format(c.activeUsers)} icon={<Users className="h-3.5 w-3.5" />} />
      <Counter label="Active sessions" value={fmt.format(c.activeSessions)} icon={<Zap className="h-3.5 w-3.5" />} />
      <Counter label="Events / min" value={fmt.format(c.eventsPerMinute)} icon={<Activity className="h-3.5 w-3.5" />} pulse />
    </section>
  );
}

function Counter({
  label,
  value,
  icon,
  pulse,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <span className={pulse ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
