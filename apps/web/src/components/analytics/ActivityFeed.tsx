import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EventBadge } from './EventBadge';
import { formatRelativeTime } from '@/lib/utils';
import { friendlyEventName, eventDescription } from '@/lib/event-labels';
import type { RealtimeActivityItem } from '@/types/analytics';

/** Feed item, optionally carrying an aggregated occurrence count. */
type FeedItem = RealtimeActivityItem & { count?: number; firstOccurredAt?: string };

interface ActivityFeedProps {
  items: FeedItem[];
  empty?: string;
}

function spanLabel(firstISO: string, lastISO: string): string {
  const ms = Math.max(0, new Date(lastISO).getTime() - new Date(firstISO).getTime());
  const min = Math.round(ms / 60000);
  if (min < 1) return 'in the last minute';
  if (min < 60) return `in the last ${min}m`;
  const h = Math.round(min / 60);
  return `in the last ${h}h`;
}

export function ActivityFeed({ items, empty = 'No activity in the last 5 minutes.' }: ActivityFeedProps) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[10px]">
              {initials(item.userDisplayName ?? item.userEmail ?? '??')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {item.userDisplayName ?? item.userEmail ?? 'Anonymous'}
              </span>
              <EventBadge category={item.category} />
              {item.count && item.count > 1 ? (
                <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary">
                  ×{item.count}
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(item.occurredAt)}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground" title={item.eventName}>
                {friendlyEventName(item.eventName, item.metadata, item.url)}
              </span>
              <span className="mx-1.5">·</span>
              {/* Cross-project emphasis: which product the action happened in */}
              <span className="font-medium text-foreground/80">{item.portalName}</span>
            </div>
            {/* Plain-English note; for aggregated rows, show the occurrence summary */}
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground/80">
              {item.count && item.count > 1 && item.firstOccurredAt
                ? `${item.count} times ${spanLabel(item.firstOccurredAt, item.occurredAt)}`
                : eventDescription(item.eventName, item.metadata, item.url)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function initials(s: string): string {
  return s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
