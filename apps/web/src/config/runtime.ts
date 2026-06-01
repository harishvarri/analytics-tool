/**
 * Centralized runtime tunables. Anything that varies by deployment but isn't
 * a secret lives here. Imported by API routes, repositories, and the UI.
 * Secrets stay in lib/env.ts.
 */

export const RUNTIME = {
  ingest: {
    /** Hard cap on POST /api/v1/events body bytes. */
    maxBodyBytes: 64 * 1024,
    /** Token bucket capacity per IP. */
    burstPerSecond: 100,
    /** Token bucket refill rate per IP. */
    sustainedPerSecond: 50,
  },
  queries: {
    /** Default limit on list endpoints. */
    defaultLimit: 50,
    /** Hard cap on list endpoints. */
    maxLimit: 500,
  },
  realtime: {
    /** Buffer size for the live activity hook. */
    bufferCapacity: 60,
    /** ms between flush ticks (render coalescing). */
    flushIntervalMs: 400,
  },
  partitions: {
    /** Months ahead to pre-create on each maintenance run. */
    leadMonths: 2,
  },
  retention: {
    /**
     * Raw-event retention window in days. Partitions fully older than this are
     * archived (business_critical rows) then dropped by enforce_event_retention.
     */
    rawDays: 90,
  },
} as const;
