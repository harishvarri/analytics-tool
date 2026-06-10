'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, KeyRound, Loader2, Power, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScriptInstallGuide } from '@/components/shared/ScriptInstallGuide';
import { setProjectTrackingAction, type ToggleTrackingState } from '@/app/(dashboard)/dashboard/admin/projects/actions';
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

const toggleInitial: ToggleTrackingState = { ok: false };

/** Connect / disconnect control. Disconnecting stops ingestion and removes the
 *  product from health & dashboards; reconnecting restores it. Fully reversible. */
function ConnectToggle({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(setProjectTrackingAction, toggleInitial);
  const next = !enabled; // the state this button switches the project to

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="enabled" value={String(next)} />
      <button
        type="submit"
        disabled={pending}
        className={
          enabled
            ? 'inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/5 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-400 transition-colors'
            : 'inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-400 transition-colors'
        }
      >
        {pending
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : enabled ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
        {pending ? 'Saving…' : enabled ? 'Disconnect' : 'Reconnect'}
      </button>
      {state.error && <span className="text-[10px] text-rose-500">{state.error}</span>}
    </form>
  );
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
            <div className="flex items-center gap-3">
              <ConnectToggle slug={p.slug} enabled={p.trackingEnabled} />
              <Link href={`/dashboard/projects/${p.slug}`} className="font-medium text-primary hover:underline">
                View live intelligence →
              </Link>
            </div>
          </div>
          {!p.trackingEnabled && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
              This product is <strong>disconnected</strong> — it no longer ingests events and is hidden from
              health, intelligence, and dashboards. Reconnect to resume tracking; existing history is preserved.
            </div>
          )}
          <ScriptInstallGuide
            projectSlug={p.slug}
            projectName={p.name}
            apiKey={p.apiKey}
          />
        </div>
      )}
    </div>
  );
}
