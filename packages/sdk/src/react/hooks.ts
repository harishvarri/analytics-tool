'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AnalyticsClient } from '../core/client';
import { useAnalyticsContext } from './provider';

/** Returns the bound AnalyticsClient. */
export function useAnalytics(): AnalyticsClient {
  return useAnalyticsContext();
}

/**
 * Fires `navigation.page_view` whenever `path` changes. Pass the current
 * pathname (e.g. `usePathname()` in Next.js); pass `undefined` to use
 * `window.location.href` at fire-time.
 */
export function useTrackPageView(path?: string): void {
  const analytics = useAnalyticsContext();
  const last = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (last.current === path) return;
    last.current = path;
    analytics.trackPageView(path);
  }, [analytics, path]);
}

/**
 * Memoized convenience tracker for custom events. Stable identity so it can
 * safely live in dependency arrays.
 */
export function useTrackEvent() {
  const analytics = useAnalyticsContext();
  return useCallback(
    (name: string, metadata?: Record<string, unknown>) =>
      analytics.trackCustomEvent(name, metadata),
    [analytics],
  );
}
