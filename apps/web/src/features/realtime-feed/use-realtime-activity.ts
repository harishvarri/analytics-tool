'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { RealtimeActivityItem } from '@/types/analytics';
import type { AnalyticsEventRow } from '@/types/database';
import { rowToActivityItem } from './map';

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

interface UseRealtimeActivityOptions {
  initial?: RealtimeActivityItem[];
  /** Maximum items held in the rolling buffer. */
  capacity?: number;
  /** Throttle render coalescing window. */
  flushIntervalMs?: number;
  /** Disable the subscription (e.g. tab hidden). */
  paused?: boolean;
}

interface UseRealtimeActivityResult {
  items: RealtimeActivityItem[];
  state: ConnectionState;
  /** Count of events received since mount (informational badge). */
  receivedCount: number;
}

/**
 * Subscribes to `postgres_changes` INSERTs on `public.analytics_events` and
 * exposes a rolling, ordered feed. New events arrive at the top.
 *
 * Render throttling: payloads are staged in a ref and flushed at most once
 * per `flushIntervalMs` (default 400ms). This keeps the UI snappy under
 * burst traffic (1000s of events/min) without dropping data.
 */
export function useRealtimeActivity({
  initial = [],
  capacity = 100,
  flushIntervalMs = 400,
  paused = false,
}: UseRealtimeActivityOptions = {}): UseRealtimeActivityResult {
  const [items, setItems] = useState<RealtimeActivityItem[]>(initial);
  const [state, setState] = useState<ConnectionState>('connecting');
  const [receivedCount, setReceivedCount] = useState(0);

  const pendingRef = useRef<RealtimeActivityItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) {
      setState('closed');
      return;
    }
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('analytics:events')
      .on<AnalyticsEventRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events' },
        (payload: RealtimePostgresInsertPayload<AnalyticsEventRow>) => {
          if (!payload.new) return;
          pendingRef.current.unshift(rowToActivityItem(payload.new));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setState('open');
        else if (status === 'CHANNEL_ERROR') setState('error');
        else if (status === 'CLOSED') setState('closed');
        else setState('connecting');
      });

    // Render coalescing loop — flush staged events on a single rAF-ish tick.
    timerRef.current = setInterval(() => {
      if (pendingRef.current.length === 0) return;
      const staged = pendingRef.current;
      pendingRef.current = [];
      setReceivedCount((n) => n + staged.length);
      setItems((prev) => {
        const next = [...staged, ...prev];
        return next.length > capacity ? next.slice(0, capacity) : next;
      });
    }, flushIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [capacity, flushIntervalMs, paused]);

  return useMemo(() => ({ items, state, receivedCount }), [items, state, receivedCount]);
}
