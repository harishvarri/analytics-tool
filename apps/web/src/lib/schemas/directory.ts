import { z } from 'zod';

export const directoryUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(320),
  displayName: z.string().max(200).nullable().optional(),
  role: z.string().max(64).optional(),
  department: z.string().max(100).nullable().optional(),
  team: z.string().max(100).nullable().optional(),
  title: z.string().max(100).nullable().optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
  isInternal: z.boolean().optional(),
  access: z.array(z.string()).optional(), // array of project slugs (portals)
});

export const syncDirectorySchema = z.object({
  users: z.array(directoryUserSchema),
});

export type DirectoryUser = z.infer<typeof directoryUserSchema>;
export type SyncDirectoryInput = z.infer<typeof syncDirectorySchema>;
