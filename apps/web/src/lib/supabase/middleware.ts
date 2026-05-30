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
  const isDashboard = path === '/dashboard' || path.startsWith('/dashboard/');

  // Gate /dashboard/* — unauthenticated visitors redirect to /login.
  if (isDashboard && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // BUG-022: viewer role cannot access admin pages — redirect to overview.
  // We check the role from the Supabase anon client (safe — no service role here).
  const isAdminPage = path.startsWith('/dashboard/admin');
  if (isDashboard && isAdminPage && user) {
    const { data: roleData } = await supabase
      .from('analytics_users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = (roleData as { role?: string } | null)?.role ?? 'member';
    if (role === 'viewer') {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = '/dashboard';
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}
