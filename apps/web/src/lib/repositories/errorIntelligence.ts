import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import type { RealtimeActivityItem, EventCategory } from '@/types/analytics';

/**
 * Error Intelligence — turns raw error events into operational answers:
 * what kind of errors, which projects, how many users impacted, and where the
 * pain is concentrated. Categorisation reads an explicit metadata.errorType
 * when the app supplies one, else infers from the message/name.
 */

export type ErrorCategory =
  | 'api' | 'database' | 'authentication' | 'authorization' | 'network' | 'frontend';

const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  api: 'API errors', database: 'Database errors', authentication: 'Authentication errors',
  authorization: 'Authorization errors', network: 'Network errors', frontend: 'Frontend errors',
};

/** Operationally "critical" categories (infra/security), used for severity. */
const CRITICAL_CATEGORIES = new Set<ErrorCategory>(['database', 'authentication', 'api']);

function categorize(name: string, meta: Record<string, unknown> | null): ErrorCategory {
  const explicit = String((meta?.['errorType'] ?? meta?.['error_type'] ?? meta?.['category'] ?? '') as string).toLowerCase();
  if (explicit) {
    if (explicit.includes('db') || explicit.includes('database') || explicit.includes('sql')) return 'database';
    if (explicit.includes('auth') && explicit.includes('z')) return 'authorization';
    if (explicit.includes('auth') || explicit.includes('login') || explicit.includes('token')) return 'authentication';
    if (explicit.includes('api') || explicit.includes('http') || explicit.includes('server')) return 'api';
    if (explicit.includes('network') || explicit.includes('cors') || explicit.includes('offline')) return 'network';
    if (explicit.includes('front') || explicit.includes('ui') || explicit.includes('render')) return 'frontend';
  }
  const lname = (name || '').toLowerCase();
  if (lname.includes('login_failed') || lname.startsWith('auth.')) return 'authentication';

  const msg = String((meta?.['message'] ?? meta?.['errorMessage'] ?? '') as string).toLowerCase();
  const hay = `${lname} ${msg}`;
  if (/\b(database|db|sql|postgres|pg|connection (refused|timeout)|deadlock)\b/.test(hay)) return 'database';
  if (/\b(401|unauthor|token|session expired|login|credential)\b/.test(hay)) return 'authentication';
  if (/\b(403|forbidden|permission|access denied)\b/.test(hay)) return 'authorization';
  if (/\b(timeout|5\d\d|api|fetch|request failed|endpoint|gateway)\b/.test(hay)) return 'api';
  if (/\b(network|cors|offline|dns|econnreset|connection)\b/.test(hay)) return 'network';
  return 'frontend';
}

export interface ErrorIntelligence {
  windowDays: number;
  totalErrors: number;
  criticalErrors: number;
  usersImpacted: number;
  projectsImpacted: number;
  activeIncidents: number;           // distinct project×critical-category in last 24h
  categories: { category: ErrorCategory; label: string; count: number; users: number; critical: boolean }[];
  byProject: { slug: string; errors: number; users: number; topCategory: ErrorCategory | null }[];
  timeline: (RealtimeActivityItem & { errorCategory: ErrorCategory })[];
}

const DAY = 86_400_000;

export async function getErrorIntelligence(days = 7): Promise<ErrorIntelligence> {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - days * DAY).toISOString();

  // Errors + auth failures. Match by category='error' OR an error.* event name
  // (so manual ncpl.track('error.captured', …) — which sends category 'custom' —
  // is still counted), plus auth.login_failed which is an auth error.
  const { data, error } = await admin
    .from('analytics_events')
    .select('id, portal_id, category, name, user_id, session_id, url, metadata, occurred_at')
    .or('category.eq.error,name.like.error*,name.eq.auth.login_failed')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(3000);
  if (error) throw new AppError('ERROR_INTEL_FAILED', error.message, 500);
  const rows = (data ?? []) as Record<string, unknown>[];

  // Enrich users for the timeline.
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const userMap = new Map<string, { email: string | null; display_name: string | null }>();
  if (ids.length) {
    const { data: users } = await admin.from('analytics_users').select('id, email, display_name').in('id', ids);
    (users ?? []).forEach((u: Record<string, unknown>) =>
      userMap.set(String(u.id), { email: (u.email as string | null) ?? null, display_name: (u.display_name as string | null) ?? null }));
  }

  const dayAgo = Date.now() - DAY;
  const catAgg = new Map<ErrorCategory, { count: number; users: Set<string> }>();
  const projAgg = new Map<string, { errors: number; users: Set<string>; cats: Map<ErrorCategory, number> }>();
  const usersAll = new Set<string>();
  const incidents = new Set<string>();
  let criticalErrors = 0;

  const timeline: (RealtimeActivityItem & { errorCategory: ErrorCategory })[] = [];

  for (const r of rows) {
    const meta = (r.metadata as Record<string, unknown> | null) ?? null;
    const cat = categorize(String(r.name), meta);
    const uid = r.user_id ? String(r.user_id) : null;
    const slug = String(r.portal_id);
    const occurred = String(r.occurred_at);

    const ca = catAgg.get(cat) ?? { count: 0, users: new Set<string>() };
    ca.count += 1; if (uid) ca.users.add(uid); catAgg.set(cat, ca);

    const pa = projAgg.get(slug) ?? { errors: 0, users: new Set<string>(), cats: new Map<ErrorCategory, number>() };
    pa.errors += 1; if (uid) pa.users.add(uid); pa.cats.set(cat, (pa.cats.get(cat) ?? 0) + 1); projAgg.set(slug, pa);

    if (uid) usersAll.add(uid);
    if (CRITICAL_CATEGORIES.has(cat)) criticalErrors += 1;
    if (CRITICAL_CATEGORIES.has(cat) && new Date(occurred).getTime() >= dayAgo) incidents.add(`${slug}|${cat}`);

    if (timeline.length < 60) {
      const u = uid ? userMap.get(uid) : undefined;
      timeline.push({
        id: String(r.id), portalId: slug, portalName: slug,
        category: r.category as EventCategory, eventName: String(r.name),
        userId: uid, userEmail: u?.email ?? null, userDisplayName: u?.display_name ?? null,
        sessionId: r.session_id ? String(r.session_id) : null, url: (r.url as string | null) ?? null,
        occurredAt: occurred, metadata: meta, errorCategory: cat,
      });
    }
  }

  const categories = (Object.keys(CATEGORY_LABEL) as ErrorCategory[])
    .map((c) => ({ category: c, label: CATEGORY_LABEL[c], count: catAgg.get(c)?.count ?? 0, users: catAgg.get(c)?.users.size ?? 0, critical: CRITICAL_CATEGORIES.has(c) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const byProject = Array.from(projAgg.entries())
    .map(([slug, v]) => {
      const topCategory = Array.from(v.cats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { slug, errors: v.errors, users: v.users.size, topCategory };
    })
    .sort((a, b) => b.errors - a.errors);

  return {
    windowDays: days,
    totalErrors: rows.length,
    criticalErrors,
    usersImpacted: usersAll.size,
    projectsImpacted: projAgg.size,
    activeIncidents: incidents.size,
    categories,
    byProject,
    timeline,
  };
}

export { CATEGORY_LABEL };
