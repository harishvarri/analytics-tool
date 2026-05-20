import type { LucideIcon } from 'lucide-react';
import { Activity, BarChart3, GitBranch, LayoutDashboard, Network, Users } from 'lucide-react';
import { ROUTES } from '@/constants/routes';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  {
    label: 'Overview',
    href: ROUTES.dashboard,
    icon: LayoutDashboard,
    description: 'High-level platform health and KPIs',
  },
  {
    label: 'Users',
    href: ROUTES.users,
    icon: Users,
    description: 'User-level analytics and engagement',
  },
  {
    label: 'Portals',
    href: ROUTES.portals,
    icon: Network,
    description: 'Per-portal usage and performance',
  },
  {
    label: 'Workflows',
    href: ROUTES.workflows,
    icon: GitBranch,
    description: 'Cycle time, throughput, bottlenecks and aging tickets',
  },
  {
    label: 'Realtime',
    href: ROUTES.realtime,
    icon: Activity,
    description: 'Live activity feed across all portals',
  },
  {
    label: 'Reports',
    href: ROUTES.reports,
    icon: BarChart3,
    description: 'Generated analytics reports',
  },
] as const;
