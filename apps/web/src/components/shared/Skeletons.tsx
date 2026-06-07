import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-60" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

/**
 * Generic full-page skeleton: header + KPI strip + content cards. Used by the
 * per-route loading.tsx files so every page has a consistent loading state
 * instead of a blank flash. Tune the counts per page where it helps.
 */
export function PageSkeleton({ kpis = 4, cards = 2 }: { kpis?: number; cards?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-7 w-28" />
      </div>
      {kpis > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </section>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: cards }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </section>
    </div>
  );
}
