'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProjectIntegrationSnippet } from './ProjectIntegrationSnippet';
import type { Project } from '@/lib/repositories/projects';

export interface ProjectStatusInfo {
  status: 'healthy' | 'warning' | 'critical';
  healthScore: number;
  lastActivityAt: string | null;
  activeUsers7d: number;
}

interface Props {
  project: Project;
  envToneClass: string;
  status?: ProjectStatusInfo | null;
}

const STATUS_TONE: Record<string, string> = {
  healthy:  'text-emerald-600 dark:text-emerald-400',
  warning:  'text-amber-600 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
};
const STATUS_DOT: Record<string, string> = {
  healthy: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-rose-500',
};

function maskKey(key: string): string {
  if (key.length <= 12) return '••••••';
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

export function ProjectSnippetRow({ project: p, envToneClass, status }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border bg-card">
      {/* Summary row — click to toggle snippet */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-muted/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {status && <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status.status]}`} title={status.status} />}
            <span className="font-semibold">{p.name}</span>
            <code className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{p.slug}</code>
            <Badge variant="outline" className={`text-[10px] ${envToneClass}`}>{p.environment}</Badge>
            {p.trackingEnabled
              ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">● Active</span>
              : <span className="text-[10px] text-muted-foreground">○ Paused</span>}
            {status && (
              <span className={`text-[10px] ${STATUS_TONE[status.status]}`}>
                Health {status.healthScore}
              </span>
            )}
          </div>
          {p.description && <div className="text-[10px] text-muted-foreground mt-0.5">{p.description}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <KeyRound className="h-3 w-3" />{maskKey(p.apiKey)}
          </span>
          <span className="text-[10px] text-primary font-medium">
            {open ? 'Hide snippet' : 'View snippet'}
          </span>
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable snippet */}
      {open && (
        <div className="border-t px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">
              {status
                ? `Live: ${status.activeUsers7d} active users (7d)${status.lastActivityAt ? ` · last activity ${new Date(status.lastActivityAt).toLocaleDateString()}` : ''}`
                : 'No activity recorded yet.'}
            </span>
            <Link href={`/dashboard/projects/${p.slug}`} className="font-medium text-primary hover:underline">
              View live intelligence →
            </Link>
          </div>
          <ProjectIntegrationSnippet
            slug={p.slug}
            apiKey={p.apiKey}
            environment={p.environment}
          />
        </div>
      )}
    </div>
  );
}
