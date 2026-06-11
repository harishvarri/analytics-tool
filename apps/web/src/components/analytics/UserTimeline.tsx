import { getPortalConfig } from '@/config/portals';
import { PORTAL_COLOR } from '@/components/charts/ChartTheme';
import { friendlyEventName, eventDescription } from '@/lib/event-labels';
import { formatRelativeTime } from '@/lib/utils';
import { LocalTime } from '@/components/shared/LocalTime';

export interface TimelineEvent {
  name: string;
  category: string;
  portalId: string;
  occurredAt: string;
  url: string | null;
  metadata: Record<string, unknown> | null;
}

interface UserTimelineProps {
  events: TimelineEvent[];
  userName?: string | null;
  empty?: string;
}

// Deterministic fallback palette for portals not in PORTAL_COLOR.
const FALLBACK_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444'];
function portalColor(portalId: string): string {
  if (PORTAL_COLOR[portalId]) return PORTAL_COLOR[portalId];
  let hash = 0;
  for (let i = 0; i < portalId.length; i++) hash = (hash * 31 + portalId.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]!;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  if (isToday) return 'Today';
  if (isYest) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Cross-app chronological timeline for a single user. Each entry shows the
 * human-readable event (page/feature name), the product it happened in (color
 * dot), and time. Day separators and app-switch markers give context that the
 * old flat list lacked.
 */
export function UserTimeline({ events, userName, empty = 'No recent activity.' }: UserTimelineProps) {
  if (events.length === 0) {
    return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</div>;
  }

  let lastDay = '';
  let lastPortal = '';

  return (
    <ol className="relative space-y-1">
      {events.map((e, i) => {
        const color = portalColor(e.portalId);
        const portalName = (() => {
          try { return getPortalConfig(e.portalId).name; } catch { return e.portalId; }
        })();
        const day = dayLabel(e.occurredAt);
        const showDay = day !== lastDay;
        const switchedApp = e.portalId !== lastPortal && lastPortal !== '';
        lastDay = day;
        lastPortal = e.portalId;

        return (
          <li key={`${e.name}-${i}`}>
            {showDay && (
              <div className="sticky top-0 z-10 -mx-1 mb-1 mt-3 bg-background/80 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur first:mt-0">
                {day}
              </div>
            )}
            <div className="flex items-start gap-3 py-1.5">
              {/* App color rail + dot */}
              <div className="flex flex-col items-center self-stretch pt-1">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background" style={{ background: color }} />
                <span className="mt-0.5 w-px flex-1 bg-border" />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium" title={e.name}>
                    {friendlyEventName(e.name, e.metadata, e.url)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title={formatRelativeTime(e.occurredAt)}>
                    <LocalTime iso={e.occurredAt} mode="time" />
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-medium" style={{ color }}>{portalName}</span>
                  {switchedApp && (
                    <span className="rounded bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground/80">
                      switched app
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground/80">
                  {eventDescription(e.name, e.metadata, e.url, userName, portalName)}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
