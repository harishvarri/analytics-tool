import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async () => {
  return ok({
    status: 'healthy',
    service: 'ncpl-analytics-web',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});
