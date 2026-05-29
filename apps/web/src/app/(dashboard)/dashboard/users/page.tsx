import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/analytics/DataTable';
import { PageHeader } from '@/components/analytics/PageHeader';
import { ExportButton } from '@/components/shared/ExportButton';
import { fetchActiveUsers } from '@/lib/data/fetchers';
import { formatRelativeTime } from '@/lib/utils';
import type { UserActivityRow } from '@/lib/repositories/analytics';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-US');

const columns: Column<UserActivityRow>[] = [
  {
    key: 'user',
    header: 'User',
    render: (u) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-[10px]">
            {(u.displayName ?? u.email ?? '??').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{u.displayName ?? '—'}</div>
          <div className="truncate text-xs text-muted-foreground">{u.email ?? u.userId}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'events',
    header: 'Events (30d)',
    align: 'right',
    render: (u) => <span className="font-mono">{fmt.format(u.events24h)}</span>,
  },
  {
    key: 'lastSeen',
    header: 'Last seen',
    align: 'right',
    render: (u) => (
      <span className="text-muted-foreground">
        {u.lastSeenAt ? formatRelativeTime(u.lastSeenAt) : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    align: 'right',
    render: (u) =>
      u.events24h > 100 ? (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          power user
        </Badge>
      ) : u.events24h > 25 ? (
        <Badge variant="outline">active</Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">light</Badge>
      ),
  },
];

export default async function UsersAnalyticsPage() {
  const users = await fetchActiveUsers(25);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Who's using your apps, how often they come back, and what each person does."
        actions={
          <ExportButton
            filename="users"
            headers={['User', 'Email / ID', 'Events (30d)', 'Last seen']}
            rows={users.map((u) => [
              u.displayName ?? '—',
              u.email ?? u.userId,
              u.events24h,
              u.lastSeenAt ?? '',
            ])}
          />
        }
      />
      <DataTable
        columns={columns}
        rows={users}
        rowKey={(u) => u.userId}
        empty="No user activity recorded yet."
      />
    </div>
  );
}
