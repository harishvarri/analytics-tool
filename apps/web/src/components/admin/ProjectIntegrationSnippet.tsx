'use client';

import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Auto-generated integration snippets for a project, with copy-to-clipboard.
 * The hosted ncpl.js auto-capture script is the recommended (zero-code) path;
 * the SDK and plain-fetch options are shown as advanced alternatives.
 */

const INGEST_ENDPOINT = 'https://ncpl-analytics-tool.vercel.app/api/v1/events';
const SCRIPT_SRC = INGEST_ENDPOINT.replace('/api/v1/events', '/ncpl.js');

interface Props {
  slug: string;
  apiKey: string;
  environment: string;
}

function CopyBlock({
  title,
  code,
  recommended,
}: {
  title: string;
  code: string;
  recommended?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
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
      <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ProjectIntegrationSnippet({ slug, apiKey, environment }: Props) {
  const scriptSnippet = `<script
  defer
  src="${SCRIPT_SRC}"
  data-project="${slug}"
  data-key="${apiKey}"></script>`;

  const sdkSnippet = `import { AnalyticsClient } from '@ncpl/analytics-sdk';

export const analytics = new AnalyticsClient({
  endpoint: '${INGEST_ENDPOINT}',
  apiKey: '${apiKey}',
  portalId: '${slug}',
  defaults: { environment: '${environment}' },
});

// Auto-tracks page views, errors, performance; or fire custom events:
analytics.track('feature.used', { name: 'export' });`;

  const fetchSnippet = `await fetch('${INGEST_ENDPOINT}', {
  method: 'POST',
  keepalive: true,
  headers: {
    'content-type': 'application/json',
    'x-ncpl-api-key': '${apiKey}',
  },
  body: JSON.stringify({
    events: [{
      portalId: '${slug}',
      category: 'feature',
      name: 'feature.used',
      occurredAt: new Date().toISOString(),
      metadata: { example: true },
    }],
  }),
});`;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs">
        <div className="font-medium">Recommended — auto-capture, no developer code</div>
        <p className="mt-1 text-muted-foreground">
          Add this one tag to the application&apos;s <code className="rounded bg-muted px-1">&lt;head&gt;</code>{' '}
          (paste once, or have the platform team open a 1-line PR). It automatically captures page
          views, route changes, sessions, clicks, device info, performance, and errors.
        </p>
      </div>

      <CopyBlock title="Script tag (recommended)" code={scriptSnippet} recommended />

      <details className="rounded-md border bg-muted/20">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
          Advanced — SDK &amp; manual event API
        </summary>
        <div className="space-y-3 p-3 pt-0">
          <CopyBlock title="SDK (React / Next.js / Node — same monorepo)" code={sdkSnippet} />
          <CopyBlock title="Plain fetch (any runtime / language)" code={fetchSnippet} />
        </div>
      </details>

      <p className="text-[11px] text-muted-foreground">
        This key authenticates ingestion for <code className="rounded bg-muted px-1">{slug}</code>.
        It can only create events — no read, admin, or data access. The shared organization key also works.
      </p>
    </div>
  );
}
