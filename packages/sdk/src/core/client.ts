import type { AnalyticsEventPayload, PortalId, TrackEventInput } from '../events/types';
import { EVENT_NAMES } from '../events/names';
import { createLogger, type Logger } from '../utils/logger';
import { detectStorage, type KVStorage } from './storage';
import { SessionManager } from './session';
import { HttpTransport } from './transport';
import { EventQueue } from './queue';

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
  private readonly defaults: Record<string, unknown>;
  private currentUserId: string | null = null;

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
    this.queue?.destroy();
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
