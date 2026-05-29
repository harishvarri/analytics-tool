import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Filter,
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
 * Sidebar information architecture.
 *
 * Grouped by INTENT (what question you're answering) rather than by data
 * source, and deliberately kept generic so any application — web app, CRM,
 * training portal, admin tool — sees the same, meaningful set of views with no
 * code changes. Nothing here assumes a specific product's domain.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: null,
    items: [
      {
        label: 'Overview',
        href: ROUTES.dashboard,
        icon: LayoutDashboard,
        description: 'Platform-wide KPIs, trends, and health',
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
    label: 'Organization',
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
        label: 'Funnels',
        href: ROUTES.funnels,
        icon: Filter,
        description: 'Step-by-step conversion and drop-off',
      },
      {
        label: 'Journeys',
        href: ROUTES.journeys,
        icon: Route,
        description: 'User flow paths (Sankey)',
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
        label: 'Users',
        href: ROUTES.users,
        icon: Users,
        description: 'User-level activity and engagement',
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
    label: 'Operations',
    items: [
      {
        label: 'Reliability',
        href: ROUTES.reliability,
        icon: ShieldCheck,
        description: 'Error groups, error rate, SLO budget',
      },
      {
        label: 'Performance',
        href: ROUTES.performance,
        icon: Gauge,
        description: 'Page load, TTFB, slow routes, engagement',
      },
      {
        label: 'Anomalies',
        href: ROUTES.anomalies,
        icon: AlertTriangle,
        description: 'Statistical alerts on metric deviations',
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

/** Backwards-compatible flat list used by the mobile sheet menu. */
export const PRIMARY_NAV: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
