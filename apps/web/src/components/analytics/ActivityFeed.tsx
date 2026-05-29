import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EventBadge } from './EventBadge';
import { formatRelativeTime } from '@/lib/utils';
import { friendlyEventName } from '@/lib/event-labels';
import type { RealtimeActivityItem } from '@/types/analytics';

interface ActivityFeedProps {
  items: RealtimeActivityItem[];
  empty?: string;
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
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(item.occurredAt)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground" title={item.eventName}>
                {friendlyEventName(item.eventName)}
              </span>
              <span className="mx-1.5">·</span>
              <span>{item.portalName}</span>
              {item.url ? (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono">{item.url}</span>
                </>
              ) : null}
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
