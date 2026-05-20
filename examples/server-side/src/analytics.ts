/**
 * Server-side analytics client. Use from Node services, cron jobs, webhook
 * handlers, etc. Source is stamped 'server' so the dashboard can distinguish
 * machine-generated events from user actions.
 *
 * The SDK works in Node 18+ (native fetch). Always set `apiKey` here — the
 * server has access to the shared secret; the browser does not.
 */
import { AnalyticsClient } from '@ncpl/analytics-sdk';

if (!process.env.ANALYTICS_ENDPOINT) {
  throw new Error('ANALYTICS_ENDPOINT is required');
}
if (!process.env.ANALYTICS_API_KEY) {
  throw new Error('ANALYTICS_API_KEY is required');
}

export const analytics = new AnalyticsClient({
  portalId: 'job-application',
  endpoint: process.env.ANALYTICS_ENDPOINT,
  apiKey: process.env.ANALYTICS_API_KEY,
  debug: process.env.NODE_ENV !== 'production',
  defaults: {
    service: process.env.SERVICE_NAME ?? 'unknown',
    release: process.env.RELEASE_SHA ?? 'dev',
  },
});

// Flush before the process exits so we don't drop the tail of the queue.
process.on('beforeExit', () => {
  void analytics.flush();
});
process.on('SIGTERM', () => {
  void analytics.flush().finally(() => process.exit(0));
});
