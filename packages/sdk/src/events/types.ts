/**
 * Public event types for the SDK.
 *
 * These mirror the camelCase domain types in apps/web/src/types/analytics.ts —
 * intentionally duplicated so the SDK has zero coupling to the dashboard app.
 * When you change one, change both (or extract a shared package in Phase 8).
 */

export type PortalId =
  | 'sentinel'
  | 'analytics';

export type EventCategory =
  | 'auth'
  | 'navigation'
  | 'feature'
  | 'interaction'
  | 'error'
  | 'custom';

export type EventSource = 'web' | 'mobile' | 'server' | 'integration';

/** What the SDK consumer passes in (occurredAt + portalId filled by the client). */
export interface TrackEventInput {
  id?: string;
  category: EventCategory;
  name: string;
  source?: EventSource;
  userId?: string | null;
  sessionId?: string | null;
  url?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

/** What actually goes on the wire. */
export interface AnalyticsEventPayload {
  id?: string;
  portalId: PortalId;
  category: EventCategory;
  name: string;
  source: EventSource;
  userId?: string | null;
  sessionId?: string | null;
  url?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}
