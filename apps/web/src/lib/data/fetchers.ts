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
  getAgingTickets,
  getBottlenecks,
  getCycleTimeByStatus,
  getThroughputWeekly,
  getWorkflowKpis,
  type AgingTicket,
  type BottleneckRow,
  type CycleTimeRow,
  type ThroughputPoint,
  type WorkflowFilter,
  type WorkflowKpis,
} from '../repositories/workflow';
import {
  getPortfolioSummary,
  getProjectHealthList,
  type PortfolioSummary,
  type ProjectHealth,
} from '../repositories/projectHealth';
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

// ── Workflow Intelligence (Module B) ────────────────────────────────────────
//
// These return empty defaults (not mock) when the DB is empty — workflow
// dashboards should clearly show "no data yet" rather than fabricated numbers.

const emptyWorkflowKpis: WorkflowKpis = { medianCycleHours: null, throughput7d: 0, wipTotal: 0, agingCount: 0 };

export const fetchWorkflowKpis = (filter: WorkflowFilter = {}): Promise<WorkflowKpis> =>
  withMockFallback('workflow.kpis', () => getWorkflowKpis(filter), () => emptyWorkflowKpis);

export const fetchCycleTimeByStatus = (): Promise<CycleTimeRow[]> =>
  withMockFallback('workflow.cycle', getCycleTimeByStatus, () => []);

export const fetchThroughputWeekly = (): Promise<ThroughputPoint[]> =>
  withMockFallback('workflow.throughput', getThroughputWeekly, () => []);

export const fetchAgingTickets = (limit = 20, filter: WorkflowFilter = {}): Promise<AgingTicket[]> =>
  withMockFallback('workflow.aging', () => getAgingTickets(limit, filter), () => []);

export const fetchBottlenecks = (filter: WorkflowFilter = {}): Promise<BottleneckRow[]> =>
  withMockFallback('workflow.bottlenecks', () => getBottlenecks(filter), () => []);

// ── Project Health Index (Module C) ─────────────────────────────────────────

const emptyPortfolio: PortfolioSummary = { healthy: 0, atRisk: 0, critical: 0, total: 0, avgPhi: null };

export const fetchProjectHealthList = (): Promise<ProjectHealth[]> =>
  withMockFallback('phi.list', getProjectHealthList, () => []);

export const fetchPortfolioSummary = (): Promise<PortfolioSummary> =>
  withMockFallback('phi.summary', getPortfolioSummary, () => emptyPortfolio);

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
