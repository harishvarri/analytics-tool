import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AppWindow,
  BellRing,
  Bug,
  Building2,
  Gauge,
  HeartPulse,
  Plug,
  Radio,
  Settings2,
  SlidersHorizontal,
  Sparkles,
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
    ],
  },
  {
    label: 'People & Teams',
    items: [
      {
        label: 'Staff Intelligence',
        href: ROUTES.people,
        icon: UserRound,
        description: 'Who is working, what they do, and who has gone quiet',
      },
      {
        label: 'Engagement Intelligence',
        href: ROUTES.retention,
        icon: TrendingUp,
        description: 'Active vs quiet staff, growing vs declining products',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Executive Operations Center',
        href: ROUTES.operations,
        icon: Gauge,
        description: 'Org health score, what needs attention today, and recommended actions',
      },
      {
        label: 'Error Intelligence Center',
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
        label: 'Weekly Highlights',
        href: ROUTES.insights,
        icon: Sparkles,
        description: 'What changed meaningfully across products this week',
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
