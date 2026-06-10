'use client';

import { useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronUp, Code2, Copy } from 'lucide-react';
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

// ─── Reusable snippet pieces ────────────────────────────────────────────────────

/** The tiny <NcplIdentify> component for React-family frameworks — no Supabase
 *  import, no DB query, no RLS. Pass the name your app already has. */
const IDENTIFY_COMPONENT = [
  `'use client';`,
  `import { useEffect } from 'react';`,
  ``,
  `// Pass the user info your app ALREADY has (from your session/context).`,
  `// No database query, no RLS policy needed — so it can never be blocked.`,
  `export function NcplIdentify({ id, name, email }:`,
  `  { id: string; name?: string; email?: string }) {`,
  `  useEffect(() => {`,
  `    let tries = 0;`,
  `    const fire = () => {`,
  `      const w = window as any;`,
  `      if (w.ncpl) { w.ncpl('identify', id, { name, email }); return; }`,
  `      if (tries++ < 30) setTimeout(fire, 100); // wait for ncpl.js to load`,
  `    };`,
  `    fire();`,
  `  }, [id, name, email]);`,
  `  return null;`,
  `}`,
].join('\n');

/** Plain-JS identify call with a ready-check, for non-React frameworks. */
function identifyInline(idExpr: string, nameExpr: string, emailExpr: string): string {
  return [
    `// Call this once, right after you know who the user is.`,
    `// Pass the name your app already has — no database lookup needed.`,
    `(function identify(tries) {`,
    `  if (window.ncpl) {`,
    `    window.ncpl('identify', ${idExpr}, {`,
    `      name:  ${nameExpr},`,
    `      email: ${emailExpr},`,
    `    });`,
    `  } else if ((tries || 0) < 30) {`,
    `    setTimeout(() => identify((tries || 0) + 1), 100); // wait for ncpl.js`,
    `  }`,
    `})();`,
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

  // Step 3 (optional) is the same idea everywhere — a domain event.
  const trackStep = (file: string, code: string): Step => ({
    title: 'Track business events',
    file,
    desc: 'Optional. Send domain-specific events (lesson completed, quiz submitted…) for richer analysis. Everything else is already captured.',
    code,
    optional: true,
  });

  switch (fw) {
    case 'nextjs-app':
      return [
        {
          title: 'Add the tracking script',
          file: 'app/layout.tsx',
          desc: 'Place the Next.js <Script> inside <body>. This loads the tracker on every page.',
          code: [
            `import Script from 'next/script';`,
            ``,
            `export default function RootLayout({ children }) {`,
            `  return (`,
            `    <html lang="en">`,
            `      <body>`,
            `        {children}`,
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
          title: 'Show real names — add a tiny identify component',
          file: 'components/ncpl-identify.tsx',
          desc: 'Create this small file, then render it wherever you already load the signed-in user (a dashboard layout, a provider, etc.). Pass the name you already have.',
          code: [
            IDENTIFY_COMPONENT,
            ``,
            `// ── Then use it where the user is already available: ──`,
            `// import { NcplIdentify } from '@/components/ncpl-identify';`,
            `// <NcplIdentify id={user.id} name={user.full_name} email={user.email} />`,
          ].join('\n'),
        },
        trackStep(
          'any client component',
          [
            `'use client';`,
            ``,
            `function onComplete(lesson) {`,
            `  (window as any).ncpl?.('track', 'lesson.completed', {`,
            `    lessonId: lesson.id,`,
            `    level: lesson.level,`,
            `    score: 95,`,
            `  });`,
            `}`,
          ].join('\n'),
        ),
      ];

    case 'nextjs-pages':
      return [
        {
          title: 'Add the tracking script',
          file: 'pages/_document.tsx',
          desc: 'Add the script inside <Head> of your custom document. It loads on every page.',
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
            `      <body><Main /><NextScript /></body>`,
            `    </Html>`,
            `  );`,
            `}`,
          ].join('\n'),
        },
        {
          title: 'Show real names — add a tiny identify component',
          file: 'components/ncpl-identify.tsx',
          desc: 'Create this small file, then render it once the user is loaded (e.g. inside _app.tsx or a layout). Pass the name you already have.',
          code: [
            IDENTIFY_COMPONENT,
            ``,
            `// ── Use it where the user is available: ──`,
            `// <NcplIdentify id={user.id} name={user.fullName} email={user.email} />`,
          ].join('\n'),
        },
        trackStep(
          'any component',
          `(window as any).ncpl?.('track', 'form.submitted', { formName: 'enrollment' });`,
        ),
      ];

    case 'react':
      return [
        {
          title: 'Add the tracking script',
          file: 'public/index.html  (or index.html for Vite)',
          desc: 'Paste before the closing </body> tag. Page views, clicks, errors, and sessions are captured immediately.',
          code: scriptTag,
        },
        {
          title: 'Show real names — identify the logged-in user',
          file: 'components/NcplIdentify.tsx',
          desc: 'Create this small component and render it once the user is loaded. Pass the name your app already has — no Supabase query needed.',
          code: [
            `import { useEffect } from 'react';`,
            ``,
            `// Render once you know the user: <NcplIdentify id={user.id} name={user.fullName} email={user.email} />`,
            `export function NcplIdentify({ id, name, email }:`,
            `  { id: string; name?: string; email?: string }) {`,
            `  useEffect(() => {`,
            `    let tries = 0;`,
            `    const fire = () => {`,
            `      const w = window as any;`,
            `      if (w.ncpl) { w.ncpl('identify', id, { name, email }); return; }`,
            `      if (tries++ < 30) setTimeout(fire, 100);`,
            `    };`,
            `    fire();`,
            `  }, [id, name, email]);`,
            `  return null;`,
            `}`,
          ].join('\n'),
        },
        trackStep(
          'any component',
          `(window as any).ncpl?.('track', 'course.started', { courseId: course.id });`,
        ),
      ];

    case 'vue':
      return [
        {
          title: 'Add the tracking script',
          file: 'index.html',
          desc: 'Paste before </body>. Vue Router navigation is captured automatically.',
          code: scriptTag,
        },
        {
          title: 'Show real names — identify after login',
          file: 'your auth composable / store',
          desc: 'Call identify once after login, using the name already in your user object.',
          code: identifyInline('user.value.id', 'user.value.fullName', 'user.value.email'),
        },
        trackStep(
          'any component or composable',
          `window.ncpl?.('track', 'lesson.completed', { lessonId: lesson.id, score: 90 });`,
        ),
      ];

    case 'angular':
      return [
        {
          title: 'Add the tracking script',
          file: 'src/index.html',
          desc: 'Paste before </body>. Angular Router navigations are captured automatically.',
          code: scriptTag,
        },
        {
          title: 'Show real names — identify after login',
          file: 'app/services/auth.service.ts',
          desc: 'Call identify in your AuthService after a successful login, using the user you already have.',
          code: identifyInline('user.id', 'user.displayName', 'user.email').replace(/window\.ncpl/g, '(window as any).ncpl'),
        },
        trackStep(
          'any component or service',
          `(window as any).ncpl?.('track', 'form.submitted', { formName: 'enrollment' });`,
        ),
      ];

    case 'sveltekit':
      return [
        {
          title: 'Add the tracking script',
          file: 'src/app.html',
          desc: 'Paste before </body> in your root HTML template.',
          code: scriptTag,
        },
        {
          title: 'Show real names — identify from the session',
          file: 'src/routes/+layout.svelte',
          desc: 'Identify the user from your session store, using the name you already have.',
          code: [
            `<script>`,
            `  import { page } from '$app/stores';`,
            `  import { browser } from '$app/environment';`,
            `  $: if (browser && $page.data.user && window.ncpl) {`,
            `    window.ncpl('identify', $page.data.user.id, {`,
            `      name:  $page.data.user.fullName,`,
            `      email: $page.data.user.email,`,
            `    });`,
            `  }`,
            `</script>`,
          ].join('\n'),
        },
        trackStep(
          'any .svelte component',
          `window.ncpl?.('track', 'lesson.completed', { lessonId, score });`,
        ),
      ];

    case 'nuxt':
      return [
        {
          title: 'Add the tracking script',
          file: 'nuxt.config.ts',
          desc: 'Add the script to app.head.script in your Nuxt config.',
          code: [
            `export default defineNuxtConfig({`,
            `  app: { head: { script: [{`,
            `    src: 'https://analytics-tool-web.vercel.app/ncpl.js',`,
            `    defer: true,`,
            `    'data-project': '${slug}',`,
            `    'data-key': '${key}',`,
            `  }] } },`,
            `});`,
          ].join('\n'),
        },
        {
          title: 'Show real names — identify after login',
          file: 'plugins/ncpl.client.ts',
          desc: 'Create a client plugin that identifies the user from your session, using the name you already have.',
          code: identifyInline('user.value.id', 'user.value.fullName', 'user.value.email'),
        },
        trackStep(
          'any component or composable',
          `window.ncpl?.('track', 'lesson.completed', { lessonId: 'a1-greetings', score: 90 });`,
        ),
      ];

    // html (default)
    default:
      return [
        {
          title: 'Add the tracking script',
          file: 'index.html',
          desc: 'Paste before </body>. Page views, clicks, form submits, sessions, and JS errors are captured immediately — no other code.',
          code: scriptTag,
        },
        {
          title: 'Show real names — identify after login',
          file: 'your login handler',
          desc: 'Call identify once after login, using the name your app already has.',
          code: identifyInline('user.id', 'user.fullName', 'user.email'),
        },
        trackStep(
          'anywhere in your JS',
          [
            `window.ncpl?.('track', 'quiz.submitted', { score: 90, passed: true, level: 'A1' });`,
          ].join('\n'),
        ),
      ];
  }
}

// ─── Auto-captured (zero code) — true for every framework, from ncpl.js ─────────

const AUTO_CAPTURE = [
  'Page views & navigation (SPA-aware)',
  'Button & link clicks',
  'Form submissions',
  'Sessions & time-on-page',
  'Device, browser & OS',
  'Performance metrics',
  'JavaScript errors & crashes',
];

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

  return (
    <div className="mt-3 border-t pt-3">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" />
          Setup guide — {projectName}
        </span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5" />
          : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">

          {/* One-line promise */}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Two steps to connect any product: <span className="font-medium text-foreground">paste the script</span> (everything below is auto-tracked),
            then <span className="font-medium text-foreground">one identify call</span> so real names appear instead of IDs. Business events are optional.
          </p>

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
                  <div className="absolute right-2 top-2">
                    <CopyBtn text={step.code} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Auto-captured summary */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Captured automatically from step 1 — zero extra code
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {AUTO_CAPTURE.map((item) => (
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
