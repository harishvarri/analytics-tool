import type { ErrorCategory } from './errorIntelligence';

/**
 * ============================================================================
 *  Reliability Score — pure scoring model (no DB, no other repos)
 * ============================================================================
 * The single mathematical definition of Health = System Reliability. Kept
 * dependency-free so BOTH the Reliability Health engine and Project
 * Intelligence can import it without creating a circular dependency.
 *
 *   Health = 100 − Σ category penalties − incident penalty   (floored at 0)
 */

// Penalty per category = min(cap, ceil(errorCount × weight)). Critical infra/
// security categories cost more per error and may do more total damage.
export const SEVERITY_WEIGHT: Record<ErrorCategory, number> = {
  database:       2.5,
  api:            2.0,
  authentication: 1.7,
  authorization:  1.3,
  network:        1.3,
  frontend:       1.0,
};
export const CATEGORY_CAP: Record<ErrorCategory, number> = {
  database:       30,
  api:            30,
  authentication: 25,
  authorization:  15,
  network:        15,
  frontend:       20,
};

// Open/investigating incidents add a bounded penalty on top of raw errors.
export const INCIDENT_PENALTY = { openCritical: 8, investigatingCritical: 5, openOther: 4, investigatingOther: 2 };
export const INCIDENT_PENALTY_CAP = 25;

// Operational severity per error category (mirrors incidents.ts) — drives the
// incident penalty tier (critical vs other).
export const CATEGORY_SEVERITY: Record<ErrorCategory, 'critical' | 'high' | 'medium'> = {
  database: 'critical', authentication: 'critical', api: 'high',
  authorization: 'medium', network: 'high', frontend: 'medium',
};

export function categoryPenalty(cat: ErrorCategory, errors: number): number {
  if (errors <= 0) return 0;
  return Math.min(CATEGORY_CAP[cat], Math.ceil(errors * SEVERITY_WEIGHT[cat]));
}

// ── Status thresholds (reliability-based) ───────────────────────────────────
//   Healthy  ≥ 90   no significant issues
//   Warning  70–89  minor issues detected
//   Critical < 70   users actively impacted
export type HealthStatus = 'healthy' | 'warning' | 'critical';
export function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'warning';
  return 'critical';
}

/**
 * Deterministic incident short-id — identical hash to incidents.ts so we can
 * look up an auto-detected incident's persisted lifecycle status by key.
 */
export function incidentKey(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `INC-${h.toString(36).toUpperCase().slice(0, 6).padStart(6, '0')}`;
}

/**
 * Normalize an error message into a stable signature — a 1:1 JS mirror of the
 * SQL `error_fingerprint` (migration 0011) so an event bucketed in the health
 * engine produces the SAME fingerprint as the v_error_groups view. Keep both in
 * sync if either changes.
 */
export function errorFingerprint(msg: string | null | undefined): string {
  let s = (msg ?? 'unknown error').toLowerCase();
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>'); // UUIDs
  s = s.replace(/0x[0-9a-f]+/g, '<hex>');        // hex literals
  s = s.replace(/'[^']*'|"[^"]*"/g, '<str>');    // quoted strings
  s = s.replace(/\d+/g, '<n>');                  // bare numbers
  s = s.replace(/\s+/g, ' ').trim();             // collapse whitespace
  return s || 'unknown error';
}

/**
 * Lifecycle key for a single error signature (group). Lets an error group be
 * resolved/closed in the same incident_status store as category incidents,
 * without colliding (prefixed seed).
 */
export function errorGroupKey(fingerprint: string): string {
  return incidentKey(`fp|${fingerprint}`);
}
