import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Filter,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  MonitorSmartphone,
  Network,
  Repeat2,
  Route,
  Rows3,
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
  label: string | null;       // null = unlabelled (top section)
  items: readonly NavItem[];
}

/**
 * Sidebar information architecture, modelled after enterprise analytics
 * platforms (Datadog, Mixpanel, PostHog). Grouped by intent rather than data
 * source so adding a new project/app does not require restructuring nav.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: null,
    items: [
      {
        label: 'Overview',
        href: ROUTES.dashboard,
        icon: LayoutDashboard,
        description: 'Platform-wide KPIs and health',
      },
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
    label: 'Intelligence',
    items: [
      {
        label: 'Smart Insights',
        href: ROUTES.insights,
        icon: Lightbulb,
        description: 'Auto-generated week-over-week insights',
      },
      {
        label: 'Journeys',
        href: ROUTES.journeys,
        icon: Route,
        description: 'Customer journey flow (Sankey)',
      },
      {
        label: 'Workflows',
        href: ROUTES.workflows,
        icon: GitBranch,
        description: 'Cycle time, throughput, bottlenecks',
      },
      {
        label: 'Projects',
        href: ROUTES.projects,
        icon: FolderKanban,
        description: 'Project Health Index portfolio',
      },
      {
        label: 'Retention',
        href: ROUTES.retention,
        icon: Repeat2,
        description: 'Cohort retention and dormant users',
      },
      {
        label: 'Anomalies',
        href: ROUTES.anomalies,
        icon: AlertTriangle,
        description: 'Statistical alerts on metric deviations',
      },
      {
        label: 'Features',
        href: ROUTES.features,
        icon: Sparkles,
        description: 'Feature adoption rates, sparklines, and decay curves',
      },
      {
        label: 'Funnels',
        href: ROUTES.funnels,
        icon: Filter,
        description: 'Step-by-step conversion and drop-off analysis',
      },
      {
        label: 'Audience',
        href: ROUTES.audience,
        icon: MonitorSmartphone,
        description: 'Device, browser, OS, language, and region breakdowns',
      },
      {
        label: 'Reliability',
        href: ROUTES.reliability,
        icon: ShieldCheck,
        description: 'Error groups, error rate, and SLO budget burn',
      },
    ],
  },
  {
    label: 'Realtime',
    items: [
      {
        label: 'Live Feed',
        href: ROUTES.live,
        icon: Activity,
        description: 'Streaming event tail across all apps',
      },
      {
        label: 'Users',
        href: ROUTES.users,
        icon: Users,
        description: 'User-level activity and engagement',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Reports',
        href: ROUTES.reports,
        icon: BarChart3,
        description: 'Saved and scheduled reports',
      },
    ],
  },
] as const;

/** Backwards-compatible flat list used by the mobile sheet menu. */
export const PRIMARY_NAV: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
