'use client';

import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Framework catalogue ────────────────────────────────────────────────────────

type FrameworkId =
  | 'html'
  | 'react'
  | 'nextjs-app'
  | 'nextjs-pages'
  | 'vue'
  | 'angular'
  | 'sveltekit'
  | 'nuxt';

interface FrameworkMeta {
  id: FrameworkId;
  label: string;
  file: string;
  location: string;
  snippet: (slug: string, apiKey: string) => string;
}

const FRAMEWORKS: FrameworkMeta[] = [
  {
    id: 'html',
    label: 'Plain HTML',
    file: 'index.html',
    location: 'Paste before the closing </body> tag',
    snippet: (slug, key) =>
      `<script\n  defer\n  src="https://analytics-tool-web.vercel.app/ncpl.js"\n  data-project="${slug}"\n  data-key="${key}"></script>`,
  },
  {
    id: 'react',
    label: 'React / Vite / CRA',
    file: 'public/index.html',
    location: 'Paste before the closing </body> tag',
    snippet: (slug, key) =>
      `<script\n  defer\n  src="https://analytics-tool-web.vercel.app/ncpl.js"\n  data-project="${slug}"\n  data-key="${key}"></script>`,
  },
  {
    id: 'nextjs-app',
    label: 'Next.js App Router',
    file: 'app/layout.tsx',
    location: 'Use Next.js <Script> inside the <body>',
    snippet: (slug, key) =>
      `import Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script\n          src="https://analytics-tool-web.vercel.app/ncpl.js"\n          data-project="${slug}"\n          data-key="${key}"\n          strategy="afterInteractive"\n        />\n      </body>\n    </html>\n  );\n}`,
  },
  {
    id: 'nextjs-pages',
    label: 'Next.js Pages Router',
    file: 'pages/_document.tsx',
    location: 'Add inside the <Head> component',
    snippet: (slug, key) =>
      `import { Html, Head, Main, NextScript } from 'next/document';\n\nexport default function Document() {\n  return (\n    <Html lang="en">\n      <Head>\n        <script\n          defer\n          src="https://analytics-tool-web.vercel.app/ncpl.js"\n          data-project="${slug}"\n          data-key="${key}"\n        />\n      </Head>\n      <body>\n        <Main />\n        <NextScript />\n      </body>\n    </Html>\n  );\n}`,
  },
  {
    id: 'vue',
    label: 'Vue (Vite / CLI)',
    file: 'index.html',
    location: 'Paste before the closing </body> tag',
    snippet: (slug, key) =>
      `<script\n  defer\n  src="https://analytics-tool-web.vercel.app/ncpl.js"\n  data-project="${slug}"\n  data-key="${key}"></script>`,
  },
  {
    id: 'angular',
    label: 'Angular',
    file: 'src/index.html',
    location: 'Paste before the closing </body> tag',
    snippet: (slug, key) =>
      `<script\n  defer\n  src="https://analytics-tool-web.vercel.app/ncpl.js"\n  data-project="${slug}"\n  data-key="${key}"></script>`,
  },
  {
    id: 'sveltekit',
    label: 'SvelteKit',
    file: 'src/app.html',
    location: 'Paste before the closing </body> tag',
    snippet: (slug, key) =>
      `<script\n  defer\n  src="https://analytics-tool-web.vercel.app/ncpl.js"\n  data-project="${slug}"\n  data-key="${key}"></script>`,
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    file: 'nuxt.config.ts',
    location: 'Add to the app.head.script array',
    snippet: (slug, key) =>
      `export default defineNuxtConfig({\n  app: {\n    head: {\n      script: [\n        {\n          src: 'https://analytics-tool-web.vercel.app/ncpl.js',\n          defer: true,\n          'data-project': '${slug}',\n          'data-key': '${key}',\n        },\n      ],\n    },\n  },\n});`,
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  projectSlug: string;
  projectName: string;
  apiKey: string;
}

export function ScriptInstallGuide({ projectSlug, projectName, apiKey }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FrameworkId>('html');
  const [copied, setCopied] = useState(false);

  const fw = FRAMEWORKS.find((f) => f.id === selected) ?? FRAMEWORKS[0]!;
  const code = fw.snippet(projectSlug, apiKey);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-3 border-t pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" />
          Install tracking script for {projectName}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Framework selector */}
          <div>
            <p className="mb-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Select your project type</p>
            <div className="flex flex-wrap gap-1.5">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    selected === f.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Where to add it */}
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px]">
            <span className="font-semibold text-foreground">File to edit: </span>
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">{fw.file}</code>
            <span className="ml-2 text-muted-foreground">— {fw.location}</span>
          </div>

          {/* Code snippet */}
          <div className="relative">
            <pre className="overflow-x-auto rounded-md border bg-[#0f172a] p-3 text-[11px] leading-relaxed text-slate-200">
              <code>{code}</code>
            </pre>
            <button
              onClick={copy}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition-colors"
            >
              {copied ? (
                <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3" /> Copy</>
              )}
            </button>
          </div>

          {/* Quick note */}
          <p className="text-[11px] text-muted-foreground">
            Add this once in the file above — it auto-tracks page views, errors, performance, and user sessions across the entire app.
          </p>
        </div>
      )}
    </div>
  );
}
