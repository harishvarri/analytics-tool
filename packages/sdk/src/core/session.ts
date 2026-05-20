import type { KVStorage } from './storage';
import { uuid } from '../utils/uuid';

const SESSION_KEY = 'ncpl_session_id';
const SESSION_AT_KEY = 'ncpl_session_at';
const USER_KEY = 'ncpl_user_id';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 min of inactivity ends a session

export interface SessionManagerOptions {
  storage: KVStorage;
  timeoutMs?: number;
}

/**
 * Per-tab analytics session. Same session across reloads, expires after
 * `timeoutMs` of inactivity, rotates when explicitly cleared (e.g. on logout).
 */
export class SessionManager {
  private readonly storage: KVStorage;
  private readonly timeoutMs: number;

  constructor(opts: SessionManagerOptions) {
    this.storage = opts.storage;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Returns a stable sessionId, rotating it if the previous one expired. */
  getSessionId(): string {
    const now = Date.now();
    const existing = this.storage.get(SESSION_KEY);
    const last = Number(this.storage.get(SESSION_AT_KEY) ?? 0);
    if (existing && now - last < this.timeoutMs) {
      this.storage.set(SESSION_AT_KEY, String(now));
      return existing;
    }
    const fresh = uuid();
    this.storage.set(SESSION_KEY, fresh);
    this.storage.set(SESSION_AT_KEY, String(now));
    return fresh;
  }

  resetSession(): void {
    this.storage.remove(SESSION_KEY);
    this.storage.remove(SESSION_AT_KEY);
  }

  getUserId(): string | null {
    return this.storage.get(USER_KEY);
  }

  setUserId(userId: string | null): void {
    if (userId) this.storage.set(USER_KEY, userId);
    else this.storage.remove(USER_KEY);
  }
}
