import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import { getProjectIntelligence } from './projectIntelligence';
import { getIncidents } from './incidents';

type Status = 'healthy' | 'warning' | 'critical';
type Trend = 'New' | 'Growing' | 'Stable' | 'Declining' | 'Inactive';
type Priority = 'high' | 'medium' | 'low';
type Direction = 'up' | 'down' | 'flat';

export interface MetricDelta {
  value: number;
  previous: number;
  deltaPct: number | null;
  direction: Direction;
}

export interface ProductPerformanceRow {
  slug: string;
  name: string;
  activeUsers: number;
  sessions: number;
  healthScore: number;
  trend: Trend;
  weeklyGrowthPct: number | null;
  errorCount: number;
  reliabilityScore: number;
  summary: string;
}

export interface CapabilityInsight {
  feature: string;
  usersThisWeek: number;
  usersLastWeek: number;
  growthPct: number | null;
  narrative: string;
}

export interface AdoptionIntelligence {
  mostUsed: CapabilityInsight | null;
  leastUsed: CapabilityInsight | null;
  fastestGrowing: CapabilityInsight | null;
  declining: CapabilityInsight | null;
  newlyAdopted: CapabilityInsight[];
}

export interface EngagementIntelligence {
  activeUsers: MetricDelta;
  sessions: MetricDelta;
  logins: MetricDelta;
  avgSessionsPerUser: number;
  avgLoginsPerUser: number;
  returningUsers: number;
  newUsers: number;
  trend: string;
}

export interface DepartmentInsight {
  department: string;
  activeUsers: number;
  events: number;
  sessions: number;
  growthPct: number | null;
  adoptionLabel: string;
  summary: string;
}

export interface RiskItem {
  id: string;
  priority: Priority;
  title: string;
  current: number;
  previous: number | null;
  potentialCauses: string[];
  recommendedAction: string;
}

export interface IncidentSummary {
  created: number;
  resolved: number | null;
  open: number;
  critical: number;
  summary: string;
}

export interface Recommendation {
  priority: Priority;
  title: string;
  detail: string;
}

export interface WeeklyScorecard {
  platformHealth: number;
  engagement: number;
  reliability: number;
  adoption: number;
  risk: 'Low' | 'Medium' | 'High';
  overallStatus: Status;
}

export interface ExecutiveOperationsReport {
  week: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  platformStatus: Status;
  executiveSummary: string[];
  productRanking: ProductPerformanceRow[];
  productIntelligence: string[];
  adoption: AdoptionIntelligence;
  engagement: EngagementIntelligence;
  departments: {
    mostActive: DepartmentInsight | null;
    leastActive: DepartmentInsight | null;
    rows: DepartmentInsight[];
  };
  risks: RiskItem[];
  incidents: IncidentSummary;
  recommendations: Recommendation[];
  scorecard: WeeklyScorecard;
}

interface EventRow {
  portal_id: string;
  category: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  occurred_at: string;
}

interface SessionRow {
  id: string;
  portal_id: string;
  user_id: string | null;
  started_at: string;
}

interface UserRow {
  id: string;
  department: string | null;
  team: string | null;
}

const DAY = 86_400_000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function metricDelta(current: number, previous: number): MetricDelta {
  const deltaPct = pctChange(current, previous);
  return {
    value: current,
    previous,
    deltaPct,
    direction: deltaPct === null ? (current > 0 ? 'up' : 'flat') : deltaPct > 3 ? 'up' : deltaPct < -3 ? 'down' : 'flat',
  };
}

function titleize(value: string): string {
  return value
    .replace(/[-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function featureName(eventName: string): string | null {
  const feature = eventName.split('.')[0] ?? eventName;
  if (!feature || ['auth', 'navigation', 'session'].includes(feature)) return null;
  return feature;
}

function isError(row: EventRow): boolean {
  return row.category === 'error' || row.name.startsWith('error.');
}

function trendFromGrowth(current: number, previous: number, growthPct: number | null): Trend {
  if (current === 0) return 'Inactive';
  if (previous === 0 && current > 0) return 'New';
  if (growthPct !== null && growthPct >= 15) return 'Growing';
  if (growthPct !== null && growthPct <= -15) return 'Declining';
  return 'Stable';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFromScore(score: number, highRiskCount: number): Status {
  if (highRiskCount > 0 || score < 55) return 'critical';
  if (score < 75) return 'warning';
  return 'healthy';
}

function riskLabel(risks: RiskItem[]): WeeklyScorecard['risk'] {
  if (risks.some((risk) => risk.priority === 'high')) return 'High';
  if (risks.some((risk) => risk.priority === 'medium')) return 'Medium';
  return 'Low';
}

function capabilityNarrative(item: Omit<CapabilityInsight, 'narrative'>): string {
  const name = titleize(item.feature);
  if (item.usersLastWeek === 0 && item.usersThisWeek > 0) {
    return `${name} reached ${item.usersThisWeek} active user${item.usersThisWeek === 1 ? '' : 's'} this week, making it a newly adopted capability.`;
  }
  if (item.growthPct !== null && item.growthPct > 0) {
    return `${name} adoption increased to ${item.usersThisWeek} active user${item.usersThisWeek === 1 ? '' : 's'}, up ${item.growthPct}% from last week.`;
  }
  if (item.growthPct !== null && item.growthPct < 0) {
    return `${name} usage declined to ${item.usersThisWeek} active user${item.usersThisWeek === 1 ? '' : 's'}, down ${Math.abs(item.growthPct)}% from last week.`;
  }
  return `${name} remained stable with ${item.usersThisWeek} active user${item.usersThisWeek === 1 ? '' : 's'} this week.`;
}

function buildCapability(item: Omit<CapabilityInsight, 'narrative'>): CapabilityInsight {
  return { ...item, narrative: capabilityNarrative(item) };
}

function buildRecommendationFromRisk(risk: RiskItem): Recommendation {
  return {
    priority: risk.priority,
    title: risk.title,
    detail: risk.recommendedAction,
  };
}

export async function getInsights(): Promise<ExecutiveOperationsReport> {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const thisStart = new Date(now.getTime() - 7 * DAY);
  const previousStart = new Date(now.getTime() - 14 * DAY);

  const [
    eventsRes,
    sessionsRes,
    projectsRes,
    projectIntel,
    incidentBoard,
  ] = await Promise.all([
    admin
      .from('analytics_events')
      .select('portal_id, category, name, user_id, session_id, occurred_at')
      .gte('occurred_at', previousStart.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(12000),
    admin
      .from('analytics_sessions')
      .select('id, portal_id, user_id, started_at')
      .gte('started_at', previousStart.toISOString())
      .limit(12000),
    admin
      .from('analytics_projects')
      .select('slug, name, tracking_enabled')
      .eq('tracking_enabled', true),
    getProjectIntelligence().catch(() => []),
    getIncidents().catch(() => null),
  ]);

  if (eventsRes.error) throw new AppError('EXEC_REPORT_EVENTS_FAILED', eventsRes.error.message, 500);
  if (sessionsRes.error) throw new AppError('EXEC_REPORT_SESSIONS_FAILED', sessionsRes.error.message, 500);
  if (projectsRes.error) throw new AppError('EXEC_REPORT_PROJECTS_FAILED', projectsRes.error.message, 500);

  const events = ((eventsRes.data ?? []) as EventRow[]);
  const sessions = ((sessionsRes.data ?? []) as SessionRow[]);
  const projectNames = new Map<string, string>();
  for (const project of (projectsRes.data ?? []) as Array<{ slug: string; name: string | null }>) {
    projectNames.set(project.slug, project.name ?? titleize(project.slug));
  }
  for (const project of projectIntel) projectNames.set(project.slug, project.name);

  const userIds = Array.from(new Set(events.map((event) => event.user_id).filter(Boolean))) as string[];
  const usersRes = userIds.length
    ? await admin.from('analytics_users').select('id, department, team').in('id', userIds)
    : { data: [], error: null };
  if (usersRes.error) throw new AppError('EXEC_REPORT_USERS_FAILED', usersRes.error.message, 500);
  const usersById = new Map(((usersRes.data ?? []) as UserRow[]).map((user) => [user.id, user]));

  const thisEvents = events.filter((event) => event.occurred_at >= thisStart.toISOString());
  const lastEvents = events.filter((event) => event.occurred_at < thisStart.toISOString());
  const thisSessions = sessions.filter((session) => session.started_at >= thisStart.toISOString());
  const lastSessions = sessions.filter((session) => session.started_at < thisStart.toISOString());

  const thisUsers = new Set(thisEvents.map((event) => event.user_id).filter(Boolean) as string[]);
  const lastUsers = new Set(lastEvents.map((event) => event.user_id).filter(Boolean) as string[]);
  const returningUsers = Array.from(thisUsers).filter((id) => lastUsers.has(id)).length;
  const newUsers = Math.max(0, thisUsers.size - returningUsers);
  const thisLogins = thisEvents.filter((event) => event.name === 'auth.login').length;
  const lastLogins = lastEvents.filter((event) => event.name === 'auth.login').length;
  const thisFailures = thisEvents.filter((event) => event.name === 'auth.login_failed').length;
  const lastFailures = lastEvents.filter((event) => event.name === 'auth.login_failed').length;
  const thisErrors = thisEvents.filter(isError).length;
  const lastErrors = lastEvents.filter(isError).length;

  const projectHealthBySlug = new Map(projectIntel.map((project) => [project.slug, project]));
  const allSlugs = new Set<string>([
    ...projectNames.keys(),
    ...thisEvents.map((event) => event.portal_id),
    ...lastEvents.map((event) => event.portal_id),
    ...thisSessions.map((session) => session.portal_id),
  ]);

  const productRanking: ProductPerformanceRow[] = Array.from(allSlugs).map((slug) => {
    const currentEvents = thisEvents.filter((event) => event.portal_id === slug);
    const previousEvents = lastEvents.filter((event) => event.portal_id === slug);
    const currentSessions = thisSessions.filter((session) => session.portal_id === slug);
    const currentUsers = new Set(currentEvents.map((event) => event.user_id).filter(Boolean) as string[]);
    const previousUsers = new Set(previousEvents.map((event) => event.user_id).filter(Boolean) as string[]);
    const eventCount = currentEvents.length;
    const errorCount = currentEvents.filter(isError).length;
    const errorRate = eventCount > 0 ? errorCount / eventCount : 0;
    const reliabilityScore = clampScore(100 - errorRate * 100);
    const projectHealth = projectHealthBySlug.get(slug);
    const healthScore = clampScore(projectHealth?.healthScore ?? (0.55 * reliabilityScore + 0.45 * Math.min(100, currentUsers.size * 12)));
    const weeklyGrowthPct = pctChange(currentUsers.size, previousUsers.size);
    const trend = trendFromGrowth(currentUsers.size, previousUsers.size, weeklyGrowthPct);
    const name = projectNames.get(slug) ?? titleize(slug);
    const summary = `${name} is ${trend.toLowerCase()} with ${currentUsers.size} active user${currentUsers.size === 1 ? '' : 's'}, ${currentSessions.length} session${currentSessions.length === 1 ? '' : 's'}, and a ${reliabilityScore}/100 reliability score.`;
    return {
      slug,
      name,
      activeUsers: currentUsers.size,
      sessions: currentSessions.length,
      healthScore,
      trend,
      weeklyGrowthPct,
      errorCount,
      reliabilityScore,
      summary,
    };
  }).sort((a, b) => (b.healthScore + b.activeUsers * 2) - (a.healthScore + a.activeUsers * 2));

  const capabilityMap = new Map<string, { thisUsers: Set<string>; lastUsers: Set<string> }>();
  for (const event of events) {
    if (!event.user_id) continue;
    const feature = featureName(event.name);
    if (!feature) continue;
    const bucket = capabilityMap.get(feature) ?? { thisUsers: new Set<string>(), lastUsers: new Set<string>() };
    if (event.occurred_at >= thisStart.toISOString()) bucket.thisUsers.add(event.user_id);
    else bucket.lastUsers.add(event.user_id);
    capabilityMap.set(feature, bucket);
  }
  const capabilities = Array.from(capabilityMap.entries()).map(([feature, value]) => buildCapability({
    feature,
    usersThisWeek: value.thisUsers.size,
    usersLastWeek: value.lastUsers.size,
    growthPct: pctChange(value.thisUsers.size, value.lastUsers.size),
  }));
  const activeCapabilities = capabilities.filter((item) => item.usersThisWeek > 0 || item.usersLastWeek > 0);
  const mostUsed = activeCapabilities.filter((item) => item.usersThisWeek > 0).sort((a, b) => b.usersThisWeek - a.usersThisWeek)[0] ?? null;
  const leastUsed = activeCapabilities.filter((item) => item.usersThisWeek > 0).sort((a, b) => a.usersThisWeek - b.usersThisWeek)[0] ?? null;
  const fastestGrowing = activeCapabilities
    .filter((item) => item.growthPct === null ? item.usersThisWeek > 0 : item.growthPct > 0)
    .sort((a, b) => (b.growthPct ?? 999) - (a.growthPct ?? 999))[0] ?? null;
  const declining = activeCapabilities
    .filter((item) => item.growthPct !== null && item.growthPct < 0)
    .sort((a, b) => (a.growthPct ?? 0) - (b.growthPct ?? 0))[0] ?? null;
  const newlyAdopted = activeCapabilities.filter((item) => item.usersLastWeek === 0 && item.usersThisWeek > 0).slice(0, 5);

  const deptMap = new Map<string, {
    thisUsers: Set<string>;
    lastUsers: Set<string>;
    events: number;
    sessions: Set<string>;
  }>();
  for (const event of thisEvents) {
    if (!event.user_id) continue;
    const user = usersById.get(event.user_id);
    const department = user?.department || user?.team || 'Unassigned';
    const bucket = deptMap.get(department) ?? { thisUsers: new Set<string>(), lastUsers: new Set<string>(), events: 0, sessions: new Set<string>() };
    bucket.thisUsers.add(event.user_id);
    bucket.events += 1;
    if (event.session_id) bucket.sessions.add(event.session_id);
    deptMap.set(department, bucket);
  }
  for (const event of lastEvents) {
    if (!event.user_id) continue;
    const user = usersById.get(event.user_id);
    const department = user?.department || user?.team || 'Unassigned';
    const bucket = deptMap.get(department) ?? { thisUsers: new Set<string>(), lastUsers: new Set<string>(), events: 0, sessions: new Set<string>() };
    bucket.lastUsers.add(event.user_id);
    deptMap.set(department, bucket);
  }
  const departments = Array.from(deptMap.entries()).map(([department, value]) => {
    const growthPct = pctChange(value.thisUsers.size, value.lastUsers.size);
    const adoptionLabel = value.thisUsers.size >= 10 ? 'Broad adoption' : value.thisUsers.size >= 3 ? 'Moderate adoption' : 'Limited adoption';
    return {
      department,
      activeUsers: value.thisUsers.size,
      events: value.events,
      sessions: value.sessions.size,
      growthPct,
      adoptionLabel,
      summary: `${department} recorded ${value.events} event${value.events === 1 ? '' : 's'} from ${value.thisUsers.size} active user${value.thisUsers.size === 1 ? '' : 's'} this week, indicating ${adoptionLabel.toLowerCase()}.`,
    };
  }).sort((a, b) => b.events - a.events);

  const risks: RiskItem[] = [];
  if (thisFailures > 0) {
    risks.push({
      id: 'login-failures',
      priority: thisFailures >= 10 || lastFailures === 0 ? 'high' : 'medium',
      title: 'Login failures',
      current: thisFailures,
      previous: lastFailures,
      potentialCauses: ['Invalid credentials', 'Session expiration', 'Authentication service issues'],
      recommendedAction: 'Review authentication logs and confirm recent login/session changes.',
    });
  }
  if (thisErrors > 0) {
    risks.push({
      id: 'application-errors',
      priority: thisErrors >= 10 || thisErrors > lastErrors * 2 ? 'high' : 'medium',
      title: 'Application errors',
      current: thisErrors,
      previous: lastErrors,
      potentialCauses: ['Recent deployment regression', 'API or database failure', 'Unhandled frontend exception'],
      recommendedAction: 'Open the Error Intelligence Center and inspect the highest-impact grouped errors.',
    });
  }
  const lowestDepartment = departments.filter((department) => department.activeUsers > 0).sort((a, b) => a.activeUsers - b.activeUsers)[0] ?? null;
  if (lowestDepartment && lowestDepartment.activeUsers <= 2) {
    risks.push({
      id: `department-${lowestDepartment.department}`,
      priority: 'low',
      title: `${lowestDepartment.department} adoption`,
      current: lowestDepartment.activeUsers,
      previous: null,
      potentialCauses: ['Limited onboarding', 'Low awareness', 'Access not fully synchronized'],
      recommendedAction: `Increase onboarding and confirm access for ${lowestDepartment.department}.`,
    });
  }
  if (incidentBoard?.critical) {
    risks.push({
      id: 'critical-incidents',
      priority: 'high',
      title: 'Critical incidents',
      current: incidentBoard.critical,
      previous: null,
      potentialCauses: ['Critical project health issue', 'Authentication or database error pattern', 'Prolonged inactivity'],
      recommendedAction: 'Review Incident Management and assign owners for each critical incident.',
    });
  }

  const engagement: EngagementIntelligence = {
    activeUsers: metricDelta(thisUsers.size, lastUsers.size),
    sessions: metricDelta(thisSessions.length, lastSessions.length),
    logins: metricDelta(thisLogins, lastLogins),
    avgSessionsPerUser: thisUsers.size ? Math.round((thisSessions.length / thisUsers.size) * 10) / 10 : 0,
    avgLoginsPerUser: thisUsers.size ? Math.round((thisLogins / thisUsers.size) * 10) / 10 : 0,
    returningUsers,
    newUsers,
    trend: thisUsers.size === 0
      ? 'No measurable engagement'
      : metricDelta(thisUsers.size, lastUsers.size).direction === 'up'
        ? 'Stable Growth'
        : metricDelta(thisUsers.size, lastUsers.size).direction === 'down'
          ? 'Engagement Declining'
          : 'Stable',
  };

  const averageHealth = productRanking.length
    ? productRanking.reduce((sum, product) => sum + product.healthScore, 0) / productRanking.length
    : 0;
  const errorRate = thisEvents.length ? thisErrors / thisEvents.length : 0;
  const reliability = clampScore(100 - errorRate * 100);
  const engagementScore = clampScore(55 + (engagement.activeUsers.deltaPct ?? 0) * 0.6 + Math.min(25, engagement.avgSessionsPerUser * 8));
  const adoptionScore = clampScore(activeCapabilities.length ? activeCapabilities.reduce((sum, item) => sum + Math.min(100, item.usersThisWeek * 12), 0) / activeCapabilities.length : 0);
  const scoreSeed = Math.round((averageHealth * 0.35) + (engagementScore * 0.25) + (reliability * 0.25) + (adoptionScore * 0.15));
  const platformStatus = statusFromScore(scoreSeed, risks.filter((risk) => risk.priority === 'high').length);

  const executiveSummary = [
    `${thisUsers.size} active user${thisUsers.size === 1 ? '' : 's'} across ${productRanking.filter((product) => product.activeUsers > 0).length} product${productRanking.filter((product) => product.activeUsers > 0).length === 1 ? '' : 's'}.`,
    `${thisSessions.length} session${thisSessions.length === 1 ? '' : 's'} recorded with ${thisLogins} successful login${thisLogins === 1 ? '' : 's'}.`,
    mostUsed ? `${titleize(mostUsed.feature)} became the most-used capability with ${mostUsed.usersThisWeek} active user${mostUsed.usersThisWeek === 1 ? '' : 's'}.` : 'No capability adoption was recorded this week.',
    thisFailures > 0 ? `${thisFailures} login failure${thisFailures === 1 ? '' : 's'} detected.` : 'No login failures detected.',
    thisErrors > 0 ? `${thisErrors} application error${thisErrors === 1 ? '' : 's'} detected.` : 'No application errors detected.',
    incidentBoard?.critical ? `${incidentBoard.critical} critical incident${incidentBoard.critical === 1 ? '' : 's'} need attention.` : 'No critical incidents detected.',
  ];

  const recommendations = risks.length
    ? risks.slice(0, 5).map(buildRecommendationFromRisk)
    : [{
        priority: 'low' as const,
        title: 'Maintain operating rhythm',
        detail: 'No high-priority risks were detected. Continue monitoring weekly adoption and reliability trends.',
      }];

  const topProductSummaries = productRanking.slice(0, 4).map((product) => product.summary);
  const weakProducts = productRanking.filter((product) => product.healthScore < 70 || product.trend === 'Declining').slice(0, 2);
  const productIntelligence = [
    ...topProductSummaries,
    ...weakProducts.map((product) => `${product.name} needs management attention because health is ${product.healthScore}/100 and trend is ${product.trend.toLowerCase()}.`),
  ].slice(0, 6);

  return {
    week: {
      startDate: isoDate(thisStart),
      endDate: isoDate(now),
      previousStartDate: isoDate(previousStart),
      previousEndDate: isoDate(thisStart),
    },
    platformStatus,
    executiveSummary,
    productRanking,
    productIntelligence,
    adoption: {
      mostUsed,
      leastUsed: leastUsed?.feature === mostUsed?.feature ? null : leastUsed,
      fastestGrowing,
      declining,
      newlyAdopted,
    },
    engagement,
    departments: {
      mostActive: departments[0] ?? null,
      leastActive: departments.filter((department) => department.activeUsers > 0).sort((a, b) => a.activeUsers - b.activeUsers)[0] ?? null,
      rows: departments.slice(0, 8),
    },
    risks,
    incidents: {
      created: incidentBoard?.open ?? 0,
      resolved: incidentBoard?.resolvedToday ?? null,
      open: incidentBoard?.open ?? 0,
      critical: incidentBoard?.critical ?? 0,
      summary: incidentBoard?.critical
        ? `${incidentBoard.critical} critical incident${incidentBoard.critical === 1 ? '' : 's'} require immediate review.`
        : 'No critical incidents were detected this week.',
    },
    recommendations,
    scorecard: {
      platformHealth: clampScore(averageHealth),
      engagement: engagementScore,
      reliability,
      adoption: adoptionScore,
      risk: riskLabel(risks),
      overallStatus: platformStatus,
    },
  };
}
