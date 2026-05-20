import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '../env';
import type { Database } from '@/types/database';

/**
 * Server-side Supabase client bound to the request's cookies.
 * Use inside Server Components, Route Handlers, and Server Actions.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            toSet.forEach(({ name, value, options }) => {
              if (options) cookieStore.set(name, value, options);
              else cookieStore.set(name, value);
            });
          } catch {
            // Server Components cannot set cookies — middleware refresh handles it.
          }
        },
      },
    },
  );
}
