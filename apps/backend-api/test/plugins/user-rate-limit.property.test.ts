import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import userRateLimit from '../../src/plugins/user-rate-limit.js';
import envPlugin from '../../src/plugins/env.js';
import sensiblePlugin from '../../src/plugins/sensible.js';
import { createTestEnv } from '@airbolt/test-utils';

// Generate unique user IDs to avoid state pollution between tests
let userCounter = 0;
const getUniqueUserId = () => `test-user-${++userCounter}-${Date.now()}`;

describe('User Rate Limiter Property Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    createTestEnv({
      TOKEN_LIMIT_MAX: '1000',
      TOKEN_LIMIT_TIME_WINDOW: '3600000', // 1 hour
      REQUEST_LIMIT_MAX: '10',
      REQUEST_LIMIT_TIME_WINDOW: '60000', // 1 minute
    });

    app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.register(envPlugin);
    await app.register(userRateLimit);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Rate limiter behavior', () => {
    it('consumes tokens even when exceeding limit but throws error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 200 }), {
            minLength: 1,
            maxLength: 20,
          }),
          async tokenRequests => {
            const userId = getUniqueUserId();
            let totalConsumed = 0;
            const limit = 1000;

            for (const tokens of tokenRequests) {
              const wouldExceedLimit = totalConsumed + tokens > limit;

              try {
                await app.consumeTokens(userId, tokens);
                totalConsumed += tokens;
              } catch (error) {
                // When request would exceed limit:
                // - It still consumes the tokens
                // - But throws an error
                expect(wouldExceedLimit).toBe(true);
                totalConsumed += tokens; // Tokens are consumed even on error!

                // Verify tokens were consumed despite the error
                const afterUsage = await app.getUserUsage(userId);
                expect(afterUsage.tokens.used).toBe(totalConsumed);
              }
            }

            // Verify final usage matches what we tracked
            const usage = await app.getUserUsage(userId);
            expect(usage.tokens.used).toBe(totalConsumed);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('consumes requests even when exceeding limit but throws error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async requestCount => {
            const userId = getUniqueUserId();
            const limit = 10;
            let actualRequests = 0;

            // Create a fake request/reply for testing
            const fakeRequest: any = {
              user: { userId },
              userRateLimiters: (app as any).userRateLimiters,
            };
            const fakeReply: any = {
              code: vi.fn().mockReturnThis(),
              send: vi.fn(),
            };

            for (let i = 0; i < requestCount; i++) {
              const wouldExceedLimit = actualRequests + 1 > limit;

              try {
                await app.checkUserRateLimit(fakeRequest, fakeReply);
                actualRequests++;
              } catch (error) {
                // Request is counted even when it fails
                actualRequests++;
                expect(wouldExceedLimit).toBe(true);
              }
            }

            const usage = await app.getUserUsage(userId);
            expect(usage.requests.used).toBe(actualRequests);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Token reservation and refund tests removed - simplified implementation
  // Now we just consume tokens after knowing the actual usage

  describe('Edge cases and boundary conditions', () => {
    it('handles zero token consumption', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 500 }),
          async initialConsumption => {
            const userId = getUniqueUserId();

            if (initialConsumption > 0) {
              await app.consumeTokens(userId, initialConsumption);
            }

            const before = await app.getUserUsage(userId);

            // Consuming 0 should always succeed
            await expect(app.consumeTokens(userId, 0)).resolves.not.toThrow();

            const after = await app.getUserUsage(userId);
            expect(after.tokens.used).toBe(before.tokens.used);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('handles consumption around the limit boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 800, max: 999 }),
          fc.integer({ min: 1, max: 300 }),
          async (initialConsumption, attemptAmount) => {
            const userId = getUniqueUserId();

            // Consume initial amount
            await app.consumeTokens(userId, initialConsumption);

            // const usage = await app.getUserUsage(userId);

            // Try to consume more
            const wouldExceedLimit = initialConsumption + attemptAmount > 1000;

            try {
              await app.consumeTokens(userId, attemptAmount);

              // Should succeed if it doesn't exceed limit
              expect(wouldExceedLimit).toBe(false);

              const afterUsage = await app.getUserUsage(userId);
              expect(afterUsage.tokens.used).toBe(
                initialConsumption + attemptAmount
              );
            } catch (error) {
              // Should fail if it would exceed limit
              expect(wouldExceedLimit).toBe(true);

              // BUT tokens are still consumed even on error!
              const afterUsage = await app.getUserUsage(userId);
              expect(afterUsage.tokens.used).toBe(
                initialConsumption + attemptAmount
              );
              expect(afterUsage.tokens.used).toBeGreaterThan(1000);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('allows consuming exactly the remaining tokens before limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 900 }),
          async initialConsumption => {
            const userId = getUniqueUserId();

            // Consume initial amount
            await app.consumeTokens(userId, initialConsumption);

            const usage = await app.getUserUsage(userId);
            const remaining = 1000 - usage.tokens.used;

            // Should be able to consume exactly the remaining
            await expect(
              app.consumeTokens(userId, remaining)
            ).resolves.not.toThrow();

            // Should now be at exactly the limit
            const finalUsage = await app.getUserUsage(userId);
            expect(finalUsage.tokens.used).toBe(1000);
            expect(finalUsage.tokens.remaining).toBe(0);

            // Next request should fail
            await expect(app.consumeTokens(userId, 1)).rejects.toThrow(
              /Token limit exceeded/
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('rate limiter behavior: requests fail when limit exceeded', async () => {
      const userId = getUniqueUserId();

      // Use up most of the limit
      await app.consumeTokens(userId, 900);

      // Try to use more than remaining - should fail
      await expect(app.consumeTokens(userId, 200)).rejects.toThrow(
        /Token limit exceeded/
      );

      // Verify the state after limit exceeded
      const usage = await app.getUserUsage(userId);
      expect(usage.tokens.used).toBeGreaterThan(1000); // rate-limiter-flexible behavior
      expect(usage.tokens.remaining).toBe(0);
    });
  });
});
