'use client';

/**
 * Forward client-side runtime errors to the analytics platform.
 * Drop this anywhere above your feature tree. Pair with a server-side
 * captureError hook for full coverage.
 */
import { Component, type ReactNode } from 'react';
import { analytics } from '@/lib/analytics';

interface State {
  hasError: boolean;
}

export class AnalyticsErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    analytics.trackError(error, { componentStack: info.componentStack });
  }

  override render() {
    if (this.state.hasError) {
      return <div role="alert">Something went wrong. The error has been reported.</div>;
    }
    return this.props.children;
  }
}
