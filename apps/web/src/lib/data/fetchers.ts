import 'server-only';
import { scoped } from '../logger';
import {
  getActiveUsers,
  getCategoryBreakdown,
  getDashboardKpis,
  getEventsTimeSeries,
  getPortalSummaries,
  getRecentSessions,
  type UserActivityRow,
} from '../repositories/analytics';
import { getRealtimeActivity } from '../repositories/events';
import {
  listApplications,
  listProjects,
  type ApplicationOption,
  type ProjectOption,
} from '../repositories/workspace';
import {
  getDormantUsers,
  getRetentionCohorts,
  getTopJourneys,
  type DormantUser,
  type JourneyEdge,
  type RetentionCohort,
} from '../repositories/retention';
import {
  getAnomalySignals,
  getAnomalySummary,
  type AnomalySignal,
  type AnomalySummary,
} from '../repositories/anomalies';
import {
  getFeatureActions,
  getFeatureDecay,
  getFeaturePortfolioStats,
  getFeatureSummaries,
  getFeatureWeeklyTrend,
  type FeatureAction,
  type FeatureDecayPoint,
  type FeaturePortfolioStats,
  type FeatureSummary,
  type FeatureTrendPoint,
} from '../repositories/features';
import {
  getErrorGroups,
  getErrorRateTrend,
  getReliabilityKpis,
  type ErrorGroup,
  type ErrorRatePoint,
  type ReliabilityKpis,
} from '../repositories/reliability';
import {
  getAudienceBreakdown,
  type AudienceBreakdown,
} from '../repositories/audience';
import { getJourneyGraph, type JourneyGraph } from '../repositories/journeys';
import { getProjectComparison, type ProjectComparisonRow } from '../repositories/crossProject';
import { getInsights, type InsightsBundle } from '../repositories/insights';
import {
  getActiveUserCounts,
  getPerformanceByRoute,
  getPerformanceKpis,
  getPerformanceTrend,
  type ActiveUserCounts,
  type PerfTrendPoint,
  type PerformanceKpis,
  type RoutePerformance,
} from '../repositories/performance';
import {
  getAppUsers,
  getCommandCenter,
  getInactiveUsers,
  getOrgDirectoryRollup,
  getProjectAccessVsUsage,
  getUserProfileSummaries,
  type AppUserRow,
  type CommandCenter,
  type InactiveUser,
  type OrgRollupRow,
  type ProjectAccessUsage,
  type UserProfileSummary,
} from '../repositories/operational';
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

/** Hourly event + user time series — real DB query, falls back to mock. */
export const fetchEventsTimeSeries = (hours = 24): Promise<TimePoint[]> =>
  withMockFallback('timeseries', () => getEventsTimeSeries(hours), () => mockEventsTimeSeries(hours));

/** Category breakdown — real DB query, falls back to mock. */
export const fetchCategoryBreakdown = (): Promise<{ category: EventCategory; events: number }[]> =>
  withMockFallback('categories', getCategoryBreakdown, mockCategoryBreakdown);

// ── Workspace (applications + projects for the global filter) ───────────────

export const fetchApplications = (): Promise<ApplicationOption[]> =>
  withMockFallback('workspace.apps', listApplications, () => []);

export const fetchProjects = (appId?: string): Promise<ProjectOption[]> =>
  withMockFallback('workspace.projects', () => listProjects(appId), () => []);

// ── Retention (Module D) ────────────────────────────────────────────────────

export const fetchRetentionCohorts = (): Promise<RetentionCohort[]> =>
  withMockFallback('retention.cohorts', getRetentionCohorts, () => []);

export const fetchDormantUsers = (limit = 25): Promise<DormantUser[]> =>
  withMockFallback('retention.dormant', () => getDormantUsers(limit), () => []);

export const fetchTopJourneys = (limit = 12): Promise<JourneyEdge[]> =>
  withMockFallback('retention.journeys', () => getTopJourneys(limit), () => []);

// ── Anomaly Alerts (Module E) ───────────────────────────────────────────────

const emptyAnomalySummary: AnomalySummary = {
  critical: 0, warning: 0, totalActive: 0, topSeverity: null,
};

export const fetchAnomalySignals = (): Promise<AnomalySignal[]> =>
  withMockFallback('anomalies.list', getAnomalySignals, () => []);

export const fetchAnomalySummary = (): Promise<AnomalySummary> =>
  withMockFallback('anomalies.summary', getAnomalySummary, () => emptyAnomalySummary);

// ── Feature Adoption (Module F) ──────────────────────────────────────────────

const emptyPortfolioStats: FeaturePortfolioStats = {
  activeFeatures: 0,
  avgAdoptionPct: null,
  topFeature:     null,
  platformUsage7d: null,
};

export const fetchFeatureSummaries = (): Promise<FeatureSummary[]> =>
  withMockFallback('features.summaries', getFeatureSummaries, () => []);

export const fetchFeatureWeeklyTrend = (): Promise<FeatureTrendPoint[]> =>
  withMockFallback('features.trend', getFeatureWeeklyTrend, () => []);

export const fetchFeatureActions = (feature?: string): Promise<FeatureAction[]> =>
  withMockFallback('features.actions', () => getFeatureActions(feature), () => []);

export const fetchFeatureDecay = (): Promise<FeatureDecayPoint[]> =>
  withMockFallback('features.decay', getFeatureDecay, () => []);

export const fetchFeaturePortfolioStats = (): Promise<FeaturePortfolioStats> =>
  withMockFallback('features.portfolio', getFeaturePortfolioStats, () => emptyPortfolioStats);

// ── Reliability / SLO (Module G) ─────────────────────────────────────────────

const emptyReliabilityKpis: ReliabilityKpis = {
  totalSessions: 0, erroredSessions: 0, totalErrors24h: 0, errorGroups24h: 0,
  affectedUsers24h: 0, newErrorGroups24h: 0, sloTargetPct: 99.5, errorFreePct: 100,
  budgetBurnPct: 0,
};

export const fetchErrorGroups = (limit = 40): Promise<ErrorGroup[]> =>
  withMockFallback('reliability.groups', () => getErrorGroups(limit), () => []);

export const fetchErrorRateTrend = (): Promise<ErrorRatePoint[]> =>
  withMockFallback('reliability.trend', getErrorRateTrend, () => []);

export const fetchReliabilityKpis = (): Promise<ReliabilityKpis> =>
  withMockFallback('reliability.kpis', getReliabilityKpis, () => emptyReliabilityKpis);

// ── Audience & Tech (Module H) ───────────────────────────────────────────────

const emptyAudience: AudienceBreakdown = {
  rows: [],
  byDimension: { browser: [], os: [], device_type: [], language: [], timezone: [], region: [], screen: [] },
  totalUsers: 0,
};

export const fetchAudienceBreakdown = (days = 30): Promise<AudienceBreakdown> =>
  withMockFallback('audience', () => getAudienceBreakdown(days), () => emptyAudience);

// ── Journey Flow (Module J) ──────────────────────────────────────────────────

export const fetchJourneyGraph = (days = 30): Promise<JourneyGraph> =>
  withMockFallback('journey', () => getJourneyGraph(days), () => ({ nodes: [], links: [], totalTransitions: 0 }));

// ── Cross-Project Comparison (Module K) ──────────────────────────────────────

export const fetchProjectComparison = (): Promise<ProjectComparisonRow[]> =>
  withMockFallback('cross-project', getProjectComparison, () => []);

// ── Smart Insights (Module L) ────────────────────────────────────────────────

export const fetchInsights = (): Promise<InsightsBundle> =>
  withMockFallback('insights', getInsights, () => ({
    insights: [],
    intelligence: { mostAdopted: null, fastestGrowing: null, leastUsed: null, churnRisk: null },
  }));

// ── Performance (Module #8) ──────────────────────────────────────────────────

const emptyPerfKpis: PerformanceKpis = {
  samples: 0, loadP50Ms: null, loadP75Ms: null, loadP95Ms: null,
  ttfbP50Ms: null, domInteractiveP50Ms: null, avgEngagedSec: null,
};

export const fetchPerformanceKpis = (): Promise<PerformanceKpis> =>
  withMockFallback('perf.kpis', getPerformanceKpis, () => emptyPerfKpis);

export const fetchPerformanceByRoute = (limit = 20): Promise<RoutePerformance[]> =>
  withMockFallback('perf.routes', () => getPerformanceByRoute(limit), () => []);

export const fetchPerformanceTrend = (): Promise<PerfTrendPoint[]> =>
  withMockFallback('perf.trend', getPerformanceTrend, () => []);

// ── Active users (DAU/WAU/MAU) ───────────────────────────────────────────────

export const fetchActiveUserCounts = (): Promise<ActiveUserCounts> =>
  withMockFallback('active.counts', getActiveUserCounts, () => ({ dau: 0, wau: 0, mau: 0, stickinessPct: 0 }));

// ── Operational Intelligence (Command Center / People / Access) ──────────────

const emptyCommandCenter: CommandCenter = {
  activeUsersToday: 0, sessionsToday: 0, eventsToday: 0, errorsToday: 0,
  mostUsedProject: null, leastAdoptedProject: null, totalDirectoryUsers: 0,
  inactiveUsersCount: 0, neverUsedAccessCount: 0,
};

export const fetchCommandCenter = (): Promise<CommandCenter> =>
  withMockFallback('ops.command', getCommandCenter, () => emptyCommandCenter);

export const fetchProjectAccessVsUsage = (): Promise<ProjectAccessUsage[]> =>
  withMockFallback('ops.access', getProjectAccessVsUsage, () => []);

export const fetchUserProfileSummaries = (limit = 100): Promise<UserProfileSummary[]> =>
  withMockFallback('ops.people', () => getUserProfileSummaries(limit), () => []);

export const fetchAppUsers = (appSlug: string, limit = 100): Promise<AppUserRow[]> =>
  withMockFallback('ops.appUsers', () => getAppUsers(appSlug, limit), () => []);

export const fetchInactiveUsers = (limit = 100): Promise<InactiveUser[]> =>
  withMockFallback('ops.inactive', () => getInactiveUsers(limit), () => []);

export const fetchOrgDirectoryRollup = (): Promise<OrgRollupRow[]> =>
  withMockFallback('ops.rollup', getOrgDirectoryRollup, () => []);
