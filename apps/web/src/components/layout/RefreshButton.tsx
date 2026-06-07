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

  // Auto-refresh on an interval, but ONLY while the tab is visible. When the
  // user leaves we stop the timer (no wasted queries); when they return we
  // refresh immediately and resume — so they always see current data.
  useEffect(() => {
    if (!autoMs) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (id === null) id = setInterval(() => { if (document.visibilityState === 'visible') doRefresh(); }, autoMs); };
    const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { doRefresh(); start(); }
      else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
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
