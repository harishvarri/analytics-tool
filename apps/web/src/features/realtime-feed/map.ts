import { PORTALS } from '@/config/portals';
import type { AnalyticsEventRow } from '@/types/database';
import type { RealtimeActivityItem } from '@/types/analytics';

/**
 * Convert a raw INSERT payload from `analytics_events` (snake_case row) into
 * the UI shape used by the activity feed. The realtime channel doesn't join
 * portal+user, so we resolve portal name from the static registry and leave
 * user enrichment for a future server-side join when needed.
 */
export function rowToActivityItem(row: AnalyticsEventRow): RealtimeActivityItem {
  return {
    id: row.id,
    portalId: row.portal_id,
    portalName: PORTALS[row.portal_id]?.name ?? row.portal_id,
    category: row.category,
    eventName: row.name,
    userId: row.user_id,
    userEmail: null,
    userDisplayName: null,
    sessionId: row.session_id,
    url: row.url,
    occurredAt: row.occurred_at,
  };
}
