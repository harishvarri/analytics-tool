import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  BellRing,
  Bug,
  Building2,
  HeartPulse,
  KeyRound,
  Radio,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Timer,
  TrendingUp,
  UserRound,
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
 * NCPL Operational Intelligence — sidebar information architecture.
 *
 * Organised around four management concerns:
 *   1. Top-level pulse (unlabelled)
 *   2. Our Products  — per-product health and usage
 *   3. People & Teams — staff engagement and activity
 *   4. Operations    — system errors, speed, unusual activity, highlights
 *   5. Admin         — product onboarding and keys
 *
 * Pages removed from nav (routes still alive):
 *   /dashboard/users     — redundant with Staff Directory
 *   /dashboard/features  — too granular for current audiences
 *   /dashboard/audience  — device/browser irrelevant for internal staff tool
 *   /dashboard/journeys  — too technical; Sankey not a stated management need
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: null,
    items: [
      {
        label: 'Org Overview',
        href: ROUTES.dashboard,
        icon: Building2,
        description: 'All products at a glance — activity, sign-ins, errors, and health',
      },
      {
        label: 'Live Activity',
        href: ROUTES.live,
        icon: Radio,
        description: 'A live stream of what staff are doing right now',
      },
    ],
  },
  {
    label: 'Our Products',
    items: [
      {
        label: 'All Products',
        href: ROUTES.applications,
        icon: AppWindow,
        description: 'Usage and activity for every connected product',
      },
      {
        label: 'Product Comparison',
        href: ROUTES.compare,
        icon: SlidersHorizontal,
        description: 'Which products are thriving, underused, or have quality problems',
      },
      {
        label: 'Project Health',
        href: ROUTES.health,
        icon: HeartPulse,
        description: 'A single 0–100 health score per product — problems first',
      },
      {
        label: 'Access Analytics',
        href: ROUTES.access,
        icon: KeyRound,
        description: 'Who has access to each product versus who actually uses it',
      },
    ],
  },
  {
    label: 'People & Teams',
    items: [
      {
        label: 'Staff Directory',
        href: ROUTES.people,
        icon: UserRound,
        description: 'Who is using which products and when they were last active',
      },
      {
        label: 'Department Analytics',
        href: ROUTES.departments,
        icon: Building2,
        description: 'Engagement and headcount broken down by department and team',
      },
      {
        label: 'Engagement Trends',
        href: ROUTES.retention,
        icon: TrendingUp,
        description: 'Are staff coming back? Daily, weekly, and monthly patterns',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'System Errors',
        href: ROUTES.reliability,
        icon: Bug,
        description: 'Errors staff are hitting, their frequency, and quality targets',
      },
      {
        label: 'Response Times',
        href: ROUTES.performance,
        icon: Timer,
        description: 'How fast products load and which pages are slowest',
      },
      {
        label: 'Unusual Activity',
        href: ROUTES.anomalies,
        icon: BellRing,
        description: 'Automatic alerts when any product behaves abnormally',
      },
      {
        label: 'Weekly Highlights',
        href: ROUTES.insights,
        icon: Sparkles,
        description: 'What changed meaningfully across products this week',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Connected Products',
        href: ROUTES.manageProjects,
        icon: Settings2,
        description: 'Onboard products and manage their tracking keys',
      },
    ],
  },
] as const;

/** Flat list used by the mobile sheet menu. */
export const PRIMARY_NAV: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
