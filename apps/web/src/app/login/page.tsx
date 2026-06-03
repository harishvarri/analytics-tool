'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AlertTriangle } from 'lucide-react';
import { siteConfig } from '@/config/site';

// Demo accounts — shown in development or when NEXT_PUBLIC_SHOW_DEMO=true
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@ncpl.test', role: 'Full access' },
  { label: 'Developer', email: 'dev@ncpl.test', role: 'Dashboard + Projects' },
  { label: 'Viewer', email: 'viewer@ncpl.test', role: 'Read-only' },
];
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';
const SHOW_DEMO =
  process.env.NEXT_PUBLIC_SHOW_DEMO === 'true' ||
  process.env.NODE_ENV === 'development';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function signIn(signInEmail: string, signInPassword: string) {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });

      if (err) {
        setError(err.message || 'Invalid email or password.');
        return;
      }

      router.replace(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f8] px-4">
      <div className="w-full max-w-[420px]">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="18" width="4" height="8" rx="1.5" fill="white" opacity="0.65"/>
              <rect x="10.5" y="12" width="4" height="14" rx="1.5" fill="white"/>
              <rect x="17" y="6" width="4" height="20" rx="1.5" fill="white"/>
              <rect x="23.5" y="10" width="4" height="16" rx="1.5" fill="white" opacity="0.75"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{siteConfig.name}</h1>
            <p className="text-sm text-gray-500">{siteConfig.company} · Internal platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/60 bg-white p-8 shadow-xl shadow-gray-200/60">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Sign in</h2>
          <p className="mb-6 text-sm text-gray-500">Use your NCPL credentials to continue.</p>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="relative z-10 mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800 shadow-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); signIn(email, password); }} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Email address</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@ncpl.com"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="********"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          {/* Demo accounts */}
          {SHOW_DEMO && DEMO_PASSWORD && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Demo accounts
              </p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => signIn(a.email, DEMO_PASSWORD)}
                    disabled={loading}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-left text-xs transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <span>
                      <span className="font-semibold text-gray-800">{a.label}</span>
                      <span className="ml-2 text-gray-500">{a.role}</span>
                    </span>
                    <span className="font-mono text-[10px] text-gray-400">{a.email}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-gray-400">
                Demo environment — not for production data
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {siteConfig.company} · Internal use only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
