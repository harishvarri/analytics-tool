'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { RealtimeActivityItem } from '@/types/analytics';
import type { AnalyticsEventRow } from '@/types/database';
import { rowToActivityItem } from './map';

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

/** Lightweight user record stored in the local lookup cache. */
type CachedUser = { email: string | null; displayName: string | null };

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
 *
 * User enrichment: raw INSERT payloads only carry user_id (UUID). We maintain
 * a local cache of userId → {email, displayName} populated from:
 *   1. The server-rendered `initial` items (already enriched via SQL join).
 *   2. Deferred batch lookups against `analytics_users` after each flush.
 * Items already in the buffer are back-patched once the lookup resolves,
 * so names appear within ~200ms of the event arriving.
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

  // ── User-enrichment cache ───────────────────────────────────────────────────
  // Maps userId (UUID) → { email, displayName } resolved from analytics_users.
  const userCacheRef = useRef<Map<string, CachedUser>>(new Map());
  // Accumulated user IDs that arrived with no cache hit; flushed in a batch.
  const pendingUserIdsRef = useRef<Set<string>>(new Set());
  // Debounce timer so many events in one flush trigger a single DB round-trip.
  const userFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate the cache from server-rendered initial items (they already
  // have enriched user data from the SQL view join).
  useEffect(() => {
    initial.forEach((item) => {
      if (item.userId && (item.userEmail !== null || item.userDisplayName !== null)) {
        userCacheRef.current.set(item.userId, {
          email: item.userEmail,
          displayName: item.userDisplayName,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — initial is stable

  /**
   * Batch-fetch display names/emails for any user IDs that aren't cached yet,
   * then back-patch the items already rendered in the feed.
   */
  const scheduleUserEnrichment = useCallback(() => {
    if (userFetchTimerRef.current) clearTimeout(userFetchTimerRef.current);

    userFetchTimerRef.current = setTimeout(async () => {
      // Drain the pending set — filter already-cached IDs in case a prior
      // request already resolved some while we were waiting.
      const ids = Array.from(pendingUserIdsRef.current).filter(
        (id) => !userCacheRef.current.has(id),
      );
      pendingUserIdsRef.current.clear();
      if (ids.length === 0) return;

      try {
        const supabase = getSupabaseBrowser();
        type UserRow = { id: string; email: string | null; display_name: string | null };
        const { data } = await (supabase
          .from('analytics_users')
          .select('id, email, display_name')
          .in('id', ids) as unknown as Promise<{ data: UserRow[] | null }>);

        if (!data?.length) return;

        // Populate cache with what we got back.
        for (const u of data) {
          userCacheRef.current.set(u.id, {
            email: u.email,
            displayName: u.display_name,
          });
        }

        // Back-patch items in state that were waiting for this data.
        setItems((prev) =>
          prev.map((item) => {
            if (
              !item.userId ||
              item.userEmail !== null ||
              item.userDisplayName !== null
            ) {
              return item; // already enriched or anonymous — skip
            }
            const cached = userCacheRef.current.get(item.userId);
            if (!cached) return item;
            return {
              ...item,
              userEmail: cached.email,
              userDisplayName: cached.displayName,
            };
          }),
        );
      } catch {
        // Silently ignore — feed still works, just shows "Anonymous" as fallback.
      }
    }, 200);
  }, []);

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
          const item = rowToActivityItem(payload.new);

          // Hydrate from cache immediately if the user is already known.
          if (item.userId) {
            const cached = userCacheRef.current.get(item.userId);
            if (cached) {
              pendingRef.current.unshift({
                ...item,
                userEmail: cached.email,
                userDisplayName: cached.displayName,
              });
            } else {
              // Queue for a deferred lookup and show without name for now.
              pendingUserIdsRef.current.add(item.userId);
              pendingRef.current.unshift(item);
            }
          } else {
            pendingRef.current.unshift(item); // genuinely anonymous event
          }
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

      // If any staged events had unknown user IDs, kick off an enrichment pass.
      if (pendingUserIdsRef.current.size > 0) {
        scheduleUserEnrichment();
      }
    }, flushIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (userFetchTimerRef.current) clearTimeout(userFetchTimerRef.current);
      timerRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [capacity, flushIntervalMs, paused, scheduleUserEnrichment]);

  return useMemo(() => ({ items, state, receivedCount }), [items, state, receivedCount]);
}
