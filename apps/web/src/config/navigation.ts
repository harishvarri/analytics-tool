import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AppWindow,
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
 * Retired in the consolidation pass (deleted — redundant/low-value):
 *   /dashboard/users     — redundant with Staff Directory
 *   /dashboard/features  — too granular for current audiences
 *   /dashboard/audience  — device/browser irrelevant for internal staff tool
 *
 * Drill-down routes (live, reached from cards/tables, intentionally not in nav):
 *   /dashboard/projects/[slug], /people/[userId], /sessions, /health/[slug],
 *   /logins, /operations
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: null,
    items: [
      {
        label: 'Executive Dashboard',
        href: ROUTES.dashboard,
        icon: Gauge,
        description: 'Command center — who is active, top users, product health, risks, and recommended actions',
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
        label: 'Operations Center',
        href: ROUTES.incidents,
        icon: AlertOctagon,
        description: 'Incidents and error intelligence in one place — what is failing, its impact, and how to act',
      },
      {
        label: 'Operations Report',
        href: ROUTES.insights,
        icon: Sparkles,
        description: 'Weekly & monthly operational intelligence — users, products, reliability, and risk',
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
        description: 'Is each product tracking script, events, users, errors, and operational events',
      },
    ],
  },
] as const;

/** Flat list used by the mobile sheet menu. */
export const PRIMARY_NAV: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
