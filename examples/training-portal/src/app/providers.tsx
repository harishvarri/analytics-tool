'use client';

/**
 * App-level analytics provider for the Training Portal.
 *
 * Mounts the SDK provider, fires a pageview on every App Router navigation
 * via usePathname, and identifies the user once the session is known.
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnalyticsProvider, useAnalytics } from '@ncpl/analytics-sdk/react';
import { analytics } from '@/lib/analytics';

interface ProvidersProps {
  children: ReactNode;
  user: { id: string; email: string } | null;
}

export function Providers({ children, user }: ProvidersProps) {
  // Reuse the singleton — don't let the provider construct a second client.
  return (
    <AnalyticsProvider
      client={analytics}
      portalId="training"
      endpoint={analytics.options.endpoint}
    >
      <Identity user={user} />
      <RouteTracker />
      {children}
    </AnalyticsProvider>
  );
}

function Identity({ user }: { user: ProvidersProps['user'] }) {
  const a = useAnalytics();
  useEffect(() => {
    if (user) a.identify(user.id);
    else a.reset();
  }, [a, user]);
  return null;
}

function RouteTracker() {
  const a = useAnalytics();
  const pathname = usePathname();
  useEffect(() => {
    a.trackPageView(pathname);
  }, [a, pathname]);
  return null;
}
