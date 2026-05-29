/**
 * Feature flags.
 *
 * `directory` gates the Operational-Intelligence views that depend on a central
 * SSO pushing the user directory + per-user access (People Directory, Access vs
 * Usage, Inactive Users, and the Command-Center org snapshot). Until that
 * integration exists, those views have no data, so they are hidden and the
 * platform focuses on per-project event analytics.
 *
 * Turn on in production by setting NEXT_PUBLIC_DIRECTORY_ENABLED=true (the
 * directory endpoint, schema, and pages are already built and waiting).
 */
export const FEATURES = {
  directory: process.env.NEXT_PUBLIC_DIRECTORY_ENABLED === 'true',
} as const;
