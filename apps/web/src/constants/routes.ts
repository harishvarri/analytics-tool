export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  users: '/dashboard/users',
  applications: '/dashboard/portals',         // existing route, generic label
  live: '/dashboard/realtime',                // existing route, generic label
  retention: '/dashboard/retention',
  anomalies: '/dashboard/anomalies',
  features:  '/dashboard/features',
  reliability: '/dashboard/reliability',
  audience:  '/dashboard/audience',
  journeys:  '/dashboard/journeys',
  compare:   '/dashboard/compare',
  insights:  '/dashboard/insights',
  performance: '/dashboard/performance',
  people:    '/dashboard/people',
  access:    '/dashboard/access',
  health:    '/dashboard/health',
  departments: '/dashboard/departments',
  operations: '/dashboard/operations',
  manageProjects: '/dashboard/admin/projects',
  login: '/login',
  // Legacy aliases — kept for any external links/bookmarks
  portals: '/dashboard/portals',
  realtime: '/dashboard/realtime',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
