'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '../env';
import type { Database } from '@/types/database';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser-side Supabase client. Singleton — safe to call from any client component.
 * Uses the anon key; RLS enforced on the database.
 */
export function getSupabaseBrowser() {
  if (!cached) {
    cached = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return cached;
}
