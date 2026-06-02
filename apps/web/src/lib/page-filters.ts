/**
 * Declares which global filters each dashboard route actually supports, so the
 * topbar can HIDE filters a page doesn't honor instead of showing misleading UI.
 *
 *   app   — the Application/Product scope (?app=<slug>)
 *   range — the time-range picker (?range=24h|7d|30d|90d)
 *
 * The legacy "Project" sub-filter was removed: it was wired to nothing and only
 * ever rendered a misleading "No projects yet" placeholder.
 */
export interface PageFilterSupport {
  app: boolean;
  range: boolean;
}

const NONE: PageFilterSupport = { app: false, range: false };

// Longest-prefix match wins. Order from most specific to least.
const RULES: Array<{ prefix: string; support: PageFilterSupport }> = [
  { prefix: '/dashboard/admin', support: NONE },
  { prefix: '/dashboard/realtime', support: NONE },            // live stream — no scoping
  { prefix: '/dashboard/insights', support: NONE },            // fixed week-over-week
  { prefix: '/dashboard/anomalies', support: NONE },           // platform-wide signals
  { prefix: '/dashboard/health', support: NONE },              // all-products snapshot
  // Range is only advertised where the underlying query actually honors it.
  // Pages backed by fixed-window SQL views (reliability/performance/compare/
  // retention) expose just the app filter so we don't show a control that lies.
  { prefix: '/dashboard/access', support: { app: false, range: true } },
  { prefix: '/dashboard/departments', support: { app: false, range: true } },
  { prefix: '/dashboard/compare', support: { app: true, range: false } },
  { prefix: '/dashboard/people', support: { app: true, range: false } },
  { prefix: '/dashboard/reliability', support: { app: true, range: false } },
  { prefix: '/dashboard/performance', support: { app: true, range: false } },
  { prefix: '/dashboard/retention', support: { app: true, range: false } },
  { prefix: '/dashboard/logins', support: { app: true, range: true } },
  { prefix: '/dashboard/sessions', support: { app: true, range: true } },
  // Org Overview is a "today" command center (KPIs + 24h chart) — app scope only.
  { prefix: '/dashboard', support: { app: true, range: false } },
];

export function filtersForPath(pathname: string): PageFilterSupport {
  for (const r of RULES) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/') || pathname.startsWith(r.prefix + '?')) {
      return r.support;
    }
  }
  // Anything outside /dashboard: no filters.
  return NONE;
}
