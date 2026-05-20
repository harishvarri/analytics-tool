import type { Logger } from '../utils/logger';
import type { AnalyticsEventPayload } from '../events/types';
import type { HttpTransport } from './transport';

export interface QueueOptions {
  transport: HttpTransport;
  logger: Logger;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  /** Called when a batch is permanently dropped. Hook this to your error-reporting tool. */
  onDrop?: (events: AnalyticsEventPayload[], reason: string) => void;
}

const DEFAULTS = {
  batchSize: 20,
  flushIntervalMs: 5000,
  maxRetries: 3,
  onDrop: () => {},
};

/** Exponential backoff with full jitter — RFC: AWS Architecture Blog, 2015. */
function backoffMs(attempt: number): number {
  const cap = 30_000;
  const base = 1000;
  const max = Math.min(cap, base * 2 ** attempt);
  return Math.random() * max;
}

/**
 * In-memory event queue with periodic flush, page-unload flush, and
 * exponential backoff on retriable failures. Non-retriable failures drop
 * the batch and log loudly.
 *
 * Not persisted across reloads on purpose — analytics that survives a hard
 * crash is out of scope for v1; revisit if we see lossy ingestion.
 */
export class EventQueue {
  private buffer: AnalyticsEventPayload[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private backoffAttempt = 0;
  private destroyed = false;

  private readonly opts: Required<QueueOptions>;

  constructor(opts: QueueOptions) {
    this.opts = { ...DEFAULTS, ...opts } as Required<QueueOptions>;
    this.startTimer();
    this.bindUnload();
  }

  enqueue(event: AnalyticsEventPayload): void {
    if (this.destroyed) return;
    this.buffer.push(event);
    if (this.buffer.length >= this.opts.batchSize) {
      void this.flush();
    }
  }

  async flush({ beacon = false } = {}): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.opts.batchSize);
    try {
      const result = await this.opts.transport.send(batch, { beacon });
      if (result.ok) {
        this.backoffAttempt = 0;
      } else if (result.retriable && this.backoffAttempt < this.opts.maxRetries) {
        // Re-queue at head, schedule backoff with jitter
        this.buffer = [...batch, ...this.buffer];
        this.backoffAttempt++;
        const wait = backoffMs(this.backoffAttempt);
        this.opts.logger.warn(
          `Transport failed (status=${result.status}); retry ${this.backoffAttempt}/${this.opts.maxRetries} in ${Math.round(wait)}ms`,
        );
        setTimeout(() => void this.flush(), wait);
      } else {
        const reason = result.retriable
          ? `max retries exceeded (status=${result.status})`
          : `non-retriable (status=${result.status})`;
        this.opts.logger.error(`Dropping batch of ${batch.length} events: ${reason}`);
        this.opts.onDrop(batch, reason);
        this.backoffAttempt = 0;
      }
    } finally {
      this.flushing = false;
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private startTimer(): void {
    if (typeof window === 'undefined') return; // no periodic flush on server
    this.timer = setInterval(() => void this.flush(), this.opts.flushIntervalMs);
  }

  private bindUnload(): void {
    if (typeof window === 'undefined') return;
    const flushOnUnload = () => {
      if (this.buffer.length > 0) void this.flush({ beacon: true });
    };
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushOnUnload();
    });
  }
}
