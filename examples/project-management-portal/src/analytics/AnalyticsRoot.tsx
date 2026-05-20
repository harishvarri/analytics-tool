/**
 * Provider + router-aware pageview tracker for a React Router SPA.
 * Wrap your <App /> with this once.
 */
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AnalyticsProvider, useAnalytics } from '@ncpl/analytics-sdk/react';
import { analytics } from './client';
import { useAuth } from '@/auth/use-auth'; // your app's auth hook

export function AnalyticsRoot({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider client={analytics} portalId="project-management" endpoint={analytics.options.endpoint}>
      <RouteTracker />
      <IdentitySync />
      {children}
    </AnalyticsProvider>
  );
}

function RouteTracker() {
  const a = useAnalytics();
  const { pathname } = useLocation();
  useEffect(() => {
    a.trackPageView(pathname);
  }, [a, pathname]);
  return null;
}

function IdentitySync() {
  const a = useAnalytics();
  const { user } = useAuth();
  useEffect(() => {
    if (user) {
      a.identify(user.id);
    } else {
      a.reset();
    }
  }, [a, user]);
  return null;
}
