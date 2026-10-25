export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

export class MemoryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 15 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const now = Date.now();
    this.store.set(key, {
      value,
      cachedAt: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Returns value if present and not expired.
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      // Expired for normal retrieval
      return undefined;
    }

    return entry.value;
  }

  /**
   * Returns value even if expired (for stale fallback on upstream errors).
   */
  getAny(key: string): { value: T; isExpired: boolean } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    return {
      value: entry.value,
      isExpired: Date.now() > entry.expiresAt,
    };
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
