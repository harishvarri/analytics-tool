import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AppWindow,
  BellRing,
  Bug,
  Gauge,
  HeartPulse,
  Plug,
  Radio,
  Route,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavSection {
  label: string | null;
  items: readonly NavItem[];
}

/**
 * NCPL Operational Intelligence — sidebar information architecture (P1 redesign).
 *
 * Five clear, scalable groups, each a distinct "lens" on the platform:
 *   1. Executive Intelligence — what happened, what changed, what to do
 *   2. User Intelligence      — who is working, how they move, how productive
 *   3. Product Intelligence   — product health, comparison, usage/adoption
 *   4. Operations             — errors, incidents, risk, performance
 *   5. Integrations           — onboarding products & tracking health
 *
 * Single-source-of-truth rule: a metric has ONE owning page; other pages link
 * to it rather than re-rendering it.
 *
 * Drill-down routes intentionally NOT in nav (reached from KPI cards):
 *   /dashboard/sessions   — from "Sessions today"
 *   /dashboard/logins     — from "Sign-ins"
 *   /dashboard/operations — Org-health detail, from the dashboard health card
 *   /dashboard/projects/[slug], /people/[userId], /departments/[dept] — entity detail
 *
 * Merged / retired (see P2): access, audience, departments, features → folded
 * into Product Analytics / Productivity Insights. users → 301 to people.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: 'Executive Intelligence',
    items: [
      {
        label: 'Executive Dashboard',
        href: ROUTES.dashboard,
        icon: Gauge,
        description: 'Command center — who is active, top users, product health, risks, and actions',
      },
      {
        label: 'Live Activity',
        href: ROUTES.live,
        icon: Radio,
        description: 'A live stream of what staff are doing right now',
      },
      {
        label: 'Weekly Report',
        href: ROUTES.insights,
        icon: Sparkles,
        description: 'The narrative weekly operations report — what changed and why',
      },
    ],
  },
  {
    label: 'User Intelligence',
    items: [
      {
        label: 'Staff Intelligence',
        href: ROUTES.people,
        icon: UserRound,
        description: 'Who is working, what they do, time spent, and who has gone quiet',
      },
      {
        label: 'User Journeys',
        href: ROUTES.journeys,
        icon: Route,
        description: 'How people move through the products — common paths and flows',
      },
      {
        label: 'Productivity Insights',
        href: ROUTES.retention,
        icon: TrendingUp,
        description: 'Most/least active staff, productivity scores, and team engagement',
      },
    ],
  },
  {
    label: 'Product Intelligence',
    items: [
      {
        label: 'Product Health',
        href: ROUTES.health,
        icon: HeartPulse,
        description: 'A single 0–100 health score per product — problems first',
      },
      {
        label: 'Product Comparison',
        href: ROUTES.compare,
        icon: SlidersHorizontal,
        description: 'Which products are thriving, underused, or have quality problems',
      },
      {
        label: 'Product Analytics',
        href: ROUTES.applications,
        icon: AppWindow,
        description: 'Usage, adoption, and feature activity for every connected product',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Error Intelligence',
        href: ROUTES.reliability,
        icon: Bug,
        description: 'Categorized errors, who they impact, and which products are worst hit',
      },
      {
        label: 'Incident Management',
        href: ROUTES.incidents,
        icon: AlertOctagon,
        description: 'Auto-detected incidents with impact and recommended action',
      },
      {
        label: 'Risk & Anomaly',
        href: ROUTES.anomalies,
        icon: BellRing,
        description: 'Error spikes, usage drops, and abnormal activity that need a look',
      },
      {
        label: 'Performance',
        href: ROUTES.performance,
        icon: Zap,
        description: 'Page speed, server response times, and the slowest routes',
      },
    ],
  },
  {
    label: 'Integrations',
    items: [
      {
        label: 'Connected Products',
        href: ROUTES.manageProjects,
        icon: Settings2,
        description: 'Onboard products and manage their tracking keys',
      },
      {
        label: 'Integration Health',
        href: ROUTES.integrations,
        icon: Plug,
        description: 'Is each product tracking script, events, users, errors, and business events',
      },
    ],
  },
] as const;

/** Flat list used by the mobile sheet menu. */
export const PRIMARY_NAV: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
