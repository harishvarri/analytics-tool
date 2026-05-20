/**
 * Storage abstraction. Used for sessionId persistence so a page reload keeps
 * the same analytics session within a tab. Falls back to an in-memory map
 * when localStorage is unavailable (SSR, sandboxed contexts).
 */
export interface KVStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

class MemoryStorage implements KVStorage {
  private readonly map = new Map<string, string>();
  get(k: string) { return this.map.get(k) ?? null; }
  set(k: string, v: string) { this.map.set(k, v); }
  remove(k: string) { this.map.delete(k); }
}

class WebStorageAdapter implements KVStorage {
  constructor(private readonly s: Storage) {}
  get(k: string) {
    try { return this.s.getItem(k); } catch { return null; }
  }
  set(k: string, v: string) {
    try { this.s.setItem(k, v); } catch { /* quota/private mode */ }
  }
  remove(k: string) {
    try { this.s.removeItem(k); } catch { /* noop */ }
  }
}

export function detectStorage(): KVStorage {
  if (typeof window === 'undefined') return new MemoryStorage();
  try {
    const probe = '__ncpl_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new WebStorageAdapter(window.localStorage);
  } catch {
    return new MemoryStorage();
  }
}
