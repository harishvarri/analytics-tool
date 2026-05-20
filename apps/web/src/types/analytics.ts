/**
 * Domain types shared by SDK, API layer, and dashboard.
 * These are the camelCase, app-facing shapes — the DB row shapes live in
 * `types/database.ts` and are mapped at the API boundary.
 */
import type {
  EventCategoryEnum,
  EventSourceEnum,
  PortalIdEnum,
} from './database';

export type PortalId = PortalIdEnum;
export type EventCategory = EventCategoryEnum;
export type EventSource = EventSourceEnum;

export interface AnalyticsEvent {
  id?: string;
  portalId: PortalId;
  category: EventCategory;
  source?: EventSource;
  name: string;
  userId?: string | null;
  sessionId?: string | null;
  url?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export interface SessionSummary {
  sessionId: string;
  userId: string | null;
  portalId: PortalId;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  eventCount: number;
}

export interface PortalSummary {
  portalId: PortalId;
  events24h: number;
  users24h: number;
  sessions24h: number;
  errors24h: number;
}

export interface DashboardKpis {
  activeUsers: number;
  totalSessions: number;
  totalEvents: number;
  errorRate: number;
}

export interface RealtimeActivityItem {
  id: string;
  portalId: PortalId;
  portalName: string;
  category: EventCategory;
  eventName: string;
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  sessionId: string | null;
  url: string | null;
  occurredAt: string;
}
