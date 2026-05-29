import { z } from 'zod';

/**
 * Directory sync contract — the central SSO pushes the user directory + each
 * user's allowed projects to POST /api/v1/directory (on login + nightly).
 */

export const directoryUserSchema = z
  .object({
    id: z.string().uuid(), // central user uuid (= analytics_users.id)
    email: z.string().email().max(320),
    name: z.string().max(200),
    role: z.string().max(40).optional(), // platform role (member/admin/owner)
    department: z.string().max(120).nullable().optional(),
    team: z.string().max(120).nullable().optional(),
    title: z.string().max(160).nullable().optional(),
    status: z.enum(['active', 'inactive', 'invited']).default('active'),
    isInternal: z.boolean().default(true),
    allowedProjects: z.array(z.string().min(1).max(64)).max(500).default([]),
  })
  .strict();

export const directorySyncSchema = z
  .object({
    syncId: z.string().max(120).optional(),
    mode: z.enum(['full', 'delta']).default('full'),
    users: z.array(directoryUserSchema).min(1).max(5000),
  })
  .strict();

// Use INPUT types: parseBody infers the input shape (fields with .default() are
// optional there). syncDirectory coalesces those defaults at runtime.
export type DirectoryUserInput = z.input<typeof directoryUserSchema>;
export type DirectorySyncInput = z.input<typeof directorySyncSchema>;
