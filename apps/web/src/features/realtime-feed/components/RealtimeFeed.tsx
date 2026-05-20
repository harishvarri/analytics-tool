'use client';

import { useEffect, useState } from 'react';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import type { RealtimeActivityItem } from '@/types/analytics';
import { useRealtimeActivity } from '../use-realtime-activity';
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

  const { items, state, receivedCount } = useRealtimeActivity({ initial, capacity, paused });

  return (
    <div className="space-y-4">
      <LiveCounters items={items} />
      <ChartCard
        title="Live event stream"
        description="Newest activity at the top — streaming via Supabase Realtime."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono tabular-nums">
              +{receivedCount}
            </Badge>
            <ConnectionPill state={state} />
          </div>
        }
      >
        <ActivityFeed items={items} empty="Waiting for the first event…" />
      </ChartCard>
    </div>
  );
}
