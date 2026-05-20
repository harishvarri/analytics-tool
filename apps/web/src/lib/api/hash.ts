import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '../env';

/**
 * Salted SHA-256 hash. Used to store client IPs without retaining the
 * raw value, while still allowing correlation across events.
 * Rotate IP_HASH_SALT to invalidate historical lookups.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${env.IP_HASH_SALT}:${ip}`).digest('hex');
}
