import { z } from 'zod';
import { MAX_EVENT_BATCH_SIZE } from '@/constants/api';

/**
 * Canonical Zod schemas for ingestion. These are the SINGLE source of truth —
 * both the API route and the SDK import from here.
 */

/**
 * Project identifier (slug). Dynamic — any registered project may send events,
 * so this is a validated slug rather than a hardcoded enum. New projects are
 * onboarded via the Add-Project admin flow (no code change required here).
 */
export const portalIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'Project slug must be lowercase alphanumeric (with - or _)');

export const eventCategorySchema = z.enum([
  'auth',
  'navigation',
  'feature',
  'interaction',
  'error',
  'custom',
]);

export const eventSourceSchema = z.enum(['web', 'mobile', 'server', 'integration']);

/** A single inbound event from any portal. */
export const trackEventSchema = z
  .object({
    id: z.string().uuid().optional(), // client-supplied for idempotent retries
    portalId: portalIdSchema,
    category: eventCategorySchema,
    name: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9._-]+$/i, 'Event names must be dot.namespaced lowercase'),
    source: eventSourceSchema.optional(),
    userId: z.string().uuid().nullable().optional(),
    // Independent apps (own auth, no central uuid) may identify by email instead.
    // The platform resolves this to a central user_id; the uuid field stays a uuid.
    userEmail: z.string().email().max(320).nullable().optional(),
    userName: z.string().max(200).nullable().optional(),
    sessionId: z.string().uuid().nullable().optional(),
    url: z.string().url().max(2048).nullable().optional(),
    referrer: z.string().max(2048).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .strict(); // unknown keys → 400, no silent data leakage

/** Batched ingestion. */
export const trackEventBatchSchema = z
  .object({
    events: z.array(trackEventSchema).min(1).max(MAX_EVENT_BATCH_SIZE),
  })
  .strict();

/** Common query filter shape used by analytics endpoints. */
export const analyticsQuerySchema = z.object({
  portalId: portalIdSchema.optional(),
  category: eventCategorySchema.optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;
export type TrackEventBatchInput = z.infer<typeof trackEventBatchSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
