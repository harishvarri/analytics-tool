'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, X } from 'lucide-react';
import { riskFromLastActive } from '@/lib/user-risk';
import { formatRelativeTime } from '@/lib/utils';

export interface PersonRow {
  userId: string;
  displayName: string | null;
  email: string | null;
  department: string | null;
  appsUsed: number;
  totalEvents: number;
  totalSessions: number;
  avgSessionMinutes: number;
  lastActiveAt: string | null;
}

type Mode = 'cross' | 'app';

/** Compact human duration for an average session length. */
function fmtMinutes(min: number): string {
  if (!min || min < 1) return '<1m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Friendly label for a row — real name → email → "Guest" (never "Unidentified"). */
function personLabel(p: PersonRow): { primary: string; secondary: string; named: boolean } {
  if (p.displayName) return { primary: p.displayName, secondary: p.email ?? `ID ${p.userId.slice(0, 8)}`, named: true };
  if (p.email) return { primary: p.email, secondary: `ID ${p.userId.slice(0, 8)}`, named: true };
  return { primary: 'Guest', secondary: `Session ${p.userId.slice(0, 8)}`, named: false };
}

type SortKey = 'recent' | 'actions' | 'sessions' | 'avgtime';

export function PeopleTable({ rows, mode }: { rows: PersonRow[]; mode: Mode }) {
  const [query, setQuery] = useState('');
  const [namedOnly, setNamedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('recent');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((p) =>
        (p.displayName ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q) ||
        p.userId.toLowerCase().includes(q),
      );
    }
    if (namedOnly) list = list.filter((p) => p.displayName || p.email);

    const sorted = [...list];
    if (sort === 'actions') sorted.sort((a, b) => b.totalEvents - a.totalEvents);
    else if (sort === 'sessions') sorted.sort((a, b) => b.totalSessions - a.totalSessions);
    else if (sort === 'avgtime') sorted.sort((a, b) => b.avgSessionMinutes - a.avgSessionMinutes);
    else sorted.sort((a, b) => new Date(b.lastActiveAt ?? 0).getTime() - new Date(a.lastActiveAt ?? 0).getTime());
    return sorted;
  }, [rows, query, namedOnly, sort]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, department…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-7 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={namedOnly} onChange={(e) => setNamedOnly(e.target.checked)} className="h-3.5 w-3.5 rounded border-muted-foreground/40" />
            Named only
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50 [&>option]:bg-popover [&>option]:text-popover-foreground">
            <option value="recent">Most recent</option>
            <option value="actions">Most actions</option>
            <option value="sessions">Most sessions</option>
            <option value="avgtime">Longest avg session</option>
          </select>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {filtered.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`
          : `${filtered.length} of ${rows.length} shown`}
      </p>

      {filtered.length === 0 ? (
        <div className="flex h-[160px] flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center">
          <Users className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No people match “{query}”.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-2 text-left font-medium">Staff member</th>
                <th className="px-2 py-2 text-right font-medium">{mode === 'cross' ? 'Products used' : 'Department'}</th>
                <th className="px-2 py-2 text-right font-medium">Actions taken</th>
                <th className="px-2 py-2 text-right font-medium">Work sessions</th>
                <th className="px-2 py-2 text-right font-medium" title="Average login-to-logout time across this person's sessions">Avg session</th>
                <th className="px-2 py-2 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const risk = riskFromLastActive(p.lastActiveAt);
                const label = personLabel(p);
                return (
                  <tr key={p.userId} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <Link href={`/dashboard/people/${p.userId}`} className="flex items-center gap-2 hover:underline">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${risk.dot}`} title={risk.label} />
                        <span className="min-w-0">
                          <span className={`block truncate font-medium ${label.named ? '' : 'text-muted-foreground'}`}>{label.primary}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{label.secondary}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {mode === 'cross' ? p.appsUsed : <span className="text-muted-foreground">{p.department ?? '—'}</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.totalEvents.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.totalSessions.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.avgSessionMinutes > 0 ? fmtMinutes(p.avgSessionMinutes) : '—'}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{p.lastActiveAt ? formatRelativeTime(p.lastActiveAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
