'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Global header refresh control. Does a FULL app reload (window.location.reload)
 * so every page, layout, client state, and the tracking script reload from
 * scratch — not just the current route's server components. Auto-reloads on an
 * interval (default 60s) while the tab is visible.
 */
export function RefreshButton({ autoMs = 60_000 }: { autoMs?: number }) {
  const [isPending, setIsPending] = useState(false);
  // Countdown to the next auto-reload, for the header label.
  const [nextInMs, setNextInMs] = useState<number>(autoMs);

  const doRefresh = useCallback(() => {
    setIsPending(true);
    try { window.location.reload(); } catch { /* no-op */ }
  }, []);

  // Hard reload on an interval, but ONLY while the tab is visible. When the user
  // leaves we stop the timer (no wasted reload); when they return we reload
  // immediately so they always land on current data.
  useEffect(() => {
    if (!autoMs) return;
    let deadline = Date.now() + autoMs;
    let tick: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (tick !== null) return;
      deadline = Date.now() + autoMs;
      tick = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        const left = deadline - Date.now();
        setNextInMs(Math.max(0, left));
        if (left <= 0) doRefresh();
      }, 1000);
    };
    const stop = () => { if (tick !== null) { clearInterval(tick); tick = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') doRefresh(); // reload on return
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [autoMs, doRefresh]);

  return (
    <div className="flex items-center gap-2">
      {autoMs > 0 && (
        <span className="hidden text-[11px] tabular-nums text-muted-foreground lg:inline">
          Auto-refresh in {Math.ceil(nextInMs / 1000)}s
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={doRefresh}
        disabled={isPending}
        aria-label="Refresh the whole app"
        title="Reload the entire app now"
        className="h-8 gap-1.5 px-2.5 text-xs"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
        <span className="hidden sm:inline">{isPending ? 'Reloading…' : 'Refresh'}</span>
      </Button>
    </div>
  );
}
