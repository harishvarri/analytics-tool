import { z } from 'zod';

/**
 * Server-side env schema. Validated at import time.
 * Importing this file in client code will throw — that's intentional.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  /** Shared secret portals stamp on `x-ncpl-api-key` when sending events. */
  INGEST_API_KEY: z.string().min(16).optional(),
  /** Salt for IP hashing (rotate to invalidate historical lookups). */
  IP_HASH_SALT: z.string().min(8).default('ncpl-default-salt-change-me'),

  /** Secret required to invoke /api/v1/admin/* maintenance routes. */
  CRON_SECRET: z.string().min(16).optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

const clientSchema = serverSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_APP_URL: true,
});

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
}

function parseServerEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `\n❌ Invalid server environment variables:\n${formatIssues(parsed.error.issues)}\n\n` +
        `Copy apps/web/.env.example to apps/web/.env.local and fill in the values.\n`,
    );
  }
  return parsed.data;
}

function parseClientEnv() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `\n❌ Invalid public environment variables:\n${formatIssues(parsed.error.issues)}\n`,
    );
  }
  return parsed.data;
}

let cachedServerEnv: ServerEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

function getRuntimeEnv(): ServerEnv | ClientEnv {
  if (typeof window === 'undefined') {
    cachedServerEnv ??= parseServerEnv();
    return cachedServerEnv;
  }
  cachedClientEnv ??= parseClientEnv();
  return cachedClientEnv;
}

export const env = new Proxy({} as ServerEnv, {
  get(_target, prop: keyof ServerEnv) {
    return getRuntimeEnv()[prop as keyof ReturnType<typeof getRuntimeEnv>];
  },
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
