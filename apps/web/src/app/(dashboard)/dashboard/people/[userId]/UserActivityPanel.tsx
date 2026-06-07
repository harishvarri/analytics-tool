'use client';

import { useMemo, useState } from 'react';
import { UserTimeline, type TimelineEvent } from '@/components/analytics/UserTimeline';
import { friendlyEventName } from '@/lib/event-labels';

type Range = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const TABS: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All' },
];

const DAY = 86_400_000;

function inRange(iso: string, range: Range, now: number): boolean {
  if (range === 'all') return true;
  const t = new Date(iso).getTime();
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  switch (range) {
    case 'today': return t >= startToday;
    case 'yesterday': return t >= startToday - DAY && t < startToday;
    case 'week': return t >= now - 7 * DAY;
    case 'month': return t >= now - 30 * DAY;
  }
}

export function UserActivityPanel({ events, userName }: { events: TimelineEvent[]; userName: string }) {
  const [range, setRange] = useState<Range>('all');
  const now = Date.now();

  const filtered = useMemo(() => events.filter((e) => inRange(e.occurredAt, range, now)), [events, range, now]);

  const stats = useMemo(() => {
    const products = new Set(filtered.map((e) => e.portalId));
    const byAction = new Map<string, number>();
    for (const e of filtered) {
      const label = friendlyEventName(e.name, e.metadata, e.url);
      byAction.set(label, (byAction.get(label) ?? 0) + 1);
    }
    const topActions = [...byAction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    // Active days in range → rough "how many days were they working".
    const days = new Set(filtered.map((e) => new Date(e.occurredAt).toISOString().slice(0, 10)));
    return { count: filtered.length, products: products.size, topActions, activeDays: days.size };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Range tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setRange(t.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              range === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Range summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={stats.count} label="business actions" />
        <Stat value={stats.products} label="products used" />
        <Stat value={stats.activeDays} label="active days" />
      </div>

      {/* Top actions for the range */}
      {stats.topActions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Most frequent actions</p>
          <ul className="space-y-1">
            {stats.topActions.map(([label, n]) => (
              <li key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">×{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline */}
      <div className="border-t pt-3">
        <UserTimeline events={filtered.slice(0, 60)} userName={userName}
          empty={range === 'all' ? 'No business activity recorded yet.' : 'No business activity in this period.'} />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border bg-muted/30 py-2">
      <div className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
