import type { JWKSFetcher } from './jwt-verifier.js';

/**
 * JWKS cache entry
 */
interface JWKSCacheEntry {
  /** The cached JWKS data */
  jwks: { keys: unknown[] };
  /** Timestamp when this entry was cached */
  cachedAt: number;
  /** Promise for ongoing fetch (single-flight pattern) */
  fetchPromise?: Promise<{ keys: unknown[] }>;
}

/**
 * Cache entry for unknown kid cooldown
 */
interface UnknownKidEntry {
  /** Timestamp when this kid was first seen as unknown */
  firstSeen: number;
}

/**
 * JWKS cache configuration
 */
export interface JWKSCacheConfig {
  /** Cache TTL in milliseconds (default: 24 hours) */
  ttlMs?: number;
  /** Cooldown period for unknown kid in milliseconds (default: 10 minutes) */
  unknownKidCooldownMs?: number;
}

/**
 * JWKS cache with single-flight pattern and unknown kid cooldown
 */
export class JWKSCache {
  private readonly cache = new Map<string, JWKSCacheEntry>();
  private readonly unknownKidCache = new Map<string, UnknownKidEntry>();
  private readonly ttlMs: number;
  private readonly unknownKidCooldownMs: number;

  constructor(config: JWKSCacheConfig = {}) {
    this.ttlMs = config.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.unknownKidCooldownMs = config.unknownKidCooldownMs ?? 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Gets JWKS with caching and single-flight pattern
   *
   * @param jwksUrl - The JWKS endpoint URL
   * @param fetcher - The JWKS fetcher function
   * @param kid - Optional key ID for unknown kid tracking
   * @returns Promise resolving to JWKS data
   */
  async getJWKS(
    jwksUrl: string,
    fetcher: JWKSFetcher,
    kid?: string
  ): Promise<{ keys: unknown[] }> {
    const now = Date.now();

    // Check if we have a cached entry
    const cacheEntry = this.cache.get(jwksUrl);

    // If we have a valid cached entry, return it
    if (cacheEntry && !this.isExpired(cacheEntry, now)) {
      return cacheEntry.jwks;
    }

    // If we have a kid and it's in cooldown, don't fetch
    if (kid && this.isKidInCooldown(kid, now)) {
      // If we have stale cache data, return it during cooldown
      if (cacheEntry) {
        return cacheEntry.jwks;
      }
      throw new Error(
        `Key ID ${kid} is in cooldown period, no cached data available`
      );
    }

    // Check if there's already a fetch in progress (single-flight pattern)
    if (cacheEntry?.fetchPromise !== undefined) {
      try {
        return await cacheEntry.fetchPromise;
      } catch {
        // If the ongoing fetch failed, continue to create a new one
        // Remove the failed promise from cache
        if (cacheEntry.fetchPromise !== undefined) {
          delete cacheEntry.fetchPromise;
        }
      }
    }

    // Create new fetch promise
    const fetchPromise = this.fetchAndCache(jwksUrl, fetcher, now);

    // Store the promise in cache for single-flight pattern
    if (cacheEntry) {
      cacheEntry.fetchPromise = fetchPromise;
    } else {
      this.cache.set(jwksUrl, {
        jwks: { keys: [] }, // Temporary empty value
        cachedAt: 0, // Will be updated when fetch completes
        fetchPromise,
      });
    }

    try {
      const result = await fetchPromise;
      return result;
    } catch (error) {
      // Track unknown kid if this fetch was triggered by a missing kid
      if (kid) {
        this.trackUnknownKid(kid, now);
      }

      // Clean up failed promise
      const entry = this.cache.get(jwksUrl);
      if (entry?.fetchPromise === fetchPromise) {
        delete entry.fetchPromise;
      }

      throw error;
    }
  }

  /**
   * Fetches JWKS and updates cache
   */
  private async fetchAndCache(
    jwksUrl: string,
    fetcher: JWKSFetcher,
    timestamp: number
  ): Promise<{ keys: unknown[] }> {
    try {
      const jwks = await fetcher(jwksUrl);

      // Update cache with fresh data
      const entry = this.cache.get(jwksUrl);
      if (entry) {
        entry.jwks = jwks;
        entry.cachedAt = timestamp;
        delete entry.fetchPromise;
      } else {
        this.cache.set(jwksUrl, {
          jwks,
          cachedAt: timestamp,
        });
      }

      return jwks;
    } catch (error) {
      // Remove the entry if fetch completely failed and we have no cached data
      const entry = this.cache.get(jwksUrl);
      if (entry && entry.cachedAt === 0) {
        this.cache.delete(jwksUrl);
      }
      throw error;
    }
  }

  /**
   * Checks if a cache entry is expired
   */
  private isExpired(entry: JWKSCacheEntry, now: number): boolean {
    return now - entry.cachedAt > this.ttlMs;
  }

  /**
   * Tracks an unknown kid for cooldown purposes
   */
  private trackUnknownKid(kid: string, timestamp: number): void {
    if (!this.unknownKidCache.has(kid)) {
      this.unknownKidCache.set(kid, { firstSeen: timestamp });
    }
  }

  /**
   * Checks if a kid is in cooldown period
   */
  private isKidInCooldown(kid: string, now: number): boolean {
    const entry = this.unknownKidCache.get(kid);
    if (!entry) {
      return false;
    }

    const cooldownExpired = now - entry.firstSeen > this.unknownKidCooldownMs;

    // Clean up expired cooldown entries
    if (cooldownExpired) {
      this.unknownKidCache.delete(kid);
      return false;
    }

    return true;
  }

  /**
   * Clears expired cache entries and cooldowns
   * Should be called periodically to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();

    // Clean up expired JWKS cache entries
    for (const [url, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now) && !entry.fetchPromise) {
        this.cache.delete(url);
      }
    }

    // Clean up expired unknown kid entries
    for (const [kid, entry] of this.unknownKidCache.entries()) {
      if (now - entry.firstSeen > this.unknownKidCooldownMs) {
        this.unknownKidCache.delete(kid);
      }
    }
  }

  /**
   * Clears all cache data
   */
  clear(): void {
    this.cache.clear();
    this.unknownKidCache.clear();
  }

  /**
   * Gets cache statistics for monitoring
   */
  getStats(): {
    cacheSize: number;
    cooldownSize: number;
    entries: Array<{
      url: string;
      age: number;
      hasOngoingFetch: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([url, entry]) => ({
      url,
      age: now - entry.cachedAt,
      hasOngoingFetch: !!entry.fetchPromise,
    }));

    return {
      cacheSize: this.cache.size,
      cooldownSize: this.unknownKidCache.size,
      entries,
    };
  }
}

/**
 * Global JWKS cache instance
 */
export const globalJWKSCache = new JWKSCache();

/**
 * Creates a cached JWKS fetcher
 *
 * @param cache - Optional cache instance (defaults to global cache)
 * @returns A JWKS fetcher that uses caching
 */
export function createCachedJWKSFetcher(
  cache: JWKSCache = globalJWKSCache
): JWKSFetcher {
  return async (url: string) => {
    // Default fetcher implementation
    const defaultFetcher: JWKSFetcher = async (jwksUrl: string) => {
      const response = await fetch(jwksUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Airbolt/1.0 JWT-Verifier',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          `JWKS fetch failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { keys: unknown[] };
      return { keys: data.keys };
    };

    return cache.getJWKS(url, defaultFetcher);
  };
}
