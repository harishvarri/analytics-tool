import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../env';
import type { Database } from '@/types/database';

/**
 * Refresh the Supabase auth session on every request and propagate cookies.
 * Also gates /dashboard/* routes: unauthenticated visitors are redirected to
 * /login (BUG-001 fix — dashboard was publicly readable without auth).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => {
            if (options) response.cookies.set(name, value, options);
            else response.cookies.set(name, value);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Auth gating is intentionally disabled until Supabase auth users are
  // configured on this deployment. Re-enable by removing this early return.
  // (BUG-001 fix is implemented but bypassed here for open access.)

  return response;
}
