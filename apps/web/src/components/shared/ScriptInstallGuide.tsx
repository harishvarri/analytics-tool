'use client';

import { useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronUp, Code2, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FrameworkId =
  | 'html' | 'react' | 'nextjs-app' | 'nextjs-pages'
  | 'vue' | 'angular' | 'sveltekit' | 'nuxt';

interface Step {
  title: string;
  file: string;
  desc: string;
  code: string;
  /** if set → show a Save File button that downloads with this filename */
  filename?: string;
  optional?: boolean;
}

const FRAMEWORKS: { id: FrameworkId; label: string }[] = [
  { id: 'html',         label: 'Plain HTML'      },
  { id: 'react',        label: 'React / Vite'    },
  { id: 'nextjs-app',   label: 'Next.js App'     },
  { id: 'nextjs-pages', label: 'Next.js Pages'   },
  { id: 'vue',          label: 'Vue'             },
  { id: 'angular',      label: 'Angular'         },
  { id: 'sveltekit',    label: 'SvelteKit'       },
  { id: 'nuxt',         label: 'Nuxt'            },
];

// ─── Analytics helper file content ────────────────────────────────────────────

function nextjsAnalyticsFile(slug: string): string {
  return [
    `'use client';`,
    `// NCPL Analytics helper — project: ${slug}`,
    `// Place this file at: components/ncpl-analytics.tsx`,
    `import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';`,
    `import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';`,
    ``,
    `type ErrorType = 'api' | 'database' | 'authentication' | 'authorization' | 'network' | 'frontend';`,
    `export interface NcplInstance {`,
    `  track: (event: string, metadata?: Record<string, unknown>) => void;`,
    `  error: (type: ErrorType, message: string, extra?: Record<string, unknown>) => void;`,
    `}`,
    `declare global { interface Window { ncpl?: (...args: unknown[]) => void; } }`,
    ``,
    `const Ctx = createContext<NcplInstance>({ track: () => {}, error: () => {} });`,
    `export function useNcpl() { return useContext(Ctx); }`,
    ``,
    `export function NcplAnalytics({ children }: { children?: ReactNode }) {`,
    `  const supabase = createClientComponentClient();`,
    `  const fetchPatched = useRef(false);`,
    ``,
    `  useEffect(() => {`,
    `    async function identify() {`,
    `      const { data: { session } } = await supabase.auth.getSession();`,
    `      if (session?.user) sendIdentify(session.user);`,
    `    }`,
    `    identify();`,
    `    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {`,
    `      if (s?.user) sendIdentify(s.user);`,
    `    });`,
    `    const onError = (e: ErrorEvent) =>`,
    `      window.ncpl?.('track', 'error.occurred', { errorType: 'frontend', message: e.message });`,
    `    const onRejection = (e: PromiseRejectionEvent) => {`,
    `      const msg = e.reason?.message ?? String(e.reason ?? 'Unknown');`,
    `      window.ncpl?.('track', 'error.occurred', { errorType: classifyMsg(msg), message: msg });`,
    `    };`,
    `    if (!fetchPatched.current) {`,
    `      fetchPatched.current = true;`,
    `      const orig = window.fetch;`,
    `      window.fetch = async (...args) => {`,
    `        const res = await orig(...args);`,
    `        if (!res.ok) {`,
    `          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url ?? '';`,
    `          window.ncpl?.('track', 'error.occurred', {`,
    `            errorType: classifyUrl(url, res.status),`,
    `            message: 'HTTP ' + res.status,`,
    `            statusCode: res.status, url,`,
    `          });`,
    `        }`,
    `        return res;`,
    `      };`,
    `    }`,
    `    window.addEventListener('error', onError);`,
    `    window.addEventListener('unhandledrejection', onRejection);`,
    `    return () => {`,
    `      subscription.unsubscribe();`,
    `      window.removeEventListener('error', onError);`,
    `      window.removeEventListener('unhandledrejection', onRejection);`,
    `    };`,
    `  }, []);`,
    ``,
    `  const api: NcplInstance = {`,
    `    track: (event, meta) => window.ncpl?.('track', event, meta ?? {}),`,
    `    error: (type, message, extra) =>`,
    `      window.ncpl?.('track', 'error.occurred', { errorType: type, message, ...extra }),`,
    `  };`,
    `  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;`,
    `}`,
    ``,
    `// eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `function sendIdentify(user: any) {`,
    `  window.ncpl?.('identify', {`,
    `    userId: user.id,`,
    `    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,`,
    `    email: user.email,`,
    `  });`,
    `}`,
    `function classifyMsg(msg: string): ErrorType {`,
    `  if (/auth|unauthori[sz]ed|401|403|token|session/i.test(msg)) return 'authentication';`,
    `  if (/database|postgres|supabase|query|sql/i.test(msg))        return 'database';`,
    `  if (/fetch|network|cors|timeout|abort/i.test(msg))             return 'network';`,
    `  if (/api|500|502|503/i.test(msg))                              return 'api';`,
    `  return 'frontend';`,
    `}`,
    `function classifyUrl(url: string, status: number): ErrorType {`,
    `  if (status === 401 || status === 403)                   return 'authentication';`,
    `  if (/supabase|\\.rpc\\.|\\/rest\\//i.test(url))        return 'database';`,
    `  if (/\\/api\\//i.test(url))                             return 'api';`,
    `  return 'network';`,
    `}`,
  ].join('\n');
}

function reactAnalyticsFile(slug: string): string {
  return [
    `// NCPL Analytics helper — project: ${slug}`,
    `// Place this file at: src/ncpl-analytics.tsx`,
    `// Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env`,
    `import { createContext, useContext, useEffect, useRef } from 'react';`,
    `import { createClient } from '@supabase/supabase-js';`,
    ``,
    `const supabase = createClient(`,
    `  import.meta.env.VITE_SUPABASE_URL ?? '',`,
    `  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',`,
    `);`,
    ``,
    `const Ctx = createContext({ track: (_e: string, _m?: object) => {}, error: (_t: string, _msg: string) => {} });`,
    `export const useNcpl = () => useContext(Ctx);`,
    ``,
    `export function NcplAnalytics({ children }: { children: React.ReactNode }) {`,
    `  const fetchPatched = useRef(false);`,
    ``,
    `  useEffect(() => {`,
    `    async function identify() {`,
    `      const { data: { session } } = await supabase.auth.getSession();`,
    `      if (session?.user) sendIdentify(session.user);`,
    `    }`,
    `    identify();`,
    `    supabase.auth.onAuthStateChange((_, s) => { if (s?.user) sendIdentify(s.user); });`,
    ``,
    `    // eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `    const onError = (e: any) =>`,
    `      (window as any).ncpl?.('track', 'error.occurred', { errorType: 'frontend', message: e.message });`,
    `    // eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `    const onRejection = (e: any) => {`,
    `      const msg = e.reason?.message ?? String(e.reason ?? 'Unknown');`,
    `      let type = 'frontend';`,
    `      if (/auth|401|403|token/i.test(msg))      type = 'authentication';`,
    `      else if (/database|postgres|sql/i.test(msg)) type = 'database';`,
    `      else if (/network|fetch|timeout/i.test(msg)) type = 'network';`,
    `      else if (/api|500|502|503/i.test(msg))       type = 'api';`,
    `      (window as any).ncpl?.('track', 'error.occurred', { errorType: type, message: msg });`,
    `    };`,
    `    if (!fetchPatched.current) {`,
    `      fetchPatched.current = true;`,
    `      const orig = window.fetch;`,
    `      window.fetch = async (...args) => {`,
    `        const res = await orig(...args);`,
    `        if (!res.ok) {`,
    `          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url ?? '';`,
    `          const type = res.status === 401 || res.status === 403 ? 'authentication'`,
    `            : /supabase/i.test(url) ? 'database' : /\\/api\\//i.test(url) ? 'api' : 'network';`,
    `          (window as any).ncpl?.('track', 'error.occurred', { errorType: type, message: 'HTTP ' + res.status, statusCode: res.status, url });`,
    `        }`,
    `        return res;`,
    `      };`,
    `    }`,
    `    window.addEventListener('error', onError);`,
    `    window.addEventListener('unhandledrejection', onRejection);`,
    `    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };`,
    `  }, []);`,
    ``,
    `  const api = {`,
    `    track: (event: string, meta?: object) => (window as any).ncpl?.('track', event, meta ?? {}),`,
    `    error: (type: string, message: string, extra?: object) =>`,
    `      (window as any).ncpl?.('track', 'error.occurred', { errorType: type, message, ...extra }),`,
    `  };`,
    `  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;`,
    `}`,
    ``,
    `// eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `function sendIdentify(user: any) {`,
    `  (window as any).ncpl?.('identify', {`,
    `    userId: user.id,`,
    `    name: user.user_metadata?.full_name ?? user.email,`,
    `    email: user.email,`,
    `  });`,
    `}`,
  ].join('\n');
}

// ─── Step definitions per framework ──────────────────────────────────────────

function getSteps(fw: FrameworkId, slug: string, key: string): Step[] {
  const scriptTag = [
    `<script`,
    `  defer`,
    `  src="https://analytics-tool-web.vercel.app/ncpl.js"`,
    `  data-project="${slug}"`,
    `  data-key="${key}"></script>`,
  ].join('\n');

  switch (fw) {
    case 'nextjs-app':
      return [
        {
          title: 'Add tracking script',
          file: 'app/layout.tsx',
          desc: 'Import next/script and place it inside <body>. This loads the tracker on every page automatically.',
          code: [
            `import Script from 'next/script';`,
            `import { NcplAnalytics } from '@/components/ncpl-analytics';`,
            ``,
            `export default function RootLayout({ children }) {`,
            `  return (`,
            `    <html lang="en">`,
            `      <body>`,
            `        <NcplAnalytics>`,
            `          {children}`,
            `        </NcplAnalytics>`,
            `        <Script`,
            `          src="https://analytics-tool-web.vercel.app/ncpl.js"`,
            `          data-project="${slug}"`,
            `          data-key="${key}"`,
            `          strategy="afterInteractive"`,
            `        />`,
            `      </body>`,
            `    </html>`,
            `  );`,
            `}`,
          ].join('\n'),
        },
        {
          title: 'Create analytics helper',
          file: 'components/ncpl-analytics.tsx',
          desc: 'Create this new file. It auto-identifies users via Supabase, captures API / auth / DB errors, and exposes useNcpl() for business events.',
          code: nextjsAnalyticsFile(slug),
          filename: 'ncpl-analytics.tsx',
        },
        {
          title: 'Track business events',
          file: 'any client component',
          desc: 'Call useNcpl() to send domain-specific events. Page views, clicks, and all errors are already captured without this step.',
          code: [
            `'use client';`,
            `import { useNcpl } from '@/components/ncpl-analytics';`,
            ``,
            `export function LessonPlayer({ lesson }) {`,
            `  const ncpl = useNcpl();`,
            ``,
            `  function handleComplete() {`,
            `    ncpl.track('lesson.completed', {`,
            `      lessonId: lesson.id,`,
            `      level: lesson.level,`,
            `      score: 95,`,
            `    });`,
            `  }`,
            ``,
            `  return <button onClick={handleComplete}>Mark Complete</button>;`,
            `}`,
          ].join('\n'),
          optional: true,
        },
      ];

    case 'nextjs-pages':
      return [
        {
          title: 'Add tracking script',
          file: 'pages/_document.tsx',
          desc: 'Add the script inside <Head> in your custom document. It loads on every page.',
          code: [
            `import { Html, Head, Main, NextScript } from 'next/document';`,
            ``,
            `export default function Document() {`,
            `  return (`,
            `    <Html lang="en">`,
            `      <Head>`,
            `        <script`,
            `          defer`,
            `          src="https://analytics-tool-web.vercel.app/ncpl.js"`,
            `          data-project="${slug}"`,
            `          data-key="${key}"`,
            `        />`,
            `      </Head>`,
            `      <body>`,
            `        <Main />`,
            `        <NextScript />`,
            `      </body>`,
            `    </Html>`,
            `  );`,
            `}`,
          ].join('\n'),
        },
        {
          title: 'Create analytics helper',
          file: 'components/ncpl-analytics.tsx',
          desc: 'Create this new file. Handles Supabase user identification, error classification, and the useNcpl() hook.',
          code: nextjsAnalyticsFile(slug),
          filename: 'ncpl-analytics.tsx',
        },
        {
          title: 'Wrap your app',
          file: 'pages/_app.tsx',
          desc: 'Wrap the root component with <NcplAnalytics> so user identification activates globally.',
          code: [
            `import type { AppProps } from 'next/app';`,
            `import { NcplAnalytics } from '@/components/ncpl-analytics';`,
            ``,
            `export default function App({ Component, pageProps }: AppProps) {`,
            `  return (`,
            `    <NcplAnalytics>`,
            `      <Component {...pageProps} />`,
            `    </NcplAnalytics>`,
            `  );`,
            `}`,
          ].join('\n'),
        },
        {
          title: 'Track business events',
          file: 'any component',
          desc: 'Use useNcpl() to send business events like form submissions, course progress, etc.',
          code: [
            `import { useNcpl } from '@/components/ncpl-analytics';`,
            ``,
            `export function SubmitButton() {`,
            `  const ncpl = useNcpl();`,
            `  return (`,
            `    <button onClick={() => ncpl.track('form.submitted', { formName: 'enrollment' })}>`,
            `      Submit`,
            `    </button>`,
            `  );`,
            `}`,
          ].join('\n'),
          optional: true,
        },
      ];

    case 'react':
      return [
        {
          title: 'Add tracking script',
          file: 'public/index.html',
          desc: 'Paste before the closing </body> tag. Tracks page views, clicks, and JS errors automatically.',
          code: scriptTag,
        },
        {
          title: 'Create analytics helper',
          file: 'src/ncpl-analytics.tsx',
          desc: 'Create this file. Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from .env to identify users and classify errors.',
          code: reactAnalyticsFile(slug),
          filename: 'ncpl-analytics.tsx',
        },
        {
          title: 'Wrap your app',
          file: 'src/main.tsx',
          desc: 'Wrap the root component so identification and error tracking activate for every page.',
          code: [
            `import React from 'react';`,
            `import ReactDOM from 'react-dom/client';`,
            `import { NcplAnalytics } from './ncpl-analytics';`,
            `import App from './App';`,
            ``,
            `ReactDOM.createRoot(document.getElementById('root')!).render(`,
            `  <React.StrictMode>`,
            `    <NcplAnalytics>`,
            `      <App />`,
            `    </NcplAnalytics>`,
            `  </React.StrictMode>,`,
            `);`,
          ].join('\n'),
        },
        {
          title: 'Track business events',
          file: 'any component',
          desc: 'Use useNcpl() for domain events. All errors and navigation are already captured without this.',
          code: [
            `import { useNcpl } from './ncpl-analytics';`,
            ``,
            `export function CourseCard({ course }) {`,
            `  const ncpl = useNcpl();`,
            `  return (`,
            `    <button onClick={() => ncpl.track('course.started', { courseId: course.id })}>`,
            `      Start Course`,
            `    </button>`,
            `  );`,
            `}`,
          ].join('\n'),
          optional: true,
        },
      ];

    case 'vue':
      return [
        {
          title: 'Add tracking script',
          file: 'index.html',
          desc: 'Paste before </body>. Vue Router navigation changes are captured automatically.',
          code: scriptTag,
        },
        {
          title: 'Identify users after login',
          file: 'composables/useAuth.ts  (or your auth composable)',
          desc: 'Call identify once after the user logs in so the platform shows real names.',
          code: [
            `// In your auth composable, after login succeeds:`,
            `window.ncpl?.('identify', {`,
            `  userId: user.value.id,`,
            `  name:   user.value.fullName ?? user.value.email,`,
            `  email:  user.value.email,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
        {
          title: 'Track business events',
          file: 'any component or composable',
          desc: 'Call ncpl("track", ...) to send domain-specific events.',
          code: [
            `// In any component method or composable:`,
            `window.ncpl?.('track', 'lesson.completed', {`,
            `  lessonId: props.lesson.id,`,
            `  level: 'A1',`,
            `  score: score.value,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
      ];

    case 'angular':
      return [
        {
          title: 'Add tracking script',
          file: 'src/index.html',
          desc: 'Paste before </body>. Angular Router navigations are captured automatically.',
          code: scriptTag,
        },
        {
          title: 'Identify users after login',
          file: 'app/services/auth.service.ts',
          desc: 'Call identify in your AuthService after a successful login.',
          code: [
            `// In AuthService, after login():`,
            `(window as any).ncpl?.('identify', {`,
            `  userId: user.id,`,
            `  name:   user.displayName ?? user.email,`,
            `  email:  user.email,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
        {
          title: 'Track business events',
          file: 'any component or service',
          desc: 'Call ncpl("track", ...) from anywhere in your Angular app.',
          code: [
            `// From any component or service:`,
            `(window as any).ncpl?.('track', 'form.submitted', {`,
            `  formName: 'enrollment',`,
            `  success: true,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
      ];

    case 'sveltekit':
      return [
        {
          title: 'Add tracking script',
          file: 'src/app.html',
          desc: 'Paste before </body> in your root HTML template.',
          code: scriptTag,
        },
        {
          title: 'Identify users after login',
          file: 'src/routes/+layout.svelte',
          desc: 'Identify users from the session in your root layout.',
          code: [
            `<script>`,
            `  import { page } from '$app/stores';`,
            `  import { browser } from '$app/environment';`,
            ``,
            `  $: if (browser && $page.data.session?.user) {`,
            `    window.ncpl?.('identify', {`,
            `      userId: $page.data.session.user.id,`,
            `      name:   $page.data.session.user.user_metadata?.full_name,`,
            `      email:  $page.data.session.user.email,`,
            `    });`,
            `  }`,
            `</script>`,
          ].join('\n'),
          optional: true,
        },
        {
          title: 'Track business events',
          file: 'any .svelte component',
          desc: 'Call ncpl("track", ...) from any Svelte component.',
          code: [
            `<script>`,
            `  function handleComplete() {`,
            `    window.ncpl?.('track', 'lesson.completed', { lessonId, score });`,
            `  }`,
            `</script>`,
            ``,
            `<button on:click={handleComplete}>Mark Complete</button>`,
          ].join('\n'),
          optional: true,
        },
      ];

    case 'nuxt':
      return [
        {
          title: 'Add tracking script',
          file: 'nuxt.config.ts',
          desc: 'Add the script to app.head.script in your Nuxt config.',
          code: [
            `export default defineNuxtConfig({`,
            `  app: {`,
            `    head: {`,
            `      script: [`,
            `        {`,
            `          src: 'https://analytics-tool-web.vercel.app/ncpl.js',`,
            `          defer: true,`,
            `          'data-project': '${slug}',`,
            `          'data-key': '${key}',`,
            `        },`,
            `      ],`,
            `    },`,
            `  },`,
            `});`,
          ].join('\n'),
        },
        {
          title: 'Identify users after login',
          file: 'plugins/ncpl.client.ts',
          desc: 'Create a client-side plugin to identify users from the Nuxt auth session.',
          code: [
            `export default defineNuxtPlugin(async () => {`,
            `  const user = useSupabaseUser();`,
            `  if (user.value) {`,
            `    window.ncpl?.('identify', {`,
            `      userId: user.value.id,`,
            `      name:   user.value.user_metadata?.full_name ?? user.value.email,`,
            `      email:  user.value.email,`,
            `    });`,
            `  }`,
            `});`,
          ].join('\n'),
          optional: true,
        },
        {
          title: 'Track business events',
          file: 'any component or composable',
          desc: 'Call ncpl("track", ...) from any component.',
          code: [
            `window.ncpl?.('track', 'lesson.completed', {`,
            `  lessonId: 'a1-greetings',`,
            `  level: 'A1',`,
            `  score: 90,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
      ];

    // html (default)
    default:
      return [
        {
          title: 'Add tracking script',
          file: 'index.html',
          desc: 'Paste before </body>. Page views, clicks, and JS errors are captured immediately with no other code changes.',
          code: scriptTag,
        },
        {
          title: 'Identify users after login',
          file: 'your login handler',
          desc: 'Call identify once after login to show real names in the dashboard instead of anonymous IDs.',
          code: [
            `// Call this after a successful login:`,
            `window.ncpl?.('identify', {`,
            `  userId: user.id,`,
            `  name:   user.fullName,`,
            `  email:  user.email,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
        {
          title: 'Track business events',
          file: 'anywhere in your JS',
          desc: 'Send domain-specific events for richer analysis.',
          code: [
            `window.ncpl?.('track', 'quiz.submitted', {`,
            `  score: 90,`,
            `  passed: true,`,
            `  level: 'A1',`,
            `});`,
            ``,
            `window.ncpl?.('track', 'lesson.completed', {`,
            `  lessonId: 'a1-greetings',`,
            `  durationSeconds: 420,`,
            `});`,
          ].join('\n'),
          optional: true,
        },
      ];
  }
}

// ─── Auto-captured checklist ──────────────────────────────────────────────────

function getAutoCapture(fw: FrameworkId): string[] {
  const base = ['Page views & navigation', 'Button & link clicks', 'JS crashes'];
  if (fw === 'nextjs-app' || fw === 'nextjs-pages' || fw === 'react') {
    return ['Real user names & emails', ...base, 'API errors (classified)', 'Database errors', 'Auth / 401 / 403 errors', 'Network failures'];
  }
  return base;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition-colors"
    >
      {copied
        ? <><Check className="h-3 w-3 text-emerald-400" />Copied</>
        : <><Copy className="h-3 w-3" />Copy</>}
    </button>
  );
}

function SaveBtn({ content, filename }: { content: string; filename: string }) {
  return (
    <button
      onClick={() => {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }}
      className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-400 hover:bg-indigo-500/20 transition-colors"
    >
      <Download className="h-3 w-3" />Save file
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  projectSlug: string;
  projectName: string;
  apiKey: string;
}

export function ScriptInstallGuide({ projectSlug, projectName, apiKey }: Props) {
  const [open, setOpen] = useState(false);
  const [fw, setFw] = useState<FrameworkId>('nextjs-app');

  const steps = getSteps(fw, projectSlug, apiKey || 'YOUR_API_KEY');
  const autoCapture = getAutoCapture(fw);
  const requiredCount = steps.filter((s) => !s.optional).length;

  return (
    <div className="mt-3 border-t pt-3">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" />
          Installation kit — {projectName}
        </span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5" />
          : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">

          {/* Framework pills */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Project type
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFw(f.id)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    fw === f.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {requiredCount} required step{requiredCount !== 1 ? 's' : ''} · optional steps expand what gets tracked
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg border bg-card overflow-hidden',
                  step.optional && 'border-dashed',
                )}
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      step.optional
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground',
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-semibold leading-tight">{step.title}</span>
                        {step.optional && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{step.desc}</p>
                    </div>
                  </div>
                  <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {step.file}
                  </code>
                </div>

                {/* Code block */}
                <div className="relative mx-3 mb-3">
                  <pre className="overflow-x-auto rounded-md bg-[#0f172a] p-3 text-[11px] leading-relaxed text-slate-200">
                    <code>{step.code}</code>
                  </pre>
                  <div className="absolute right-2 top-2 flex items-center gap-1.5">
                    {step.filename && <SaveBtn content={step.code} filename={step.filename} />}
                    <CopyBtn text={step.code} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Auto-captured summary */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Auto-captured after setup — zero extra code
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {autoCapture.map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
