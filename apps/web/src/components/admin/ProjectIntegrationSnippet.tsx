'use client';

import { Check, Copy, Sparkles, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Honest, minimal integration guide for a project. Three steps, in priority order:
 *   1. Paste the script   → page views, clicks, sessions, errors, device (zero code)
 *   2. One identify() call → turns the short ID into a real name (REQUIRED for names)
 *   3. Track business events (optional) → powers the operational feed & reports
 *
 * Important: the script does NOT auto-detect real names. The name is only ever the
 * value you pass to identify(). Step 2 is what makes "8ec3628a" become "Haris Ahmed".
 */

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');

interface Props {
  slug: string;
  apiKey: string;
  environment: string;
}

function CopyBlock({ title, code, recommended }: { title: string; code: string; recommended?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className={`rounded-md border ${recommended ? 'border-primary/40 bg-primary/5' : 'bg-muted/40'}`}>
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {recommended && <Sparkles className="h-3 w-3 text-primary" />}
          {title}
        </span>
        <Button variant="ghost" size="sm" onClick={copy} className="h-6 gap-1 px-2 text-[11px]">
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

function Step({ n, title, badge, children }: { n: number; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{n}</span>
        <h4 className="text-xs font-semibold">{title}</h4>
        {badge && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-2 pl-7">{children}</div>
    </div>
  );
}

export function ProjectIntegrationSnippet({ slug, apiKey, environment }: Props) {
  const appUrl = configuredAppUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const ingestEndpoint = `${appUrl}/api/v1/events`;
  const scriptSrc = `${appUrl}/ncpl.js`;

  const scriptSnippet = `<script
  defer
  src="${scriptSrc}"
  data-project="${slug}"
  data-key="${apiKey}"></script>`;

  // Next.js App Router — the same tag via next/script
  const nextScriptSnippet = `import Script from 'next/script';
// inside <body> of app/layout.tsx:
<Script
  src="${scriptSrc}"
  data-project="${slug}"
  data-key="${apiKey}"
  strategy="afterInteractive"
/>`;

  const identifySnippet = `// Call ONCE, right after your app knows who is signed in.
// Pass the name you ALREADY have on your user/session object —
// no database lookup, no extra permissions needed.
window.ncpl.identify(user.id, {   // 1st arg: your user UUID (or pass the email string)
  name:  user.fullName,           // the name you already show in your UI
  email: user.email,
});

// On logout, reset back to anonymous:
window.ncpl.identify(null);`;

  const reactIdentifySnippet = `'use client';
import { useEffect } from 'react';

// Drop this once where the user is already loaded (e.g. your dashboard layout):
//   <NcplIdentify user={user} />
export function NcplIdentify({ user }) {
  useEffect(() => {
    if (!user) return;
    let tries = 0;
    const fire = () => {
      // window.ncpl exists only after the script loads — wait for it.
      if (window.ncpl?.identify) {
        window.ncpl.identify(user.id, { name: user.fullName, email: user.email });
      } else if (tries++ < 30) {
        setTimeout(fire, 100);
      }
    };
    fire();
  }, [user]);
  return null;
}`;

  const businessEventsSnippet = `// Fire one wherever a meaningful action happens. Powers the operational
// feed, user/project intelligence, and reports. Naming: "<entity>.<action>".
window.ncpl.track('lesson.completed',    { level: 'A1', score: 85 });
window.ncpl.track('candidate.created',   { candidateId, department });
window.ncpl.track('report.generated',    { type: 'weekly' });`;

  const errorSnippet = `// JS & network errors are auto-captured. To categorize a handled error in the
// Operations Center, tag the type when you report it:
window.ncpl.track('error.captured', {
  errorType: 'database',   // database | api | authentication | authorization | network | frontend
  message:   err.message,
});`;

  const envSnippet = `# ${slug} — NCPL analytics
NCPL_PROJECT=${slug}
NCPL_INGEST_KEY=${apiKey}
NCPL_ENDPOINT=${ingestEndpoint}
# Environment: ${environment}`;

  const fetchSnippet = `await fetch('${ingestEndpoint}', {
  method: 'POST',
  keepalive: true,
  headers: { 'content-type': 'application/json', 'x-ncpl-api-key': '${apiKey}' },
  body: JSON.stringify({
    events: [{
      portalId: '${slug}',
      category: 'custom',
      name: 'candidate.created',
      userId: user.id,        // or userEmail: user.email
      userName: user.fullName,
      occurredAt: new Date().toISOString(),
      metadata: { candidateId },
    }],
  }),
});`;

  const AUTO_CAPTURES = [
    'Sessions (start, end, duration)',
    'Page views & SPA navigation',
    'Clicks & form submits',
    'JavaScript & network errors',
    'Page-load performance',
    'Device, browser, OS',
  ];

  return (
    <div className="space-y-5">
      {/* Step 1 — install the script */}
      <Step n={1} title="Paste the script" badge="Required">
        <p className="text-[11px] text-muted-foreground">
          Add this to the app&apos;s <code className="rounded bg-muted px-1">&lt;head&gt;</code> (or via
          {' '}<code className="rounded bg-muted px-1">&lt;Script&gt;</code> in Next.js). It captures everything below
          automatically — no code. The one thing it <strong>can&apos;t</strong> do alone is know a user&apos;s real
          name; that&apos;s Step 2.
        </p>
        <CopyBlock title="The tracking tag" code={scriptSnippet} recommended />
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Automatically captures (zero code)</div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {AUTO_CAPTURES.map((c) => (
              <li key={c} className="flex items-start gap-1.5 text-[11px]">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /><span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </Step>

      {/* Step 2 — identify (the part everyone misses) */}
      <Step n={2} title="Show real names — one identify() call" badge="Required for names">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-[11px]">
          <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Without this, the dashboard shows a short ID like <code className="rounded bg-muted px-1">8ec3628a</code>.
            The script never guesses names — the name is <strong>only</strong> what you pass here. Use the value your
            app already has (the name you render in your own UI), so there&apos;s nothing to fetch and nothing to
            permission.
          </span>
        </div>
        <CopyBlock title="Identify on sign-in" code={identifySnippet} recommended />
        <p className="text-[11px] text-muted-foreground">React / Next.js — drop this component where the user is loaded:</p>
        <CopyBlock title="React / Next.js helper" code={reactIdentifySnippet} />
      </Step>

      {/* Step 3 — business events (optional) */}
      <Step n={3} title="Track business events" badge="Optional">
        <p className="text-[11px] text-muted-foreground">
          The only thing the script can&apos;t infer. Fire one wherever a meaningful action happens.
        </p>
        <CopyBlock title="Business events" code={businessEventsSnippet} />
      </Step>

      {/* Advanced */}
      <details className="rounded-md border bg-muted/20">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
          Advanced (optional) — Next.js tag, error tagging, env vars, server-side
        </summary>
        <div className="space-y-4 p-3 pt-1">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold">Next.js App Router — same tag via next/script</div>
            <CopyBlock title="next/script" code={nextScriptSnippet} />
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-semibold">Tag handled errors for sharper categorization</div>
            <CopyBlock title="Error tagging" code={errorSnippet} />
          </div>
          <CopyBlock title="Environment variables" code={envSnippet} />
          <CopyBlock title="Server-side / any language (plain fetch)" code={fetchSnippet} />
        </div>
      </details>

      {/* Verify */}
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-[11px]">
        <div className="mb-1 font-medium">Verify it&apos;s working</div>
        <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
          <li>Load the app and sign in — page views appear in <strong>Live Activity</strong> within ~1 minute (shown against a short ID at first).</li>
          <li>Once your Step&nbsp;2 <code className="rounded bg-muted px-1">identify()</code> call runs, the real name replaces that short ID — in Live Activity and Staff Intelligence.</li>
          <li>Still a short ID? Your identify call isn&apos;t firing, or <code className="rounded bg-muted px-1">name</code> is empty — check that <code className="rounded bg-muted px-1">user.fullName</code> actually has a value.</li>
        </ol>
      </div>

      <p className="text-[11px] text-muted-foreground">
        This key authenticates ingestion for <code className="rounded bg-muted px-1">{slug}</code> only — it can create
        events, nothing else. Names come <strong>only</strong> from the value you pass to{' '}
        <code className="rounded bg-muted px-1">identify()</code>; nothing is read from your database and no auth token is ever sent.
      </p>
    </div>
  );
}
