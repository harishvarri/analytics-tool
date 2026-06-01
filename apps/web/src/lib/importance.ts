/**
 * Event importance classification — app-side mirror of the SQL rules in
 * migration 0027 (`classify_importance` + `analytics_event_importance_rules`).
 *
 * This lets the ingest path stamp `metadata._importance` at write-time WITHOUT
 * a DB round-trip. The SQL function remains the source of truth for backfills
 * and the retention job; keep the two in sync when editing rules.
 *
 * Tiers (highest → lowest business value):
 *   business_critical — auth, money, documents, entity create/complete (kept forever)
 *   important         — errors and failures (ops-relevant)
 *   normal            — interactions, feature use, route changes
 *   debug             — page views, performance/diagnostics (feed noise, ages out)
 */

export type ImportanceTier = 'business_critical' | 'important' | 'normal' | 'debug';

export const IMPORTANCE_TIERS: readonly ImportanceTier[] = [
  'business_critical',
  'important',
  'normal',
  'debug',
] as const;

/** Rank for threshold comparisons — lower number = more important. */
export const TIER_RANK: Record<ImportanceTier, number> = {
  business_critical: 0,
  important: 1,
  normal: 2,
  debug: 3,
};

interface Rule {
  category: string | null; // null = any category
  test: (name: string) => boolean;
  tier: ImportanceTier;
  priority: number;
}

const startsWith = (p: string) => (n: string) => n.startsWith(p);
const endsWith = (p: string) => (n: string) => n.endsWith(p);
const equals = (p: string) => (n: string) => n === p;

// Mirror of the seeded rows in 0027. Highest priority wins; ties → most specific.
const RULES: Rule[] = [
  // business_critical
  { category: 'auth', test: equals('auth.login'), tier: 'business_critical', priority: 900 },
  { category: 'auth', test: equals('auth.logout'), tier: 'business_critical', priority: 900 },
  { category: 'auth', test: equals('auth.signup'), tier: 'business_critical', priority: 900 },
  { category: null, test: endsWith('.created'), tier: 'business_critical', priority: 800 },
  { category: null, test: endsWith('.completed'), tier: 'business_critical', priority: 800 },
  { category: null, test: endsWith('.submitted'), tier: 'business_critical', priority: 780 },
  { category: null, test: startsWith('payment.'), tier: 'business_critical', priority: 850 },
  { category: null, test: endsWith('.generated'), tier: 'business_critical', priority: 760 },
  { category: null, test: startsWith('candidate.'), tier: 'business_critical', priority: 740 },
  { category: null, test: startsWith('interview.'), tier: 'business_critical', priority: 740 },
  { category: null, test: startsWith('attendance.'), tier: 'business_critical', priority: 720 },
  // important
  { category: 'error', test: () => true, tier: 'important', priority: 600 },
  { category: null, test: endsWith('.failed'), tier: 'important', priority: 620 },
  { category: null, test: endsWith('.deleted'), tier: 'important', priority: 580 },
  // debug
  { category: 'navigation', test: equals('navigation.page_view'), tier: 'debug', priority: 300 },
  { category: 'navigation', test: equals('navigation.time_on_page'), tier: 'debug', priority: 300 },
  { category: null, test: startsWith('performance.'), tier: 'debug', priority: 250 },
  // normal
  { category: 'navigation', test: () => true, tier: 'normal', priority: 120 },
  { category: 'interaction', test: () => true, tier: 'normal', priority: 120 },
  { category: 'feature', test: () => true, tier: 'normal', priority: 120 },
];

const DEFAULT_TIER: ImportanceTier = 'normal';

/**
 * Classify an event into an importance tier. Mirrors the SQL `classify_importance`.
 */
export function classifyImportance(category: string, name: string): ImportanceTier {
  let best: Rule | null = null;
  for (const r of RULES) {
    if (r.category !== null && r.category !== category) continue;
    if (!r.test(name)) continue;
    if (!best || r.priority > best.priority) best = r;
  }
  return best?.tier ?? DEFAULT_TIER;
}

/** True if `tier` is at least as important as `threshold` (e.g. hide 'debug'). */
export function meetsThreshold(tier: ImportanceTier, threshold: ImportanceTier): boolean {
  return TIER_RANK[tier] <= TIER_RANK[threshold];
}
