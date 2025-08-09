import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  CacheManager,
  SessionCache,
  createCacheManager,
  createSessionCache,
  CacheKeyError,
} from '../../src/utils/cache.js';
import { AuthProvider } from '../../src/plugins/auth-gateway.js';

describe('Cache Property Tests', () => {
  describe('CacheManager', () => {
    let cache: CacheManager<string, string>;

    beforeEach(() => {
      cache = new CacheManager({ max: 100, ttl: 60000 });
    });

    it('property: stored values can be retrieved immediately', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 1000 }),
          (key, value) => {
            cache.set(key, value);
            const retrieved = cache.get(key);
            expect(retrieved).toBe(value);
            expect(cache.has(key)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('property: cache respects maximum size limit', () => {
      const maxSize = 10;
      const smallCache = new CacheManager({ max: maxSize, ttl: 60000 });

      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            { minLength: maxSize + 1, maxLength: maxSize * 2 }
          ),
          keyValuePairs => {
            // Set all key-value pairs
            for (const [key, value] of keyValuePairs) {
              smallCache.set(key, value);
            }

            const stats = smallCache.getStats();
            expect(stats.size).toBeLessThanOrEqual(maxSize);

            // The last items should still be accessible (LRU eviction)
            const lastFew = keyValuePairs.slice(-maxSize);
            for (const [key] of lastFew) {
              expect(smallCache.has(key)).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('property: delete removes keys and returns correct boolean', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
            minLength: 5,
            maxLength: 20,
          }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (keys, value) => {
            const uniqueKeys = [...new Set(keys)];

            // Set all keys with same value
            for (const key of uniqueKeys) {
              cache.set(key, value);
            }

            // Delete half the keys and verify behavior
            const keysToDelete = uniqueKeys.slice(
              0,
              Math.floor(uniqueKeys.length / 2)
            );
            const remainingKeys = uniqueKeys.slice(
              Math.floor(uniqueKeys.length / 2)
            );

            for (const key of keysToDelete) {
              // First deletion should return true
              expect(cache.delete(key)).toBe(true);
              // Second deletion should return false
              expect(cache.delete(key)).toBe(false);
              // Key should not exist
              expect(cache.has(key)).toBe(false);
              expect(cache.get(key)).toBeUndefined();
            }

            // Remaining keys should still exist
            for (const key of remainingKeys) {
              expect(cache.has(key)).toBe(true);
              expect(cache.get(key)).toBe(value);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('property: clear removes all entries', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            { minLength: 1, maxLength: 50 }
          ),
          keyValuePairs => {
            // Add entries
            for (const [key, value] of keyValuePairs) {
              cache.set(key, value);
            }

            expect(cache.getStats().size).toBeGreaterThan(0);

            // Clear cache
            cache.clear();

            // Verify all entries are gone
            expect(cache.getStats().size).toBe(0);

            for (const [key] of keyValuePairs) {
              expect(cache.has(key)).toBe(false);
              expect(cache.get(key)).toBeUndefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('SessionCache', () => {
    let sessionCache: SessionCache;

    beforeEach(() => {
      sessionCache = new SessionCache({ max: 100, ttl: 3600000 }); // 1 hour
    });

    it('property: session tokens are correctly stored and retrieved', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // userId
          fc.constantFrom(...Object.values(AuthProvider)), // provider
          fc.string({ minLength: 10, maxLength: 100 }), // token
          fc.integer({ min: Date.now() + 60000, max: Date.now() + 3600000 }), // future expiresAt
          (userId, provider, token, expiresAt) => {
            const sessionToken = {
              token,
              userId,
              provider,
              createdAt: new Date(),
              expiresAt: new Date(expiresAt),
            };
            sessionCache.setSession(sessionToken);

            const retrieved = sessionCache.getSession(userId, provider);
            expect(retrieved).toBeDefined();
            expect(retrieved!.token).toBe(token);
            expect(retrieved!.userId).toBe(userId);
            expect(retrieved!.provider).toBe(provider);
            expect(retrieved!.expiresAt.getTime()).toBe(expiresAt);
            expect(retrieved!.createdAt.getTime()).toBeLessThanOrEqual(
              Date.now()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('property: expired tokens are automatically removed on retrieval', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(...Object.values(AuthProvider)),
          fc.string({ minLength: 10, maxLength: 100 }),
          (userId, provider, token) => {
            // Set token that's already expired
            const expiredTime = new Date(Date.now() - 1000);
            const sessionToken = {
              token,
              userId,
              provider,
              createdAt: new Date(),
              expiresAt: expiredTime,
            };
            sessionCache.setSession(sessionToken);

            // Should return undefined for expired token
            const retrieved = sessionCache.getSession(userId, provider);
            expect(retrieved).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('property: different providers for same user are stored separately', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // userId
          fc.array(
            fc.tuple(
              fc.constantFrom(...Object.values(AuthProvider)), // provider
              fc.string({ minLength: 10, maxLength: 100 }) // token
            ),
            { minLength: 2, maxLength: 5 }
          ),
          (userId, providerTokenPairs) => {
            const uniquePairs = providerTokenPairs.filter(
              (pair, index, arr) =>
                arr.findIndex(p => p[0] === pair[0]) === index
            );

            if (uniquePairs.length < 2) return; // Skip if not enough unique providers

            const futureExpiry = Date.now() + 3600000;

            // Store tokens for different providers
            for (const [provider, token] of uniquePairs) {
              const sessionToken = {
                token,
                userId,
                provider,
                createdAt: new Date(),
                expiresAt: new Date(futureExpiry),
              };
              sessionCache.setSession(sessionToken);
            }

            // Verify each provider's token is stored separately
            for (const [provider, token] of uniquePairs) {
              const retrieved = sessionCache.getSession(userId, provider);
              expect(retrieved).toBeDefined();
              expect(retrieved!.token).toBe(token);
              expect(retrieved!.provider).toBe(provider);
              expect(retrieved!.userId).toBe(userId);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('property: deleting session tokens works correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(...Object.values(AuthProvider)),
          fc.string({ minLength: 10, maxLength: 100 }),
          (userId, provider, token) => {
            const futureExpiry = new Date(Date.now() + 3600000);

            // Store token
            const sessionToken = {
              token,
              userId,
              provider,
              createdAt: new Date(),
              expiresAt: futureExpiry,
            };
            sessionCache.setSession(sessionToken);
            expect(sessionCache.getSession(userId, provider)).toBeDefined();

            // Delete should return true
            expect(sessionCache.deleteSession(userId, provider)).toBe(true);

            // Token should be gone
            expect(sessionCache.getSession(userId, provider)).toBeUndefined();

            // Second delete should return false
            expect(sessionCache.deleteSession(userId, provider)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Handling', () => {
    it('property: CacheKeyError is thrown for invalid keys in SessionCache', () => {
      const sessionCache = new SessionCache();

      fc.assert(
        fc.property(
          fc.oneof(fc.constant(''), fc.constant(' '.repeat(10))),
          fc.constantFrom(...Object.values(AuthProvider)),
          (invalidUserId, provider) => {
            expect(() => {
              sessionCache.getSession(invalidUserId.trim(), provider);
            }).toThrow(CacheKeyError);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('property: createCacheManager and createSessionCache create working instances', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (key, value) => {
            // Test createCacheManager function
            const cache = createCacheManager<string, string>();
            // Test createSessionCache function
            const sessionCache = createSessionCache();

            // Basic cache should work
            cache.set(key, value);
            expect(cache.get(key)).toBe(value);

            // Session cache should work
            const futureExpiry = new Date(Date.now() + 3600000);
            const sessionToken = {
              token: 'token123',
              userId: 'user1',
              provider: AuthProvider.CLERK,
              createdAt: new Date(),
              expiresAt: futureExpiry,
            };
            sessionCache.setSession(sessionToken);
            const session = sessionCache.getSession(
              'user1',
              AuthProvider.CLERK
            );
            expect(session).toBeDefined();
            expect(session!.token).toBe('token123');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('property: TTL behavior works correctly', async () => {
      const shortTtlCache = new CacheManager({ max: 100, ttl: 10 }); // 10ms TTL

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          async (key, value) => {
            shortTtlCache.set(key, value);

            // Should be available immediately
            expect(shortTtlCache.get(key)).toBe(value);

            // Wait for TTL expiration
            await new Promise(resolve => setTimeout(resolve, 15));

            // Should be expired now (LRU will purge on next operation)
            shortTtlCache.purgeStale();
            expect(shortTtlCache.get(key)).toBeUndefined();
          }
        ),
        { numRuns: 10, timeout: 5000 }
      );
    });
  });
});
