export const siteConfig = {
  name: 'NCPL Analytics',
  shortName: 'NCPL',
  description:
    'Centralized internal analytics platform for NCPL Consultancy — track, monitor, and analyze every internal portal.',
  company: 'NCPL Consultancy',
  url: 'https://analytics.ncpl.internal',
  supportEmail: 'platform@ncpl.internal',
} as const;

export type SiteConfig = typeof siteConfig;
