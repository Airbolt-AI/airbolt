/* eslint-disable runtime-safety/require-property-tests */
// TODO: Add property tests for cache operations (get/set/delete consistency, TTL behavior, concurrent operations)
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import type { SessionToken } from '../plugins/auth-gateway.js';
import { AuthProvider } from '../plugins/auth-gateway.js';

// Configuration schema for cache options
export const CacheConfigSchema = z.object({
  max: z.number().int().min(1, 'max must be at least 1').default(100),
  ttl: z.number().int().min(1, 'ttl must be at least 1ms').default(60000), // 1 minute default
  updateAgeOnGet: z.boolean().default(false),
  updateAgeOnHas: z.boolean().default(false),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

// Cache error classes following project patterns
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export class CacheKeyError extends CacheError {
  constructor(key: string, operation?: string) {
    super(`Invalid cache key: ${key}`, 'INVALID_CACHE_KEY', operation);
  }
}

/**
 * Generic cache manager that wraps lru-cache with TypeScript generics and error handling
 */

export class CacheManager<
  K extends string | number = string,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  V extends {} = {},
> {
  private cache: LRUCache<K, V>;
  protected readonly logger?: (message: string, meta?: object) => void;

  constructor(
    config: Partial<CacheConfig> = {},
    logger?: (message: string, meta?: object) => void
  ) {
    const validatedConfig = CacheConfigSchema.parse(config);

    this.cache = new LRUCache<K, V>({
      max: validatedConfig.max,
      ttl: validatedConfig.ttl,
      updateAgeOnGet: validatedConfig.updateAgeOnGet,
      updateAgeOnHas: validatedConfig.updateAgeOnHas,
    });

    if (logger) {
      this.logger = logger;
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    try {
      const value = this.cache.get(key);

      if (this.logger && value !== undefined) {
        this.logger('Cache hit', {
          key: typeof key === 'string' ? key : JSON.stringify(key),
        });
      } else if (this.logger) {
        this.logger('Cache miss', {
          key: typeof key === 'string' ? key : JSON.stringify(key),
        });
      }

      return value;
    } catch (error) {
      this.logger?.('Cache get error', {
        key: typeof key === 'string' ? key : JSON.stringify(key),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        `Failed to get cache value for key: ${typeof key === 'string' ? key : JSON.stringify(key)}`,
        'CACHE_GET_ERROR',
        'get'
      );
    }
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V, ttl?: number): void {
    try {
      if (ttl !== undefined) {
        this.cache.set(key, value, { ttl });
      } else {
        this.cache.set(key, value);
      }

      this.logger?.('Cache set', {
        key: typeof key === 'string' ? key : JSON.stringify(key),
        ttl: ttl ?? 'default',
      });
    } catch (error) {
      this.logger?.('Cache set error', {
        key: typeof key === 'string' ? key : JSON.stringify(key),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        `Failed to set cache value for key: ${typeof key === 'string' ? key : JSON.stringify(key)}`,
        'CACHE_SET_ERROR',
        'set'
      );
    }
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    try {
      return this.cache.has(key);
    } catch (error) {
      this.logger?.('Cache has error', {
        key: typeof key === 'string' ? key : JSON.stringify(key),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        `Failed to check cache key: ${typeof key === 'string' ? key : JSON.stringify(key)}`,
        'CACHE_HAS_ERROR',
        'has'
      );
    }
  }

  /**
   * Delete a value from the cache
   */
  delete(key: K): boolean {
    try {
      const existed = this.cache.delete(key);

      this.logger?.('Cache delete', {
        key: typeof key === 'string' ? key : JSON.stringify(key),
        existed,
      });

      return existed;
    } catch (error) {
      this.logger?.('Cache delete error', {
        key: typeof key === 'string' ? key : JSON.stringify(key),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        `Failed to delete cache key: ${typeof key === 'string' ? key : JSON.stringify(key)}`,
        'CACHE_DELETE_ERROR',
        'delete'
      );
    }
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    try {
      const size = this.cache.size;
      this.cache.clear();

      this.logger?.('Cache cleared', { clearedCount: size });
    } catch (error) {
      this.logger?.('Cache clear error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        'Failed to clear cache',
        'CACHE_CLEAR_ERROR',
        'clear'
      );
    }
  }

  /**
   * Get the current number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    max: number;
    ttl: number;
  } {
    return {
      size: this.cache.size,
      max: this.cache.max,
      ttl: this.cache.ttl,
    };
  }

  /**
   * Remove expired entries from the cache
   */
  purgeStale(): void {
    try {
      this.cache.purgeStale();
      this.logger?.('Cache purged stale entries');
    } catch (error) {
      this.logger?.('Cache purge error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        'Failed to purge stale cache entries',
        'CACHE_PURGE_ERROR',
        'purgeStale'
      );
    }
  }
}

// Session token schema for validation (using interface from auth-gateway)
export const SessionTokenSchema = z.object({
  token: z.string().min(1, 'token cannot be empty'),
  userId: z.string().min(1, 'userId cannot be empty'),
  provider: z.enum(['clerk', 'auth0', 'supabase', 'firebase', 'internal']), // Use explicit enum values
  expiresAt: z.date(),
  createdAt: z.date(),
});

/**
 * Session-specific cache that stores auth tokens with provider-specific keys
 */
export class SessionCache extends CacheManager<string, SessionToken> {
  constructor(
    config: Partial<CacheConfig> = {
      max: 1000,
      ttl: 3600000, // 1 hour default
    },
    logger?: (message: string, meta?: object) => void
  ) {
    super(config, logger);
  }

  /**
   * Generate cache key for provider + userId combination
   */
  private generateKey(userId: string, provider: string): string {
    if (!userId || !provider) {
      throw new CacheKeyError(`userId="${userId}", provider="${provider}"`);
    }
    return `${provider}:${userId}`;
  }

  /**
   * Get session by userId and provider
   */
  getSession(userId: string, provider: string): SessionToken | undefined {
    const key = this.generateKey(userId, provider);
    const sessionToken = this.get(key);

    // Check if token is expired (additional layer beyond LRU TTL)
    if (sessionToken && sessionToken.expiresAt <= new Date()) {
      this.delete(key);
      return undefined;
    }

    return sessionToken;
  }

  /**
   * Store a session token
   */
  setSession(session: SessionToken): void {
    try {
      SessionTokenSchema.parse(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new CacheError(
          `Invalid session token data: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'INVALID_SESSION_TOKEN',
          'setSession'
        );
      }
      throw error;
    }

    const key = this.generateKey(session.userId, session.provider);
    // Calculate TTL based on expiration time
    const ttl = session.expiresAt.getTime() - Date.now();
    this.set(key, session, ttl > 0 ? ttl : undefined);
  }

  /**
   * Invalidate all sessions for a specific user across all providers
   */
  invalidateUserSessions(userId: string): void {
    if (!userId) {
      throw new CacheKeyError(`userId="${userId}"`, 'invalidateUserSessions');
    }

    // Since LRUCache doesn't support iteration by key prefix,
    // we need to iterate through all possible providers
    const providers = Object.values(AuthProvider);
    let removedCount = 0;

    for (const provider of providers) {
      const key = this.generateKey(userId, provider);
      if (this.delete(key)) {
        removedCount++;
      }
    }

    this.logger?.('Invalidated user sessions', {
      userId,
      removedCount,
      checkedProviders: providers.length,
    });
  }

  /**
   * Delete session token for a specific user and provider
   */
  deleteSession(userId: string, provider: string): boolean {
    const key = this.generateKey(userId, provider);
    return this.delete(key);
  }

  /**
   * Get all sessions for a specific user across all providers
   */
  getUserSessions(userId: string): SessionToken[] {
    if (!userId) {
      throw new CacheKeyError(`userId="${userId}"`, 'getUserSessions');
    }

    const sessions: SessionToken[] = [];
    const providers = Object.values(AuthProvider);

    try {
      for (const provider of providers) {
        const session = this.getSession(userId, provider);
        if (session) {
          sessions.push(session);
        }
      }

      this.logger?.('Retrieved user sessions', {
        userId,
        sessionCount: sessions.length,
        checkedProviders: providers.length,
      });

      return sessions;
    } catch (error) {
      this.logger?.('getUserSessions error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new CacheError(
        `Failed to get user sessions for userId: ${userId}`,
        'GET_USER_SESSIONS_ERROR',
        'getUserSessions'
      );
    }
  }

  /**
   * Clean expired tokens manually and return count of removed items
   * This is already handled by LRU TTL, but can be called explicitly
   */
  cleanExpired(): number {
    const initialSize = this.size();
    this.purgeStale();
    const finalSize = this.size();
    const removedCount = initialSize - finalSize;

    this.logger?.('Cleaned expired sessions', { removedCount });

    return removedCount;
  }

  /**
   * Get session cache statistics with additional session-specific info
   */
  getSessionStats(): {
    size: number;
    max: number;
    ttl: number;
    totalSessions: number;
  } {
    const baseStats = this.getStats();

    return {
      ...baseStats,
      totalSessions: baseStats.size, // Alias for clarity
    };
  }
}

// Additional exports for external usage
export type CacheOptions = CacheConfig;

// Export default instances for common use cases
export const createSessionCache = (
  config?: Partial<CacheConfig>,
  logger?: (message: string, meta?: object) => void
): SessionCache => {
  return new SessionCache(config, logger);
};

export const createCacheManager = <
  K extends string | number = string,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  V extends {} = {},
>(
  config?: Partial<CacheConfig>,
  logger?: (message: string, meta?: object) => void
): CacheManager<K, V> => {
  return new CacheManager<K, V>(config, logger);
};
