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
  getOperationalRisks,
  type AnomalySignal,
  type AnomalySummary,
  type RiskBoard,
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
import { getInsights, type ExecutiveOperationsReport } from '../repositories/insights';
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
  getDepartmentActivity,
  getDepartmentDetail,
  getDepartmentRollup,
  getLoginHistory,
  getOrgPulse,
  getSessionDetail,
  getSessionList,
  getUserActivityWindow,
  getUserDetail,
  getUserProfileSummaries,
  type ActivityRange,
  type AppUserRow,
  type DepartmentActivityRow,
  type DepartmentDetail,
  type DepartmentRollupRow,
  type LoginRow,
  type OrgPulse,
  type SessionDetail,
  type SessionRow,
  type UserActivityWindow,
  type UserDetail,
  type UserProfileSummary,
} from '../repositories/operational';
import {
  getAccessVsUsage,
  getInactiveWithAccess,
  type AccessVsUsageRow,
  type InactiveWithAccessRow,
} from '../repositories/access';
import { getIssueStatuses, type IssueStatus } from '../repositories/issues';
import { getProjectHealth, type ProjectHealthRow } from '../repositories/health';
import { getOrganizationHealth, type OrgHealth } from '../repositories/orgHealth';
import { getErrorIntelligence, type ErrorIntelligence } from '../repositories/errorIntelligence';
import { getIncidents, type IncidentBoard } from '../repositories/incidents';
import {
  getReliabilityHealth,
  getReliabilityHealthBySlug,
  getHealthHistory,
  type ReliabilityHealthBoard,
  type ReliabilityHealth,
  type HealthHistoryPoint,
} from '../repositories/reliabilityHealth';
import { getIntegrationHealth, type IntegrationHealth } from '../repositories/integrationHealth';
import { getCommandCenter, type CommandCenter } from '../repositories/analytics';
import {
  getPlatformHealth,
  getProjectIntelligence,
  getProjectIntelligenceBySlug,
  getProjectRecentActivity,
  type PlatformHealth,
  type ProjectIntelligence,
} from '../repositories/projectIntelligence';
import type { ImportanceTier } from '../importance';
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
 * Try the live repository; fall back to mock data if it throws.
 *
 * BUG-003 fix: in production, a fallback means the DB is unreachable — the
 * dashboard must NOT silently show stale/fake data as if live. We expose a
 * global flag so pages can show a visible warning banner.
 */
export let isUsingMockData = false;

async function withMockFallback<T>(label: string, live: () => Promise<T>, mock: () => T): Promise<T> {
  try {
    const result = await live();
    return result;
  } catch (err) {
    log.warn({ label, err: err instanceof Error ? err.message : String(err) }, '[data] falling back to mock — DB unreachable?');
    isUsingMockData = true;
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

export const fetchRecentActivity = (
  limit = 20,
  appId?: string,
  minImportance: ImportanceTier = 'normal',
): Promise<RealtimeActivityItem[]> =>
  withMockFallback('activity', async () => {
    const all = await getRealtimeActivity(limit * (appId ? 5 : 1), minImportance); // over-fetch then filter
    if (!appId) return all.slice(0, limit);
    return all.filter((a) => a.portalId === appId).slice(0, limit);
  }, () => mockRecentActivity(limit));

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

export const fetchOperationalRisks = (): Promise<RiskBoard> =>
  withMockFallback('anomalies.risks', getOperationalRisks, () => ({ critical: 0, warning: 0, total: 0, signals: [] }));

// ── Feature Adoption (Module F) ──────────────────────────────────────────────

const emptyPortfolioStats: FeaturePortfolioStats = {
  activeFeatures: 0,
  avgAdoptionPct: null,
  topFeature:     null,
  platformUsage7d: null,
};

export const fetchFeatureSummaries = (appId?: string): Promise<FeatureSummary[]> =>
  withMockFallback('features.summaries', () => getFeatureSummaries(appId), () => []);

export const fetchFeatureWeeklyTrend = (_appId?: string): Promise<FeatureTrendPoint[]> =>
  withMockFallback('features.trend', () => getFeatureWeeklyTrend(), () => []);

export const fetchFeatureActions = (feature?: string, appId?: string): Promise<FeatureAction[]> =>
  withMockFallback('features.actions', () => getFeatureActions(feature, appId), () => []);

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

export const fetchErrorGroups = (limit = 40, appId?: string): Promise<ErrorGroup[]> =>
  withMockFallback('reliability.groups', async () => {
    const all = await getErrorGroups(appId ? limit * 3 : limit);
    if (!appId) return all.slice(0, limit);
    return all.filter((g) => !appId || g.appCount > 0).slice(0, limit); // v_error_groups has app_count but not portalId; show all when filtered
  }, () => []);

export const fetchErrorRateTrend = (_appId?: string): Promise<ErrorRatePoint[]> =>
  withMockFallback('reliability.trend', getErrorRateTrend, () => []);

export const fetchReliabilityKpis = (_appId?: string): Promise<ReliabilityKpis> =>
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

export const fetchInsights = (): Promise<ExecutiveOperationsReport> =>
  withMockFallback('insights', getInsights, () => ({
    week: {
      startDate: new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      previousStartDate: new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10),
      previousEndDate: new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10),
    },
    platformStatus: 'warning',
    executiveSummary: ['Live analytics data is currently unavailable.'],
    productRanking: [],
    productIntelligence: [],
    adoption: { mostUsed: null, leastUsed: null, fastestGrowing: null, declining: null, newlyAdopted: [] },
    engagement: {
      activeUsers: { value: 0, previous: 0, deltaPct: 0, direction: 'flat' },
      sessions: { value: 0, previous: 0, deltaPct: 0, direction: 'flat' },
      logins: { value: 0, previous: 0, deltaPct: 0, direction: 'flat' },
      avgSessionsPerUser: 0,
      avgLoginsPerUser: 0,
      returningUsers: 0,
      newUsers: 0,
      trend: 'No measurable engagement',
    },
    departments: { mostActive: null, leastActive: null, rows: [] },
    risks: [],
    incidents: { created: 0, resolved: null, open: 0, critical: 0, summary: 'Incident data is currently unavailable.' },
    recommendations: [{ priority: 'low', title: 'Restore analytics connection', detail: 'Reconnect the database to generate the executive operations report.' }],
    scorecard: { platformHealth: 0, engagement: 0, reliability: 0, adoption: 0, risk: 'Low', overallStatus: 'warning' },
  }));

// ── Performance (Module #8) ──────────────────────────────────────────────────

const emptyPerfKpis: PerformanceKpis = {
  samples: 0, loadP50Ms: null, loadP75Ms: null, loadP95Ms: null,
  ttfbP50Ms: null, domInteractiveP50Ms: null, avgEngagedSec: null,
};

export const fetchPerformanceKpis = (_appId?: string): Promise<PerformanceKpis> =>
  withMockFallback('perf.kpis', getPerformanceKpis, () => emptyPerfKpis);

export const fetchPerformanceByRoute = (limit = 20, _appId?: string): Promise<RoutePerformance[]> =>
  withMockFallback('perf.routes', () => getPerformanceByRoute(limit), () => []);

export const fetchPerformanceTrend = (_appId?: string): Promise<PerfTrendPoint[]> =>
  withMockFallback('perf.trend', getPerformanceTrend, () => []);

// ── Active users (DAU/WAU/MAU) ───────────────────────────────────────────────

export const fetchActiveUserCounts = (): Promise<ActiveUserCounts> =>
  withMockFallback('active.counts', getActiveUserCounts, () => ({ dau: 0, wau: 0, mau: 0, stickinessPct: 0 }));

// ── Operational Intelligence (per-app, event-driven) ─────────────────────────

export const fetchOrgPulse = (): Promise<OrgPulse> =>
  withMockFallback('ops.pulse', getOrgPulse, () => ({ loginsToday: 0, appsActive: 0, appsTotal: 0 }));

export const fetchUserProfileSummaries = (limit = 100): Promise<UserProfileSummary[]> =>
  withMockFallback('ops.people', () => getUserProfileSummaries(limit), () => []);

export const fetchAppUsers = (appSlug: string, limit = 100): Promise<AppUserRow[]> =>
  withMockFallback('ops.appUsers', () => getAppUsers(appSlug, limit), () => []);

export const fetchUserDetail = (userId: string): Promise<UserDetail | null> =>
  withMockFallback('ops.userDetail', () => getUserDetail(userId), () => null);

export const fetchUserActivityWindow = (userId: string, range: ActivityRange): Promise<UserActivityWindow> =>
  withMockFallback('ops.userWindow', () => getUserActivityWindow(userId, range), () => ({
    range, events: 0, businessActions: 0, errors: 0, logins: 0, productsUsed: 0, activeDays: 0,
    sessions: 0, activeMinutes: 0, avgSessionMin: 0, apps: [], topActions: [], timeline: [],
  }));

// ── Operational Intelligence v2 (surface existing 0020/0030 views) ────────────

export const fetchCommandCenter = (): Promise<CommandCenter> =>
  withMockFallback('ops.commandCenter', getCommandCenter, () => ({
    activeUsersToday: 0, sessionsToday: 0, eventsToday: 0, errorsToday: 0,
    mostUsedProject: null, leastAdoptedProject: null, totalDirectoryUsers: 0,
    inactiveUsersCount: 0, neverUsedAccessCount: 0,
  }));

export const fetchAccessVsUsage = (days = 30): Promise<AccessVsUsageRow[]> =>
  withMockFallback('access.usage', () => getAccessVsUsage(days), () => []);

export const fetchInactiveWithAccess = (limit = 100): Promise<InactiveWithAccessRow[]> =>
  withMockFallback('access.inactive', () => getInactiveWithAccess(limit), () => []);

export const fetchProjectHealth = (): Promise<ProjectHealthRow[]> =>
  withMockFallback('health.projects', getProjectHealth, () => []);

export const fetchIssueStatuses = (keys: string[]): Promise<Map<string, { status: IssueStatus; updatedAt: string }>> =>
  withMockFallback('issues.statuses', () => getIssueStatuses(keys), () => new Map());

export const fetchDepartmentRollup = (): Promise<DepartmentRollupRow[]> =>
  withMockFallback('dept.rollup', getDepartmentRollup, () => []);

export const fetchDepartmentActivity = (days = 30): Promise<DepartmentActivityRow[]> =>
  withMockFallback('dept.activity', () => getDepartmentActivity(days), () => []);

export const fetchDepartmentDetail = (dept: string, days = 30): Promise<DepartmentDetail | null> =>
  withMockFallback('dept.detail', () => getDepartmentDetail(dept, days), () => null);

export const fetchLoginHistory = (opts: { appId?: string; days?: number; since?: string; until?: string; limit?: number } = {}): Promise<LoginRow[]> =>
  withMockFallback('ops.logins', () => getLoginHistory(opts), () => []);

// ── Project Intelligence (registry-driven Products section) ──────────────────
export const fetchProjectIntelligence = (): Promise<ProjectIntelligence[]> =>
  withMockFallback('projects.intelligence', getProjectIntelligence, () => []);

export const fetchProjectIntelligenceBySlug = (slug: string): Promise<ProjectIntelligence | null> =>
  withMockFallback('projects.intelligence.one', () => getProjectIntelligenceBySlug(slug), () => null);

export const fetchPlatformHealth = (): Promise<PlatformHealth> =>
  withMockFallback('projects.platformHealth', getPlatformHealth, () => ({
    overallScore: 0, healthy: 0, warning: 0, critical: 0, totalProjects: 0, critical_projects: [],
  }));

export const fetchProjectRecentActivity = (slug: string, limit = 150): Promise<RealtimeActivityItem[]> =>
  withMockFallback('projects.recent', () => getProjectRecentActivity(slug, limit), () => []);

export const fetchReliabilityHealth = (): Promise<ReliabilityHealthBoard> =>
  withMockFallback('reliability.health', getReliabilityHealth, () => ({
    overallScore: 100, healthy: 0, warning: 0, critical: 0, total: 0,
    affectedUsers: 0, affectedProducts: 0,
    mostHealthy: null, mostUnstable: null, needsAttention: [], recentChanges: [], projects: [],
  }));

export const fetchReliabilityHealthBySlug = (slug: string): Promise<ReliabilityHealth | null> =>
  withMockFallback('reliability.health.one', () => getReliabilityHealthBySlug(slug), () => null);

export const fetchHealthHistory = (slug: string, days = 30): Promise<HealthHistoryPoint[]> =>
  withMockFallback('reliability.health.history', () => getHealthHistory(slug, days), () => []);

export const fetchErrorIntelligence = (days = 7): Promise<ErrorIntelligence> =>
  withMockFallback('errors.intel', () => getErrorIntelligence(days), () => ({
    windowDays: days, totalErrors: 0, criticalErrors: 0, usersImpacted: 0, projectsImpacted: 0,
    activeIncidents: 0, categories: [], byProject: [], timeline: [],
  }));

export const fetchIntegrationHealth = (): Promise<IntegrationHealth> =>
  withMockFallback('integration.health', getIntegrationHealth, () => ({
    avgScore: 0, projects: [],
    dataQuality: { totalUsers: 0, namedUsers: 0, anonymousUsers: 0, anonymousPct: 0, productsTotal: 0, productsMissingBusinessEvents: 0, productsInactive: 0, productsWithoutIdentifiedUsers: 0 },
  }));

export const fetchIncidents = (): Promise<IncidentBoard> =>
  withMockFallback('ops.incidents', getIncidents, () => ({
    open: 0, critical: 0, projectsAtRisk: 0, usersAffected: 0, resolvedToday: null, mttrMinutes: null, incidents: [], resolved: [],
  }));

export const fetchOrganizationHealth = (): Promise<OrgHealth> =>
  withMockFallback('org.health', getOrganizationHealth, () => ({
    score: 0, tier: 'critical' as const, riskScore: 100, criticalIssues: 0, activeIncidents: 0, affectedUsers: 0,
    components: { projectHealth: 0, incidentSeverity: 0, errorImpact: 0, userAdoption: 0, departmentEngagement: 0 },
    why: [], riskFactors: [], attention: [], recommendations: [], totals: { projects: 0, healthy: 0, warning: 0, critical: 0 },
  }));

export const fetchSessionList = (opts: { appId?: string; days?: number; since?: string; until?: string; limit?: number } = {}): Promise<SessionRow[]> =>
  withMockFallback('ops.sessions', () => getSessionList(opts), () => []);

export const fetchSessionDetail = (sessionId: string): Promise<SessionDetail | null> =>
  withMockFallback('ops.sessionDetail', () => getSessionDetail(sessionId), () => null);
