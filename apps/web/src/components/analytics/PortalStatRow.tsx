import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PORTALS } from '@/config/portals';
import { PORTAL_COLOR } from '@/components/charts/ChartTheme';
import type { PortalSummary } from '@/types/analytics';

interface PortalStatRowProps {
  summary: PortalSummary;
}

const fmt = new Intl.NumberFormat('en-US');

export function PortalStatRow({ summary }: PortalStatRowProps) {
  const config = PORTALS[summary.portalId];
  const color = PORTAL_COLOR[summary.portalId] ?? '';
  const errorRate = summary.events24h > 0 ? summary.errors24h / summary.events24h : 0;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <div>
            <div className="text-sm font-semibold">{config.name}</div>
            <div className="text-xs text-muted-foreground">{config.description}</div>
          </div>
        </div>
        {errorRate > 0.01 ? (
          <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400">
            elevated errors
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            healthy
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-4 pb-4 text-sm">
        <Metric label="Events 24h" value={fmt.format(summary.events24h)} />
        <Metric label="Users 24h" value={fmt.format(summary.users24h)} />
        <Metric label="Sessions 24h" value={fmt.format(summary.sessions24h)} />
        <Metric label="Errors 24h" value={fmt.format(summary.errors24h)} accent={summary.errors24h > 0} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={accent ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold'}>{value}</div>
    </div>
  );
}
