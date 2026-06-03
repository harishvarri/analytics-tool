import 'server-only';
import { getProjectIntelligence, type ProjectIntelligence } from './projectIntelligence';
import { getDepartmentRollup } from './operational';

/**
 * Organization Health Engine — the single calculated score that answers
 * "is the organization healthy right now, and what needs attention today?"
 *
 * Composes signals already produced by the Project / Department intelligence
 * layers into one weighted score, then derives the executive landing surface:
 * attention items + plain-English recommendations. No new data model required.
 *
 *   Health = 0.30 Project Health
 *          + 0.25 Incident severity (critical/warning projects)
 *          + 0.20 Error impact (error rates across products)
 *          + 0.15 User adoption
 *          + 0.10 Department engagement
 */

export type OrgTier = 'healthy' | 'warning' | 'at_risk' | 'critical';

export interface AttentionItem {
  kind: 'project_at_risk' | 'error_spike' | 'adoption_drop' | 'critical_alert' | 'inactive_project';
  title: string;
  detail: string;
  slug: string | null;       // project slug for drill-through (if applicable)
  severity: 'critical' | 'warning' | 'info';
}

export interface OrgHealth {
  score: number;
  tier: OrgTier;
  riskScore: number;        // 100 − score
  criticalIssues: number;
  activeIncidents: number;  // proxy: critical projects + critical alerts
  affectedUsers: number;
  components: {
    projectHealth: number;
    incidentSeverity: number;
    errorImpact: number;
    userAdoption: number;
    departmentEngagement: number;
  };
  attention: AttentionItem[];
  recommendations: string[];
  totals: { projects: number; healthy: number; warning: number; critical: number };
}

function tierOf(score: number): OrgTier {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'at_risk';
  return 'critical';
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function getOrganizationHealth(): Promise<OrgHealth> {
  const [projects, deptRollup] = await Promise.all([
    getProjectIntelligence(),
    getDepartmentRollup().catch(() => []),
  ]);

  const n = projects.length;
  const healthy = projects.filter((p) => p.status === 'healthy').length;
  const warning = projects.filter((p) => p.status === 'warning').length;
  const critical = projects.filter((p) => p.status === 'critical').length;

  // ── Component scores (each 0–100) ───────────────────────────────────────────
  const projectHealth = Math.round(avg(projects.map((p) => p.healthScore)));

  // Incident severity proxy: penalise critical/warning projects (no incidents
  // table yet — see Incident Management epic).
  const incidentSeverityClamped = Math.max(0, Math.min(100, 100 - (critical * 30 + warning * 12)));

  // Error impact: average error rate across products → invert.
  const errorImpact = Math.max(0, Math.round(100 - Math.min(100, avg(projects.map((p) => p.errorRatePct)) * 8)));

  // User adoption: average adoption % across products.
  const userAdoption = Math.round(avg(projects.map((p) => p.adoptionPct)));

  // Department engagement: % of directory staff that are active.
  const totalStaff = deptRollup.reduce((s, d) => s + d.totalUsers, 0);
  const activeStaff = deptRollup.reduce((s, d) => s + d.activeUsers, 0);
  const departmentEngagement = totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 60;

  const components = {
    projectHealth,
    incidentSeverity: incidentSeverityClamped,
    errorImpact,
    userAdoption,
    departmentEngagement,
  };

  const score = Math.round(
    0.30 * components.projectHealth +
    0.25 * components.incidentSeverity +
    0.20 * components.errorImpact +
    0.15 * components.userAdoption +
    0.10 * components.departmentEngagement,
  );

  // ── Attention items ─────────────────────────────────────────────────────────
  const attention: AttentionItem[] = [];

  for (const p of projects) {
    if (p.status === 'critical') {
      attention.push({
        kind: 'project_at_risk', slug: p.slug, severity: 'critical',
        title: `${p.name} is critical`, detail: p.alerts[0] ?? p.issues[0] ?? `Health ${p.healthScore}/100`,
      });
    } else if (p.status === 'warning') {
      attention.push({
        kind: 'project_at_risk', slug: p.slug, severity: 'warning',
        title: `${p.name} needs attention`, detail: p.issues[0] ?? `Health ${p.healthScore}/100`,
      });
    }
    if (p.errorRatePct >= 2) {
      attention.push({
        kind: 'error_spike', slug: p.slug, severity: p.errorRatePct >= 5 ? 'critical' : 'warning',
        title: `Errors elevated in ${p.name}`, detail: `${p.errorRatePct}% error rate · ${p.errors30d} errors (30d)`,
      });
    }
    if (p.adoptionPct > 0 && p.adoptionPct < 30) {
      attention.push({
        kind: 'adoption_drop', slug: p.slug, severity: 'warning',
        title: `Low adoption in ${p.name}`, detail: `${p.adoptionPct}% of people with access use it`,
      });
    }
    if (p.daysSinceActivity !== null && p.daysSinceActivity >= 7) {
      attention.push({
        kind: 'inactive_project', slug: p.slug, severity: p.daysSinceActivity >= 14 ? 'critical' : 'warning',
        title: `${p.name} has gone quiet`, detail: `No activity for ${p.daysSinceActivity} days`,
      });
    }
    for (const alert of p.alerts) {
      attention.push({ kind: 'critical_alert', slug: p.slug, severity: 'critical', title: `${p.name}: ${alert}`, detail: 'Critical alert' });
    }
  }

  // Critical first, then warning, then info; de-dupe by title.
  const order = { critical: 0, warning: 1, info: 2 } as const;
  const seen = new Set<string>();
  const sortedAttention = attention
    .filter((a) => (seen.has(a.title) ? false : (seen.add(a.title), true)))
    .sort((a, b) => order[a.severity] - order[b.severity]);

  // ── Executive recommendations (actionable, plain English) ───────────────────
  const recommendations: string[] = [];
  for (const p of projects) {
    if (p.errorRatePct >= 2) recommendations.push(`Investigate errors in ${p.name} (${p.errorRatePct}% error rate).`);
    if (p.daysSinceActivity !== null && p.daysSinceActivity >= 14) recommendations.push(`Follow up on ${p.name} — unused for ${p.daysSinceActivity} days.`);
    else if (p.adoptionPct > 0 && p.adoptionPct < 30) recommendations.push(`Drive adoption in ${p.name} — only ${p.adoptionPct}% of staff with access use it.`);
    if (p.failedLogins7d >= 10) recommendations.push(`Review authentication failures in ${p.name} (${p.failedLogins7d} failed logins this week).`);
  }
  if (recommendations.length === 0) recommendations.push('No urgent actions — all products are operating within healthy ranges.');

  const affectedUsers = projects
    .filter((p) => p.status !== 'healthy')
    .reduce((s, p) => s + p.activeUsers7d, 0);

  return {
    score,
    tier: tierOf(score),
    riskScore: 100 - score,
    criticalIssues: critical + sortedAttention.filter((a) => a.severity === 'critical').length,
    activeIncidents: critical + projects.reduce((s, p) => s + p.alerts.length, 0),
    affectedUsers,
    components,
    attention: sortedAttention.slice(0, 20),
    recommendations: recommendations.slice(0, 8),
    totals: { projects: n, healthy, warning, critical },
  };
}

export type { ProjectIntelligence };
