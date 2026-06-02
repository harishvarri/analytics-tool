'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Global header refresh control. Calls router.refresh() to re-run every
 * server component on the current page (KPIs, charts, tables) and bumps a
 * shared "refresh nonce" the live feed listens to, so realtime state is reset
 * too. Shows a spinner while the refresh transition is pending and a
 * "last refreshed" relative timestamp.
 *
 * Optionally auto-refreshes on an interval (default 60s) — replaces the silent
 * <AutoRefresh> with a visible, user-controllable control.
 */
export function RefreshButton({ autoMs = 60_000 }: { autoMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<number>(() => Date.now());
  const [, force] = useState(0);

  const doRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      // Broadcast to client-only surfaces (e.g. the live feed) that a manual
      // refresh happened, so they can reset their buffers.
      try { window.dispatchEvent(new CustomEvent('ncpl:refresh')); } catch { /* no-op */ }
      setLastRefreshed(Date.now());
    });
  }, [router]);

  // Auto-refresh on an interval (visible — the timestamp updates).
  useEffect(() => {
    if (!autoMs) return;
    const id = setInterval(doRefresh, autoMs);
    return () => clearInterval(id);
  }, [autoMs, doRefresh]);

  // Tick once a second so the "x ago" label stays live.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] tabular-nums text-muted-foreground lg:inline">
        Updated {relativeShort(Date.now() - lastRefreshed)}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={doRefresh}
        disabled={isPending}
        aria-label="Refresh dashboard data"
        title="Refresh all dashboard data"
        className="h-8 gap-1.5 px-2.5 text-xs"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
        <span className="hidden sm:inline">{isPending ? 'Refreshing…' : 'Refresh'}</span>
      </Button>
    </div>
  );
}

function relativeShort(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
