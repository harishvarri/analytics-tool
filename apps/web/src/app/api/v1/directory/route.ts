import type { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { parseBody } from '@/lib/api/validate';
import { requireDirectoryKey } from '@/lib/api/auth';
import { directorySyncSchema } from '@/lib/schemas/directory';
import { syncDirectory } from '@/lib/repositories/directory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/directory
 * The central SSO pushes the user directory + each user's allowed projects.
 *
 *  - Auth:  `x-ncpl-api-key` = DIRECTORY_API_KEY (privileged; can deactivate users)
 *  - Body:  { mode: 'full' | 'delta', users: DirectoryUser[] }
 *  - Result:{ ok: true, data: DirectorySyncResult }
 *
 * Idempotent. `mode: 'full'` soft-deactivates directory users absent from the
 * snapshot (guarded by a coverage floor); `mode: 'delta'` never deactivates.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  requireDirectoryKey(req);
  const { mode, users } = await parseBody(req, directorySyncSchema);
  const result = await syncDirectory(users, { mode: mode ?? 'full' });
  return ok(result);
});
