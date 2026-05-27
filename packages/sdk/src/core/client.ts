import type { AnalyticsEventPayload, PortalId, TrackEventInput } from '../events/types';
import { EVENT_NAMES } from '../events/names';
import { createLogger, type Logger } from '../utils/logger';
import { getDeviceContext, getNavigationTiming } from '../utils/context';
import { detectStorage, type KVStorage } from './storage';
import { SessionManager } from './session';
import { HttpTransport } from './transport';
import { EventQueue } from './queue';

/**
 * Auto-tracking toggles. `true` enables all; an object enables selectively.
 * Defaults to ON in the browser so developers get page views, route changes,
 * errors, device context, performance, and engagement with zero extra code.
 */
export interface AutoTrackOptions {
  pageViews?: boolean;     // initial + SPA route-change page views
  routeChanges?: boolean;  // history pushState/replaceState/popstate
  errors?: boolean;        // window error + unhandledrejection
  performance?: boolean;   // Navigation Timing on load
  engagement?: boolean;    // visible time per page, flushed on hide
  deviceContext?: boolean; // attach browser/os/device to every event
}

export interface AnalyticsClientOptions {
  /** Portal calling the SDK. Required — set once per portal. */
  portalId: PortalId;
  /** Full URL of the ingestion endpoint, e.g. https://analytics.ncpl.internal/api/v1/events */
  endpoint: string;
  /** Optional shared secret. Stamped on requests as `x-ncpl-api-key`. */
  apiKey?: string;
  /** Enable verbose console output. Off in production. */
  debug?: boolean;
  /** Disable all event sending — useful for E2E tests. */
  disabled?: boolean;
  /** Override queue tuning. */
  batchSize?: number;
  flushIntervalMs?: number;
  /** Inject custom storage (defaults to localStorage / memory). */
  storage?: KVStorage;
  /** Inject custom fetch (defaults to globalThis.fetch). */
  fetchImpl?: typeof fetch;
  /** Default metadata merged into every event (release, env, build). */
  defaults?: Record<string, unknown>;
  /** Called when a batch is permanently dropped after retries. */
  onDrop?: (events: AnalyticsEventPayload[], reason: string) => void;
  /**
   * Browser auto-tracking. Defaults to `true` (all signals) in the browser.
   * Pass `false` to disable, or an object to enable selectively.
   */
  autoTrack?: boolean | AutoTrackOptions;
}

/**
 * The main entry point. Construct once per portal:
 *
 *   const analytics = new AnalyticsClient({ portalId: 'training', endpoint: '/api/v1/events' });
 *   analytics.trackPageView('/lessons/42');
 */
export class AnalyticsClient {
  readonly options: AnalyticsClientOptions;
  readonly portalId: PortalId;

  private readonly logger: Logger;
  private readonly session: SessionManager;
  private readonly queue: EventQueue | null;
  private defaults: Record<string, unknown>;
  private currentUserId: string | null = null;

  // Auto-tracking state
  private autoTrackInstalled = false;
  private lastPath: string | null = null;
  private pageEnteredAt = 0;
  private cleanupFns: Array<() => void> = [];

  constructor(options: AnalyticsClientOptions) {
    this.options = options;
    this.portalId = options.portalId;
    this.logger = createLogger(Boolean(options.debug));
    this.defaults = options.defaults ?? {};
    const storage = options.storage ?? detectStorage();
    this.session = new SessionManager({ storage });
    this.currentUserId = this.session.getUserId();

    if (options.disabled) {
      this.queue = null;
      this.logger.debug('Client created in disabled mode — no events will be sent');
      return;
    }

    const transport = new HttpTransport({
      endpoint: options.endpoint,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
      logger: this.logger,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
    this.queue = new EventQueue({
      transport,
      logger: this.logger,
      ...(options.batchSize !== undefined ? { batchSize: options.batchSize } : {}),
      ...(options.flushIntervalMs !== undefined ? { flushIntervalMs: options.flushIntervalMs } : {}),
      ...(options.onDrop !== undefined ? { onDrop: options.onDrop } : {}),
    });

    // Auto-tracking defaults ON in the browser (the platform's "install SDK and
    // everything is tracked" promise). Pass autoTrack:false to opt out.
    if (typeof window !== 'undefined' && options.autoTrack !== false) {
      this.enableAutoTracking(options.autoTrack === true || options.autoTrack === undefined ? {} : options.autoTrack);
    }
  }

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  identify(userId: string | null): void {
    this.currentUserId = userId;
    this.session.setUserId(userId);
  }

  reset(): void {
    this.identify(null);
    this.session.resetSession();
  }

  // -------------------------------------------------------------------------
  // Generic track
  // -------------------------------------------------------------------------

  track(event: TrackEventInput): void {
    if (!this.queue) return;
    const payload: AnalyticsEventPayload = {
      ...(event.id !== undefined ? { id: event.id } : {}),
      portalId: this.portalId,
      category: event.category,
      name: event.name,
      source: event.source ?? 'web',
      userId: event.userId ?? this.currentUserId ?? null,
      sessionId: event.sessionId ?? this.session.getSessionId(),
      url: event.url ?? this.currentUrl(),
      referrer: event.referrer ?? this.currentReferrer(),
      metadata: { ...this.defaults, ...(event.metadata ?? {}) },
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    };
    this.logger.debug('track', payload);
    this.queue.enqueue(payload);
  }

  // -------------------------------------------------------------------------
  // Helper trackers
  // -------------------------------------------------------------------------

  trackLogin(userId: string, metadata: Record<string, unknown> = {}): void {
    this.identify(userId);
    this.track({ category: 'auth', name: EVENT_NAMES.auth.login, userId, metadata });
  }

  trackLogout(metadata: Record<string, unknown> = {}): void {
    this.track({ category: 'auth', name: EVENT_NAMES.auth.logout, metadata });
    this.reset();
  }

  trackPageView(path?: string, metadata: Record<string, unknown> = {}): void {
    this.track({
      category: 'navigation',
      name: EVENT_NAMES.navigation.pageView,
      url: path ?? this.currentUrl(),
      metadata,
    });
  }

  trackNavigation(from: string, to: string, metadata: Record<string, unknown> = {}): void {
    this.track({
      category: 'navigation',
      name: EVENT_NAMES.navigation.routeChange,
      metadata: { from, to, ...metadata },
    });
  }

  trackFeatureUsage(feature: string, metadata: Record<string, unknown> = {}): void {
    this.track({
      category: 'feature',
      name: EVENT_NAMES.feature.used,
      metadata: { feature, ...metadata },
    });
  }

  trackButtonClick(buttonId: string, metadata: Record<string, unknown> = {}): void {
    this.track({
      category: 'interaction',
      name: EVENT_NAMES.interaction.buttonClick,
      metadata: { buttonId, ...metadata },
    });
  }

  trackError(error: Error | string, metadata: Record<string, unknown> = {}): void {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;
    this.track({
      category: 'error',
      name: EVENT_NAMES.error.captured,
      metadata: { message, stack, ...metadata },
    });
  }

  trackCustomEvent(name: string, metadata: Record<string, unknown> = {}): void {
    this.track({ category: 'custom', name, metadata });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async flush(): Promise<void> {
    await this.queue?.flush();
  }

  destroy(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.autoTrackInstalled = false;
    this.queue?.destroy();
  }

  // -------------------------------------------------------------------------
  // Auto-tracking (Step 4 — zero-config capture in the browser)
  // -------------------------------------------------------------------------

  /**
   * Wire up automatic browser capture: page views, SPA route changes, uncaught
   * errors, Navigation-Timing performance, engagement time, and device context.
   * Idempotent and SSR-safe. Called automatically by the constructor unless
   * `autoTrack: false` was passed.
   */
  enableAutoTracking(opts: AutoTrackOptions = {}): void {
    if (this.autoTrackInstalled) return;
    if (typeof window === 'undefined' || !this.queue) return;
    this.autoTrackInstalled = true;

    const on = {
      pageViews: opts.pageViews ?? true,
      routeChanges: opts.routeChanges ?? true,
      errors: opts.errors ?? true,
      performance: opts.performance ?? true,
      engagement: opts.engagement ?? true,
      deviceContext: opts.deviceContext ?? true,
    };

    // 1. Device context → merged into the defaults of every event.
    if (on.deviceContext) {
      this.defaults = { ...this.defaults, ...getDeviceContext() };
    }

    const pathOf = (): string => {
      try {
        return window.location.pathname + window.location.search;
      } catch {
        return '/';
      }
    };

    // 2. Initial page view + engagement clock.
    this.lastPath = pathOf();
    this.pageEnteredAt = Date.now();
    if (on.pageViews) this.trackPageView(this.lastPath);

    // 3. SPA route-change detection (history API + popstate).
    if (on.routeChanges || on.pageViews) {
      const handleRouteChange = () => {
        const next = pathOf();
        if (next === this.lastPath) return;
        const from = this.lastPath ?? next;
        if (on.engagement) this.flushEngagement(from);
        if (on.routeChanges) this.trackNavigation(from, next);
        if (on.pageViews) this.trackPageView(next);
        this.lastPath = next;
        this.pageEnteredAt = Date.now();
      };

      const origPush = window.history.pushState.bind(window.history);
      const origReplace = window.history.replaceState.bind(window.history);
      window.history.pushState = ((...args: Parameters<History['pushState']>) => {
        const r = origPush(...args);
        handleRouteChange();
        return r;
      }) as History['pushState'];
      window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
        const r = origReplace(...args);
        handleRouteChange();
        return r;
      }) as History['replaceState'];
      window.addEventListener('popstate', handleRouteChange);
      this.cleanupFns.push(() => {
        window.history.pushState = origPush;
        window.history.replaceState = origReplace;
        window.removeEventListener('popstate', handleRouteChange);
      });
    }

    // 4. Uncaught errors + promise rejections.
    if (on.errors) {
      const onError = (e: ErrorEvent) =>
        this.trackError(e.error instanceof Error ? e.error : e.message || 'window.error', {
          type: 'window.error',
          filename: e.filename,
          line: e.lineno,
        });
      const onRejection = (e: PromiseRejectionEvent) => {
        const reason = e.reason;
        this.trackError(reason instanceof Error ? reason : String(reason), { type: 'unhandledrejection' });
      };
      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onRejection);
      this.cleanupFns.push(() => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
      });
    }

    // 5. Performance (Navigation Timing) once the page has fully loaded.
    if (on.performance) {
      const capture = () => {
        const m = getNavigationTiming();
        if (m) this.track({ category: 'custom', name: EVENT_NAMES.performance.pageLoad, metadata: { route: this.lastPath, ...m } });
      };
      if (document.readyState === 'complete') {
        setTimeout(capture, 0);
      } else {
        const onLoad = () => setTimeout(capture, 0);
        window.addEventListener('load', onLoad, { once: true });
        this.cleanupFns.push(() => window.removeEventListener('load', onLoad));
      }
    }

    // 6. Engagement time — flush on hide / unload.
    if (on.engagement) {
      const onHide = () => {
        if (document.visibilityState === 'hidden') this.flushEngagement(this.lastPath ?? pathOf());
      };
      window.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', onHide);
      this.cleanupFns.push(() => {
        window.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', onHide);
      });
    }
  }

  private flushEngagement(path: string): void {
    if (!this.pageEnteredAt) return;
    const engagedMs = Date.now() - this.pageEnteredAt;
    this.pageEnteredAt = Date.now();
    if (engagedMs < 1000) return; // ignore sub-second noise
    this.track({
      category: 'custom',
      name: EVENT_NAMES.performance.engagement,
      metadata: { route: path, engagedMs, engagedSec: Math.round(engagedMs / 1000) },
    });
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private currentUrl(): string | null {
    if (typeof window === 'undefined') return null;
    return window.location?.href ?? null;
  }

  private currentReferrer(): string | null {
    if (typeof document === 'undefined') return null;
    return document.referrer || null;
  }
}
