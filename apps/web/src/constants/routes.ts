export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  users: '/dashboard/users',
  portals: '/dashboard/portals',
  realtime: '/dashboard/realtime',
  reports: '/dashboard/reports',
  workflows: '/dashboard/workflows',
  projects: '/dashboard/projects',
  login: '/login',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
