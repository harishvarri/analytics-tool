/**
 * @ncpl/analytics-sdk — reusable typed event tracking for NCPL internal portals.
 *
 * Two entry points:
 *   import { AnalyticsClient } from '@ncpl/analytics-sdk';            // framework-agnostic
 *   import { AnalyticsProvider, useAnalytics } from '@ncpl/analytics-sdk/react';
 */

export { AnalyticsClient, type AnalyticsClientOptions, type AutoTrackOptions } from './core/client';
export { getDeviceContext, getNavigationTiming, type NavigationTimingMetrics } from './utils/context';
export { EVENT_NAMES } from './events/names';
export type {
  PortalId,
  EventCategory,
  EventSource,
  TrackEventInput,
  AnalyticsEventPayload,
} from './events/types';

export const SDK_VERSION = '0.1.0';
