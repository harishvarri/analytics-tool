import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Gauge,
  LayoutDashboard,
  Network,
  Repeat2,
  Rows3,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavSection {
  label: string | null; // null = unlabelled (top section)
  items: readonly NavItem[];
}

/**
 * Sidebar IA — a lean internal operational-intelligence command center, scoped
 * to what an organisation actually needs to monitor its internal apps: activity,
 * usage, people/logins, and health. Fully event-driven, per app, no SSO.
 *
 * (Audience / Smart Insights / Anomalies / Journeys were trimmed as non-essential
 * marketing/advanced extras — their pages still exist and can be re-listed here.)
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: null,
    items: [
      {
        label: 'Command Center',
        href: ROUTES.dashboard,
        icon: LayoutDashboard,
        description: 'All apps at a glance — activity, logins, errors, and health',
      },
      {
        label: 'Live Feed',
        href: ROUTES.live,
        icon: Activity,
        description: 'Streaming event tail across all apps',
      },
    ],
  },
  {
    label: 'Applications',
    items: [
      {
        label: 'Applications',
        href: ROUTES.applications,
        icon: Network,
        description: 'Per-application usage and performance',
      },
      {
        label: 'Cross-Project',
        href: ROUTES.compare,
        icon: Rows3,
        description: 'Compare every application side by side',
      },
    ],
  },
  {
    label: 'Usage',
    items: [
      {
        label: 'Features',
        href: ROUTES.features,
        icon: Sparkles,
        description: 'Which features people actually use',
      },
      {
        label: 'Retention',
        href: ROUTES.retention,
        icon: Repeat2,
        description: 'DAU/WAU/MAU, returning users, dormancy',
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        label: 'People',
        href: ROUTES.people,
        icon: Users,
        description: 'Who uses each app, and each person’s activity',
      },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      {
        label: 'Reliability',
        href: ROUTES.reliability,
        icon: ShieldCheck,
        description: 'Errors, API failures, error rate, and health',
      },
      {
        label: 'Performance',
        href: ROUTES.performance,
        icon: Gauge,
        description: 'Page load, server response, slow routes',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Projects',
        href: ROUTES.manageProjects,
        icon: Settings2,
        description: 'Onboard applications and manage API keys',
      },
    ],
  },
] as const;

/** Flat list used by the mobile sheet menu. */
export const PRIMARY_NAV: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
