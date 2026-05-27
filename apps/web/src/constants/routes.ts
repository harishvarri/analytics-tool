export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  users: '/dashboard/users',
  applications: '/dashboard/portals',         // existing route, generic label
  live: '/dashboard/realtime',                // existing route, generic label
  reports: '/dashboard/reports',
  workflows: '/dashboard/workflows',
  projects: '/dashboard/projects',
  retention: '/dashboard/retention',
  anomalies: '/dashboard/anomalies',
  features:  '/dashboard/features',
  reliability: '/dashboard/reliability',
  audience:  '/dashboard/audience',
  funnels:   '/dashboard/funnels',
  journeys:  '/dashboard/journeys',
  compare:   '/dashboard/compare',
  insights:  '/dashboard/insights',
  login: '/login',
  // Legacy aliases — kept for any external links/bookmarks
  portals: '/dashboard/portals',
  realtime: '/dashboard/realtime',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
