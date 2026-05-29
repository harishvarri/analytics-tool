/**
 * Verification build — outputs to .next-verify so it never touches a running
 * `next dev` server's `.next` cache. Use this (npm run build:verify) instead of
 * `next build` whenever the dev server might be live. Cross-platform (no shell
 * env-var syntax differences).
 */
import { execSync } from 'node:child_process';

process.env.NEXT_DIST_DIR = '.next-verify';
execSync('next build', { stdio: 'inherit', env: process.env });
