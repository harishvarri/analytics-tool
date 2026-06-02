import type { RealtimeActivityItem } from '@/types/analytics';

/**
 * A feed row that may represent multiple occurrences of the same
 * (person, action, product) collapsed together.
 */
export interface AggregatedActivity extends RealtimeActivityItem {
  /** How many raw events this row represents (≥1). */
  count: number;
  /** Oldest occurrence timestamp in the group (for "N times in last Xm"). */
  firstOccurredAt: string;
}

/**
 * Collapse repeated activity so the feed reads like an operational summary, not
 * a raw event stream. Events are grouped by (user, eventName, portal); each
 * group becomes a single row carrying the latest timestamp + an occurrence
 * count. Groups are returned newest-first by their most recent occurrence.
 *
 *   Harish · dashboard.viewed · ×15   →  "viewed dashboard 15 times in last 30m"
 *
 * Only events within `windowMs` of the newest event are aggregated together;
 * older repeats start a new group so a burst yesterday and one today stay
 * distinct.
 */
export function aggregateActivity(
  items: RealtimeActivityItem[],
  windowMs = 30 * 60 * 1000,
): AggregatedActivity[] {
  const groups = new Map<string, AggregatedActivity>();

  for (const it of items) {
    const who = it.userId ?? it.userEmail ?? 'anon';
    const t = new Date(it.occurredAt).getTime();
    // Bucket by window so distant repeats don't merge.
    const bucket = Math.floor(t / windowMs);
    const key = `${who}|${it.eventName}|${it.portalId}|${bucket}`;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...it, count: 1, firstOccurredAt: it.occurredAt });
    } else {
      existing.count += 1;
      // Keep the newest occurredAt (items arrive newest-first, but be safe).
      if (it.occurredAt > existing.occurredAt) existing.occurredAt = it.occurredAt;
      if (it.occurredAt < existing.firstOccurredAt) existing.firstOccurredAt = it.occurredAt;
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

/** Human label for the span an aggregated group covers, e.g. "in the last 12m". */
export function spanLabel(firstISO: string, lastISO: string): string {
  const ms = Math.max(0, new Date(lastISO).getTime() - new Date(firstISO).getTime());
  const min = Math.round(ms / 60000);
  if (min < 1) return 'in the last minute';
  if (min < 60) return `in the last ${min}m`;
  const h = Math.round(min / 60);
  return `in the last ${h}h`;
}
