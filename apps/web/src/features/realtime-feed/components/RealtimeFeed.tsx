'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import type { RealtimeActivityItem } from '@/types/analytics';
import { classifyImportance, meetsThreshold, type ImportanceTier } from '@/lib/importance';
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

  // Noise filter: default to "Important only" (hide debug-tier page views / perf).
  const [importantOnly, setImportantOnly] = useState(true);

  const { items, state, receivedCount } = useRealtimeActivity({ initial, capacity, paused });

  const visible = useMemo(() => {
    if (!importantOnly) return items;
    const threshold: ImportanceTier = 'normal';
    return items.filter((it) => {
      const tier =
        ((it.metadata?.['_importance'] as ImportanceTier | undefined)) ??
        classifyImportance(it.category, it.eventName);
      return meetsThreshold(tier, threshold);
    });
  }, [items, importantOnly]);

  const hiddenCount = items.length - visible.length;

  return (
    <div className="space-y-4">
      <LiveCounters items={items} />
      <ChartCard
        title="Live event stream"
        description="Newest activity at the top — streaming via Supabase Realtime."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportantOnly((v) => !v)}
              className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              title={importantOnly ? `Hiding ${hiddenCount} low-signal events` : 'Showing every event'}
            >
              {importantOnly ? 'Important only' : 'Everything'}
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
          empty={importantOnly ? 'No important activity yet — toggle "Everything" to see all events.' : 'Waiting for the first event…'}
        />
      </ChartCard>
    </div>
  );
}
