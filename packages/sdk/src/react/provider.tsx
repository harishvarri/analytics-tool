'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { AnalyticsClient, type AnalyticsClientOptions } from '../core/client';

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export interface AnalyticsProviderProps extends AnalyticsClientOptions {
  children: ReactNode;
  /** Pass an existing client (e.g. created at module scope) instead of constructing one. */
  client?: AnalyticsClient;
}

/**
 * React provider. Use ONE per portal at the app root.
 *
 *   <AnalyticsProvider portalId="training" endpoint="/api/v1/events">
 *     <App />
 *   </AnalyticsProvider>
 */
export function AnalyticsProvider({ children, client, ...options }: AnalyticsProviderProps) {
  const instance = useMemo(() => client ?? new AnalyticsClient(options), [
    client,
    // Re-create only if endpoint/portal changes. Other options are config-time.
    options.portalId,
    options.endpoint,
  ]);

  useEffect(() => {
    return () => {
      // If we constructed it, we own its lifecycle.
      if (!client) instance.destroy();
    };
  }, [client, instance]);

  return <AnalyticsContext.Provider value={instance}>{children}</AnalyticsContext.Provider>;
}

/** Internal accessor used by hooks. */
export function useAnalyticsContext(): AnalyticsClient {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error(
      'AnalyticsProvider missing. Wrap your tree with <AnalyticsProvider portalId=… endpoint=…>.',
    );
  }
  return ctx;
}
