import type { PortalId } from '@/types/analytics';

export interface PortalConfig {
  id: PortalId;
  name: string;
  description: string;
  color: string; // Tailwind hue (used for charts and badges)
}

/**
 * Registry of every internal portal that may send events to the analytics platform.
 * New portals must be registered here before they can be filtered or visualized.
 */
export const PORTALS: Record<string, PortalConfig> = {
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    description: 'Internal Sentinel project',
    color: 'violet',
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics Platform',
    description: 'This platform (self-reporting)',
    color: 'slate',
  },
};

export const PORTAL_LIST: readonly PortalConfig[] = Object.values(PORTALS);

const FALLBACK_COLORS = ['violet', 'sky', 'emerald', 'amber', 'rose', 'indigo', 'slate'];

/**
 * Resolve display config for ANY project slug. Projects are now dynamic
 * (analytics_projects), so unknown slugs get a deterministic generated config
 * instead of throwing/returning undefined. This keeps the platform generic —
 * no code change is needed when a new application is onboarded.
 */
export function getPortalConfig(id: string): PortalConfig {
  const known = PORTALS[id];
  if (known) return known;
  // Deterministic color from the slug so the same app always renders the same hue.
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const color = FALLBACK_COLORS[hash % FALLBACK_COLORS.length]!;
  const name = id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ');
  return { id, name, description: '', color };
}
