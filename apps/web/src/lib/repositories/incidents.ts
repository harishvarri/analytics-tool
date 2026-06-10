import 'server-only';
import { getErrorIntelligence, type ErrorCategory } from './errorIntelligence';
import { getProjectIntelligence } from './projectIntelligence';
import { getSupabaseAdmin } from '../supabase/admin';
import { errorGroupKey } from './reliabilityScore';
import { getPortalConfig } from '@/config/portals';

/**
 * Incident Management (auto-detected, read-only v1).
 *
 * Real incidents are derived from the operational signals we already compute:
 *   - error clusters per product (critical category = an incident), and
 *   - critical project conditions (outages / prolonged inactivity).
 *
 * This gives a useful, populated incident board today. Full lifecycle
 * (assign owner, acknowledge, resolve, MTTR) needs a persisted `incidents`
 * table + admin write actions — tracked as the next step. Fields that require
 * persistence (resolvedToday, mttr) are returned as null and shown as "—".
 */

export type IncidentSeverity = 'critical' | 'high' | 'medium';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export const INCIDENT_STATUSES: IncidentStatus[] = ['open', 'investigating', 'resolved', 'closed'];
/** Statuses that still count as an active problem. */
const ACTIVE_STATUSES = new Set<IncidentStatus>(['open', 'investigating']);

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  projectSlug: string;
  projectName: string;
  usersAffected: number;
  occurrences: number;
  category: string;
  rootCause: string;
  recommendedAction: string;
  detectedAt: string;
  statusUpdatedAt: string | null;
}

export interface IncidentBoard {
  open: number;
  critical: number;
  projectsAtRisk: number;
  usersAffected: number;
  resolvedToday: number | null;
  mttrMinutes: number | null;   // needs full event log; still null
  incidents: Incident[];        // active (open + investigating)
  resolved: Incident[];         // resolved + closed
}

/**
 * Read persisted statuses for the given incident keys. Defensive: if the
 * incident_status table does not exist yet (migration 0036 not applied), this
 * returns an empty map so every incident simply shows as "open" and the page
 * keeps working.
 */
async function readIncidentStatuses(keys: string[]): Promise<Map<string, { status: IncidentStatus; updatedAt: string }>> {
  const map = new Map<string, { status: IncidentStatus; updatedAt: string }>();
  if (keys.length === 0) return map;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('incident_status')
      .select('incident_key, status, updated_at')
      .in('incident_key', keys);
    if (error) return map;
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      map.set(String(r.incident_key), { status: String(r.status) as IncidentStatus, updatedAt: String(r.updated_at) });
    }
  } catch { /* table missing — treat all as open */ }
  return map;
}

const CATEGORY_SEVERITY: Record<ErrorCategory, IncidentSeverity> = {
  database: 'critical', authentication: 'critical', api: 'high',
  authorization: 'medium', network: 'high', frontend: 'medium',
};

const CATEGORY_ACTION: Record<ErrorCategory, string> = {
  database: 'Check database connectivity, connection pool, and recent migrations.',
  authentication: 'Review the authentication service and token/session handling.',
  api: 'Investigate failing API endpoints and upstream timeouts.',
  authorization: 'Audit role/permission configuration for affected users.',
  network: 'Check network reachability, CORS, and third-party availability.',
  frontend: 'Review the latest frontend deploy for runtime exceptions.',
};

function shortId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `INC-${h.toString(36).toUpperCase().slice(0, 6).padStart(6, '0')}`;
}

export async function getIncidents(): Promise<IncidentBoard> {
  const [errors, projects] = await Promise.all([
    getErrorIntelligence(7).catch(() => null),
    getProjectIntelligence().catch(() => []),
  ]);

  const incidents: Incident[] = [];
  const projectName = (slug: string) => {
    try { return getPortalConfig(slug).name; } catch { return slug; }
  };

  // 1) Per-product error category → an incident (one per project's worst area).
  if (errors) {
    for (const p of errors.byProject) {
      if (!p.topCategory || p.errors === 0) continue;
      const cat = p.topCategory;
      const sample = errors.timeline.find((t) => t.portalId === p.slug && t.errorCategory === cat);
      const rootCause = (sample?.metadata?.['message'] as string | undefined) ?? `${cat} errors detected`;
      incidents.push({
        id: shortId(`${p.slug}|${cat}`),
        title: `${projectName(p.slug)} — ${cat} errors`,
        severity: CATEGORY_SEVERITY[cat],
        status: 'open',
        projectSlug: p.slug,
        projectName: projectName(p.slug),
        usersAffected: p.users,
        occurrences: p.errors,
        category: cat,
        rootCause: rootCause.slice(0, 160),
        recommendedAction: CATEGORY_ACTION[cat],
        detectedAt: sample?.occurredAt ?? new Date().toISOString(),
        statusUpdatedAt: null,
      });
    }
  }

  // 2) Prolonged inactivity / outage → incident. Driven by activity (an
  //    operational signal) rather than the reliability health status, since
  //    health is now reliability-only and inactivity is an engagement concern.
  for (const p of projects) {
    const inactive = p.daysSinceActivity === null || p.daysSinceActivity >= 14;
    if (!inactive) continue;
    const alert = p.alerts.find((a) => a.toLowerCase().includes('used')) ?? p.alerts[0]
      ?? (p.daysSinceActivity === null ? 'No activity recorded yet' : `No activity for ${p.daysSinceActivity} days`);
    const id = shortId(`${p.slug}|status`);
    if (incidents.some((i) => i.id === id)) continue;
    incidents.push({
      id,
      title: `${p.name} — ${alert}`,
      severity: 'critical',
      status: 'open',
      projectSlug: p.slug,
      projectName: p.name,
      usersAffected: p.activeUsers7d,
      occurrences: p.errors30d,
      category: 'project',
      rootCause: alert,
      recommendedAction: 'Confirm the product is reachable and that tracking is still installed.',
      detectedAt: p.lastActivityAt ?? new Date().toISOString(),
      statusUpdatedAt: null,
    });
  }

  // Merge persisted lifecycle status (defensive — empty if migration not applied).
  const statuses = await readIncidentStatuses(incidents.map((i) => i.id));
  for (const inc of incidents) {
    const s = statuses.get(inc.id);
    if (s) { inc.status = s.status; inc.statusUpdatedAt = s.updatedAt; }
  }

  const sevRank = { critical: 0, high: 1, medium: 2 } as const;
  const bySeverity = (a: Incident, b: Incident) => sevRank[a.severity] - sevRank[b.severity] || b.usersAffected - a.usersAffected;

  const active = incidents.filter((i) => ACTIVE_STATUSES.has(i.status)).sort(bySeverity);
  const resolved = incidents.filter((i) => !ACTIVE_STATUSES.has(i.status))
    .sort((a, b) => new Date(b.statusUpdatedAt ?? 0).getTime() - new Date(a.statusUpdatedAt ?? 0).getTime());

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const resolvedToday = resolved.filter((i) => i.statusUpdatedAt && new Date(i.statusUpdatedAt).getTime() >= startOfToday.getTime()).length;

  return {
    open: active.length,
    critical: active.filter((i) => i.severity === 'critical').length,
    projectsAtRisk: new Set(active.map((i) => i.projectSlug)).size,
    usersAffected: active.reduce((s, i) => s + i.usersAffected, 0),
    resolvedToday: statuses.size > 0 ? resolvedToday : null,
    mttrMinutes: null,
    incidents: active,
    resolved,
  };
}

/**
 * Set an incident's lifecycle status. Returns false if persistence isn't
 * available yet (migration 0036 not applied) so the caller can surface it.
 */
export async function setIncidentStatus(incidentKey: string, status: IncidentStatus, note?: string): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdmin()
      .from('incident_status')
      .upsert({ incident_key: incidentKey, status, note: note ?? null, updated_at: new Date().toISOString() }, { onConflict: 'incident_key' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Current lifecycle status for a set of error signatures (groups), keyed by
 * fingerprint. Defaults missing/unknown rows to 'open'. Safe if migration 0036
 * isn't applied yet (returns all 'open').
 */
export async function getErrorGroupStatuses(fingerprints: string[]): Promise<Map<string, IncidentStatus>> {
  const out = new Map<string, IncidentStatus>();
  if (fingerprints.length === 0) return out;
  const keyToFp = new Map<string, string>();
  for (const fp of fingerprints) keyToFp.set(errorGroupKey(fp), fp);
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('incident_status')
      .select('incident_key, status')
      .in('incident_key', Array.from(keyToFp.keys()));
    if (!error) {
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const fp = keyToFp.get(String(r.incident_key));
        if (fp) out.set(fp, String(r.status) as IncidentStatus);
      }
    }
  } catch { /* table missing — treat all as open */ }
  for (const fp of fingerprints) if (!out.has(fp)) out.set(fp, 'open');
  return out;
}
