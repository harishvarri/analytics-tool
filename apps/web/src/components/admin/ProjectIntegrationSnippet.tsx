'use client';

import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Complete integration kit for a project — everything an app needs to be a
 * first-class operational-intelligence citizen, not just a tracking tag:
 *   1. Install the tracker        (page views, sessions, errors — zero code)
 *   2. Identify users on login    (turns "Anonymous" into real names)
 *   3. Track business events      (candidate.created, attendance.marked, …)
 *   4. Tag errors                 (feeds the Error Intelligence Center)
 *   + env vars, advanced SDK/fetch, and a verification checklist.
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{n}</span>
        <h4 className="text-xs font-semibold">{title}</h4>
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

  const identifySnippet = `// Call this right after the user signs in.
// Turns "Unidentified visitor" into a real person in the dashboard.
window.ncpl.identify(null, {
  email: user.email,      // required to resolve a name
  name:  user.fullName,   // optional display name
});
// (If you have a central user UUID, pass it as the 1st arg instead of null.)

// On logout, reset back to anonymous:
window.ncpl.identify(null);`;

  const businessEventsSnippet = `// Track the BUSINESS actions that matter — these power the
// operational feed, department & user intelligence, and reports.
window.ncpl.track('candidate.created',   { candidateId, department });
window.ncpl.track('attendance.marked',   { batchId });
window.ncpl.track('course.completed',    { courseId });
window.ncpl.track('interview.scheduled', { candidateId });
window.ncpl.track('report.generated',    { type: 'weekly' });
window.ncpl.track('document.uploaded',   { fileName });
// Naming convention: "<entity>.<action>" (e.g. invoice.paid, ticket.created).`;

  const errorSnippet = `// Errors are auto-captured. To categorize them in the Error
// Intelligence Center, tag the type when you report one manually:
window.ncpl.track('error.captured', {
  errorType: 'database',          // database | api | authentication | authorization | network | frontend
  message:   err.message,
});`;

  const envSnippet = `# ${slug} — NCPL analytics
NCPL_PROJECT=${slug}
NCPL_INGEST_KEY=${apiKey}
NCPL_ENDPOINT=${ingestEndpoint}
# Environment: ${environment}`;

  const sdkSnippet = `import { AnalyticsClient } from '@ncpl/analytics-sdk';

export const analytics = new AnalyticsClient({
  endpoint: '${ingestEndpoint}',
  apiKey: '${apiKey}',
  portalId: '${slug}',
  defaults: { environment: '${environment}' },
});

analytics.identify(null, { email: user.email, name: user.fullName });
analytics.track('candidate.created', { candidateId });`;

  const fetchSnippet = `await fetch('${ingestEndpoint}', {
  method: 'POST',
  keepalive: true,
  headers: { 'content-type': 'application/json', 'x-ncpl-api-key': '${apiKey}' },
  body: JSON.stringify({
    events: [{
      portalId: '${slug}',
      category: 'custom',
      name: 'candidate.created',
      userEmail: user.email,
      occurredAt: new Date().toISOString(),
      metadata: { candidateId },
    }],
  }),
});`;

  return (
    <div className="space-y-5">
      <Step n={1} title="Install the tracker (one tag, zero code)">
        <p className="text-[11px] text-muted-foreground">
          Paste into the app&apos;s <code className="rounded bg-muted px-1">&lt;head&gt;</code>. Auto-captures page
          views, sessions, clicks, performance, and errors.
        </p>
        <CopyBlock title="Script tag (recommended)" code={scriptSnippet} recommended />
      </Step>

      <Step n={2} title="Identify users on login (gets real names)">
        <p className="text-[11px] text-muted-foreground">
          Without this, everyone shows as &quot;Unidentified visitor.&quot; This single call links activity to the real person.
        </p>
        <CopyBlock title="Identify on login" code={identifySnippet} recommended />
      </Step>

      <Step n={3} title="Track business events">
        <p className="text-[11px] text-muted-foreground">
          The operational dashboards surface these — not page views. Fire one wherever a meaningful action happens.
        </p>
        <CopyBlock title="Business events" code={businessEventsSnippet} />
      </Step>

      <Step n={4} title="Tag errors (optional, sharpens Error Intelligence)">
        <CopyBlock title="Error tagging" code={errorSnippet} />
      </Step>

      <details className="rounded-md border bg-muted/20">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
          Environment variables, SDK &amp; server-side options
        </summary>
        <div className="space-y-3 p-3 pt-0">
          <CopyBlock title="Environment variables" code={envSnippet} />
          <CopyBlock title="SDK (React / Next.js / Node)" code={sdkSnippet} />
          <CopyBlock title="Plain fetch (any runtime / language)" code={fetchSnippet} />
        </div>
      </details>

      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-[11px]">
        <div className="mb-1 font-medium">Verify it&apos;s working</div>
        <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
          <li>Load the app, then sign in (fires identify + auth.login).</li>
          <li>Open this product&apos;s <strong>Project Intelligence</strong> page — activity appears within ~1 minute.</li>
          <li>Check <strong>Staff Intelligence</strong> — your name should replace &quot;Unidentified.&quot;</li>
        </ol>
      </div>

      <p className="text-[11px] text-muted-foreground">
        This key authenticates ingestion for <code className="rounded bg-muted px-1">{slug}</code> only — it can create
        events, nothing else. Keep it in the app&apos;s env, not in client-visible source where possible.
      </p>
    </div>
  );
}
