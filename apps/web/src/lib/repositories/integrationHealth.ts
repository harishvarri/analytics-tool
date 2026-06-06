import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { getProjectIntelligence } from './projectIntelligence';

/**
 * Integration Health & Data Quality Center.
 *
 * Answers, per product: "is tracking actually wired up — script, events, users,
 * errors, business events?" — and rolls up org-wide data-quality gaps. This is
 * the recurring "are errors/events tracking?" question, made into a dashboard.
 */

export interface IntegrationChecks {
  scriptInstalled: boolean;   // any events have ever arrived
  eventsFlowing: boolean;     // events in the last 7 days
  usersIdentified: boolean;   // at least one event from a named (email) user
  errorsCaptured: boolean;    // at least one error event seen
  businessEvents: boolean;    // operational/business events in last 7 days
}

export interface IntegrationProject {
  slug: string;
  name: string;
  score: number;              // 0–100 integration completeness
  checks: IntegrationChecks;
  events7d: number;
  activeUsers7d: number;
  businessEvents7d: number;
  lastActivityAt: string | null;
  missing: string[];          // human-readable gaps
}

export interface DataQuality {
  totalUsers: number;
  namedUsers: number;
  anonymousUsers: number;
  anonymousPct: number;
  productsTotal: number;
  productsMissingBusinessEvents: number;
  productsInactive: number;
  productsWithoutIdentifiedUsers: number;
}

export interface IntegrationHealth {
  avgScore: number;
  projects: IntegrationProject[];
  dataQuality: DataQuality;
}

const WEIGHTS = { scriptInstalled: 30, eventsFlowing: 25, usersIdentified: 25, businessEvents: 15, errorsCaptured: 5 };

export async function getIntegrationHealth(): Promise<IntegrationHealth> {
  const admin = getSupabaseAdmin();

  const [projects, lastActRes, usersRes] = await Promise.all([
    getProjectIntelligence(),
    admin.from('v_project_last_activity').select('project_slug, events_7d'),
    admin.from('analytics_users').select('id, email'),
  ]);

  const events7dBySlug = new Map<string, number>();
  for (const r of (lastActRes.data ?? []) as Record<string, unknown>[]) {
    events7dBySlug.set(String(r.project_slug), Number(r.events_7d ?? 0));
  }

  const allUsers = (usersRes.data ?? []) as { id: string; email: string | null }[];
  const totalUsers = allUsers.length;
  const namedIds = allUsers.filter((u) => u.email).map((u) => u.id);
  const namedUsers = namedIds.length;

  // Which products have at least one event from a named (identified) user?
  const identifiedPortals = new Set<string>();
  if (namedIds.length) {
    const { data: idEvents } = await admin
      .from('analytics_events')
      .select('portal_id')
      .in('user_id', namedIds)
      .limit(5000);
    for (const r of (idEvents ?? []) as { portal_id: string }[]) identifiedPortals.add(String(r.portal_id));
  }

  const out: IntegrationProject[] = projects.map((p) => {
    const events7d = events7dBySlug.get(p.slug) ?? 0;
    const checks: IntegrationChecks = {
      scriptInstalled: p.lastActivityAt !== null,
      eventsFlowing: events7d > 0,
      usersIdentified: identifiedPortals.has(p.slug),
      errorsCaptured: p.errors30d > 0,
      businessEvents: p.businessEvents7d > 0,
    };
    const score = Math.round(
      (checks.scriptInstalled ? WEIGHTS.scriptInstalled : 0) +
      (checks.eventsFlowing ? WEIGHTS.eventsFlowing : 0) +
      (checks.usersIdentified ? WEIGHTS.usersIdentified : 0) +
      (checks.businessEvents ? WEIGHTS.businessEvents : 0) +
      (checks.errorsCaptured ? WEIGHTS.errorsCaptured : 0),
    );
    const missing: string[] = [];
    if (!checks.scriptInstalled) missing.push('Tracking script not detected (no events ever received)');
    else if (!checks.eventsFlowing) missing.push('No events in the last 7 days');
    if (!checks.usersIdentified) missing.push('No identified users — call ncpl.identify(null, { email, name }) on login');
    if (!checks.businessEvents) missing.push('No business events — track key actions (e.g. ncpl.track("ticket.created"))');
    if (!checks.errorsCaptured) missing.push('No errors captured yet (fine if none occurred; tag with errorType when they do)');

    return {
      slug: p.slug, name: p.name, score, checks,
      events7d, activeUsers7d: p.activeUsers7d, businessEvents7d: p.businessEvents7d,
      lastActivityAt: p.lastActivityAt, missing,
    };
  }).sort((a, b) => a.score - b.score);

  const dataQuality: DataQuality = {
    totalUsers,
    namedUsers,
    anonymousUsers: totalUsers - namedUsers,
    anonymousPct: totalUsers > 0 ? Math.round(((totalUsers - namedUsers) / totalUsers) * 100) : 0,
    productsTotal: projects.length,
    productsMissingBusinessEvents: out.filter((p) => !p.checks.businessEvents).length,
    productsInactive: out.filter((p) => !p.checks.eventsFlowing).length,
    productsWithoutIdentifiedUsers: out.filter((p) => !p.checks.usersIdentified).length,
  };

  const avgScore = out.length ? Math.round(out.reduce((s, p) => s + p.score, 0) / out.length) : 0;

  return { avgScore, projects: out, dataQuality };
}
