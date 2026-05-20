'use client';

import { AnalyticsClient } from '@ncpl/analytics-sdk';
import { env } from './env';

let cached: AnalyticsClient | null = null;

/**
 * The analytics platform self-reports its own activity using the same SDK
 * every portal consumes. Construct lazily so the client only spins up in
 * the browser.
 */
export function getAnalytics(): AnalyticsClient {
  if (!cached) {
    cached = new AnalyticsClient({
      portalId: 'analytics',
      endpoint: `${env.NEXT_PUBLIC_APP_URL}/api/v1/events`,
      debug: process.env.NODE_ENV !== 'production',
      defaults: { app: 'ncpl-analytics-web' },
    });
  }
  return cached;
}
