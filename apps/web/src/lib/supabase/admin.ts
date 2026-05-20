import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in server-only paths
 * (route handlers, server actions) for trusted operations like event ingestion.
 * Never import from a client component or shared utility that may run in the browser.
 *
 * Intentionally untyped at the boundary; repositories cast results with the
 * narrow Row types from `@/types/database`. We swap in generated types once a
 * real Supabase project is connected and `supabase gen types` runs.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return cached;
}
