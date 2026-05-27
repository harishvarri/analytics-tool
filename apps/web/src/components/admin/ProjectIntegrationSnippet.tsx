'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Renders the auto-generated SDK integration snippet for a project, with
 * copy-to-clipboard. Shown right after onboarding (Step 3 of the flow).
 */

const INGEST_ENDPOINT = 'https://ncpl-analytics-tool.vercel.app/api/v1/events';

interface Props {
  slug:        string;
  apiKey:      string;
  environment: string;
}

function CopyBlock({ title, code }: { title: string; code: string }) {
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
    <div className="rounded-md border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
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
  const sdkSnippet = `import { AnalyticsClient } from '@ncpl/analytics-sdk';

export const analytics = new AnalyticsClient({
  endpoint: '${INGEST_ENDPOINT}',
  apiKey: '${apiKey}',
  portalId: '${slug}',
  defaults: { environment: '${environment}' },
});

// Auto-track is opt-in; or fire custom events:
analytics.track('feature.used', { name: 'export' });`;

  const fetchSnippet = `// Zero-dependency option (any JS runtime)
await fetch('${INGEST_ENDPOINT}', {
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
      <CopyBlock title="SDK (React / Next.js / Node)" code={sdkSnippet} />
      <CopyBlock title="Plain fetch (any runtime)" code={fetchSnippet} />
      <p className="text-[11px] text-muted-foreground">
        This key authenticates ingestion for <code className="rounded bg-muted px-1">{slug}</code>.
        The shared organization key also works. Keep keys server-side where possible.
      </p>
    </div>
  );
}
