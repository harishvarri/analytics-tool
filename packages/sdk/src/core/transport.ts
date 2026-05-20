import type { Logger } from '../utils/logger';
import type { AnalyticsEventPayload } from '../events/types';

export interface TransportOptions {
  endpoint: string;
  apiKey?: string;
  logger: Logger;
  fetchImpl?: typeof fetch;
}

export interface TransportResult {
  ok: boolean;
  status: number;
  retriable: boolean;
}

/**
 * HTTP transport. Tries `navigator.sendBeacon` on unload paths (best-effort,
 * survives navigation), otherwise uses fetch + keepalive.
 *
 * Retries with exponential backoff on network errors and 5xx responses;
 * 4xx errors are non-retriable (caller drops the batch).
 */
export class HttpTransport {
  constructor(private readonly opts: TransportOptions) {}

  async send(events: AnalyticsEventPayload[], { beacon = false } = {}): Promise<TransportResult> {
    if (events.length === 0) return { ok: true, status: 204, retriable: false };

    const body = JSON.stringify({ events });
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.apiKey) headers['x-ncpl-api-key'] = this.opts.apiKey;

    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const queued = navigator.sendBeacon(this.opts.endpoint, blob);
        return { ok: queued, status: queued ? 202 : 0, retriable: !queued };
      } catch (e) {
        this.opts.logger.warn('sendBeacon failed', e);
      }
    }

    const fetchImpl = this.opts.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      this.opts.logger.error('No fetch implementation available');
      return { ok: false, status: 0, retriable: true };
    }

    try {
      const res = await fetchImpl(this.opts.endpoint, {
        method: 'POST',
        headers,
        body,
        keepalive: true,
        credentials: 'omit',
      });
      const retriable = res.status >= 500 || res.status === 0;
      return { ok: res.ok, status: res.status, retriable };
    } catch (err) {
      this.opts.logger.warn('Transport error', err);
      return { ok: false, status: 0, retriable: true };
    }
  }
}
