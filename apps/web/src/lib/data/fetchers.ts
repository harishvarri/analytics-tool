import 'server-only';
import { scoped } from '../logger';
import {
  getActiveUsers,
  getDashboardKpis,
  getPortalSummaries,
  getRecentSessions,
  type UserActivityRow,
} from '../repositories/analytics';
import { getRealtimeActivity } from '../repositories/events';
import {
  mockActiveUsers,
  mockCategoryBreakdown,
  mockDashboardKpis,
  mockEventsTimeSeries,
  mockPortalSummaries,
  mockRecentActivity,
  mockRecentSessions,
  type TimePoint,
} from '../mock/dashboard';
import type {
  DashboardKpis,
  PortalSummary,
  RealtimeActivityItem,
  SessionSummary,
  EventCategory,
} from '@/types/analytics';

const log = scoped('data');

/**
 * Try the live repository; fall back to mock data if it throws (e.g. no
 * Supabase project connected, network down, RLS denial). Means the dashboard
 * always renders — important for demos and dev without a backend.
 */
async function withMockFallback<T>(label: string, live: () => Promise<T>, mock: () => T): Promise<T> {
  try {
    return await live();
  } catch (err) {
    log.debug({ label, err: err instanceof Error ? err.message : String(err) }, 'falling back to mock data');
    return mock();
  }
}

export const fetchDashboardKpis = (): Promise<DashboardKpis> =>
  withMockFallback('kpis', getDashboardKpis, mockDashboardKpis);

export const fetchPortalSummaries = (): Promise<PortalSummary[]> =>
  withMockFallback('portals', getPortalSummaries, mockPortalSummaries);

export const fetchRecentSessions = (limit = 20): Promise<SessionSummary[]> =>
  withMockFallback('sessions', () => getRecentSessions(limit), () => mockRecentSessions(limit));

export const fetchActiveUsers = (limit = 12): Promise<UserActivityRow[]> =>
  withMockFallback('users', () => getActiveUsers(limit), () => mockActiveUsers(limit));

export const fetchRecentActivity = (limit = 20): Promise<RealtimeActivityItem[]> =>
  withMockFallback('activity', () => getRealtimeActivity(limit), () => mockRecentActivity(limit));

/** Pure mocks (no live source yet — these aggregations come in Phase 6). */
export const fetchEventsTimeSeries = async (): Promise<TimePoint[]> => mockEventsTimeSeries();
export const fetchCategoryBreakdown = async (): Promise<
  { category: EventCategory; events: number }[]
> => mockCategoryBreakdown();
