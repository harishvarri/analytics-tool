import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  MonitorSmartphone,
  Network,
  Repeat2,
  Route,
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
 * Sidebar IA — an internal operational-intelligence command center. Grouped by
 * the question each section answers, and fully event-driven: every view works
 * per individual app from the events that app sends (no SSO/central directory).
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
      {
        label: 'Smart Insights',
        href: ROUTES.insights,
        icon: Lightbulb,
        description: 'Auto-generated week-over-week insights',
      },
    ],
  },
  {
    label: 'Behavior',
    items: [
      {
        label: 'Journeys',
        href: ROUTES.journeys,
        icon: Route,
        description: 'The pages people move through, step by step',
      },
      {
        label: 'Features',
        href: ROUTES.features,
        icon: Sparkles,
        description: 'Feature adoption, stickiness, and decay',
      },
      {
        label: 'Retention',
        href: ROUTES.retention,
        icon: Repeat2,
        description: 'DAU/WAU/MAU, cohorts, and dormant users',
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
      {
        label: 'Audience',
        href: ROUTES.audience,
        icon: MonitorSmartphone,
        description: 'Device, browser, OS, language, region',
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
      {
        label: 'Anomalies',
        href: ROUTES.anomalies,
        icon: AlertTriangle,
        description: 'Automatic alerts when activity spikes or drops',
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
