'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import type { RealtimeActivityItem } from '@/types/analytics';
import { isOperationalEvent } from '@/lib/importance';
import { useRealtimeActivity } from '../use-realtime-activity';
import { aggregateActivity } from '../aggregate';
import { ConnectionPill } from './ConnectionPill';
import { LiveCounters } from './LiveCounters';

interface RealtimeFeedProps {
  initial: RealtimeActivityItem[];
  capacity?: number;
}

/**
 * Composite live-stream surface for /dashboard/realtime. Server-rendered
 * `initial` payload gives an instant first paint; the hook then keeps it
 * fresh via Supabase Realtime.
 */
export function RealtimeFeed({ initial, capacity = 60 }: RealtimeFeedProps) {
  // Pause the subscription when the tab is hidden — no point streaming into
  // a buffer no one is reading.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const onVis = () => setPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Default to the operational command-center view: only business-meaningful
  // activity (logins, errors, created/updated/completed, project access…),
  // aggregated so repeats collapse. "Everything" shows the raw stream.
  const [operationalOnly, setOperationalOnly] = useState(true);

  const { items, state, receivedCount } = useRealtimeActivity({ initial, capacity, paused });

  const visible = useMemo(() => {
    if (!operationalOnly) return items;
    const ops = items.filter((it) => isOperationalEvent(it.category, it.eventName));
    return aggregateActivity(ops);
  }, [items, operationalOnly]);

  const hiddenCount = items.length - items.filter((it) => isOperationalEvent(it.category, it.eventName)).length;

  return (
    <div className="space-y-4">
      <LiveCounters items={items} />
      <ChartCard
        title={operationalOnly ? 'Operational activity' : 'Live event stream'}
        description={
          operationalOnly
            ? 'What people are doing across every product right now — logins, operational actions, and problems. Repeats are grouped.'
            : 'Every raw event, newest first — streaming via Supabase Realtime.'
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOperationalOnly((v) => !v)}
              className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              title={operationalOnly ? `Hiding ${hiddenCount} low-signal events` : 'Showing every raw event'}
            >
              {operationalOnly ? 'Operational only' : 'Everything'}
            </button>
            <Badge variant="outline" className="font-mono tabular-nums">
              +{receivedCount}
            </Badge>
            <ConnectionPill state={state} />
          </div>
        }
      >
        <ActivityFeed
          items={visible}
          empty={
            operationalOnly
              ? 'No operational activity yet — logins, operational actions, and errors will appear here.'
              : 'Waiting for the first event…'
          }
        />
      </ChartCard>
    </div>
  );
}
