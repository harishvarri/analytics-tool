export const siteConfig = {
  name: 'NCPL Operational Intelligence',
  shortName: 'NCPL OI',
  description:
    'Organisation-wide visibility across every NCPL product — who is using what, what is broken, and what changed this week.',
  company: 'NCPL Consultancy',
  url: 'https://intelligence.ncpl.internal',
  supportEmail: 'platform@ncpl.internal',
} as const;

export type SiteConfig = typeof siteConfig;
