import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Hardened global headers. Applied to every response (the per-route handlers
 * can still add CORS / Cache-Control as needed). CSP is intentionally
 * permissive on connect-src so portals across subdomains can ingest; tighten
 * to a fixed allow-list once portal hostnames are finalized.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Verification builds set NEXT_DIST_DIR=.next-verify so they never clobber a
  // running `next dev` server's `.next` cache (which corrupts it and serves
  // unstyled HTML). Production/Vercel builds leave it unset → default `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // IA cleanup (P1): redundant/renamed routes redirect to their canonical page
  // so old bookmarks and in-app links keep working.
  async redirects() {
    return [
      // "Users" was a strict subset of Staff Intelligence.
      { source: '/dashboard/users', destination: '/dashboard/people', permanent: true },
    ];
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // Ingestion endpoint allows cross-origin POST from any internal portal.
      // Lock `Access-Control-Allow-Origin` to a comma list once known.
      {
        source: '/api/v1/events',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'content-type, x-ncpl-api-key' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
