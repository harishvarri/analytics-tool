'use client';

import { useMemo } from 'react';
import type { RealtimeActivityItem } from '@/types/analytics';

interface LiveCounters {
  /** Distinct active users in the buffer. */
  activeUsers: number;
  /** Distinct active sessions in the buffer. */
  activeSessions: number;
  /** Events per minute, derived from the buffer's time range. */
  eventsPerMinute: number;
}

/**
 * Derives lightweight counters from the in-memory activity buffer. Cheap
 * O(n) over the rolling window — no extra subscriptions needed.
 */
export function useLiveCounters(items: RealtimeActivityItem[]): LiveCounters {
  return useMemo(() => {
    if (items.length === 0) {
      return { activeUsers: 0, activeSessions: 0, eventsPerMinute: 0 };
    }
    const users = new Set<string>();
    const sessions = new Set<string>();
    let oldest = Number.POSITIVE_INFINITY;
    let newest = 0;
    for (const it of items) {
      if (it.userId) users.add(it.userId);
      if (it.sessionId) sessions.add(it.sessionId);
      const t = Date.parse(it.occurredAt);
      if (Number.isFinite(t)) {
        if (t < oldest) oldest = t;
        if (t > newest) newest = t;
      }
    }
    const spanMs = Math.max(1, newest - oldest);
    const eventsPerMinute = Math.round((items.length * 60_000) / spanMs);
    return {
      activeUsers: users.size,
      activeSessions: sessions.size,
      eventsPerMinute,
    };
  }, [items]);
}
