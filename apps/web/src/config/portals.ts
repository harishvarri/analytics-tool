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
export const PORTALS: Record<PortalId, PortalConfig> = {
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
