import { Badge } from '@/components/ui/badge';
import type { EventCategory } from '@/types/analytics';
import { cn } from '@/lib/utils';

const CATEGORY_STYLES: Record<EventCategory, string> = {
  auth: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  navigation: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  feature: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  interaction: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  custom: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function EventBadge({ category }: { category: EventCategory }) {
  return (
    <Badge variant="outline" className={cn('font-mono text-[10px] uppercase', CATEGORY_STYLES[category])}>
      {category}
    </Badge>
  );
}
