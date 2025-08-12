import { describe, it, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import userRateLimit from '../../src/plugins/user-rate-limit.js';
import envPlugin from '../../src/plugins/env.js';
import sensiblePlugin from '../../src/plugins/sensible.js';
import { createTestEnv } from '@airbolt/test-utils';

describe('Rate Limiter Behavior Test', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    createTestEnv({
      TOKEN_LIMIT_MAX: '1000', // Test with actual limit
      TOKEN_LIMIT_TIME_WINDOW: '3600000',
      REQUEST_LIMIT_MAX: '10', // Test with actual limit
      REQUEST_LIMIT_TIME_WINDOW: '60000',
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

  it('shows exact rate limiter behavior for tokens', async () => {
    const userId = 'test-user-1';

    // Testing token rate limiter behavior

    // Test 1: Can we consume exactly up to the limit?
    // Test 1: Consuming exactly 1000 tokens
    await app.consumeTokens(userId, 1000);
    let usage = await app.getUserUsage(userId);
    // Check usage after consuming tokens

    // Try one more
    try {
      await app.consumeTokens(userId, 1);
      // Successfully consumed 1 more token after reaching limit
      usage = await app.getUserUsage(userId);
      console.log(
        `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    } catch (error) {
      // Could not consume 1 more token after reaching limit
    }
  });

  it('shows behavior when approaching limit', async () => {
    const userId = 'test-user-2';

    // Testing behavior when approaching limit

    // Test 2: What happens when we go from below to above limit?
    // Test 2: Consuming 999 then 2 tokens
    await app.consumeTokens(userId, 999);
    let usage = await app.getUserUsage(userId);
    // Check usage after 999 tokens

    try {
      await app.consumeTokens(userId, 2);
      // Successfully consumed 2 more tokens (now at 1001)
      usage = await app.getUserUsage(userId);
      console.log(
        `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    } catch (error) {
      // Could not consume 2 more tokens
    }
  });

  it('shows behavior with larger over-limit request', async () => {
    const userId = 'test-user-3';

    // Testing large over-limit request

    // Test 3: What about a larger jump over the limit?
    // Test 3: Consuming 800 then 300 tokens
    await app.consumeTokens(userId, 800);
    let usage = await app.getUserUsage(userId);
    // Check usage after 800 tokens

    try {
      await app.consumeTokens(userId, 300);
      // Successfully consumed 300 more tokens (now at 1100)
      usage = await app.getUserUsage(userId);
      console.log(
        `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    } catch (error) {
      // Could not consume 300 more tokens
      usage = await app.getUserUsage(userId);
      // Check remaining usage
    }
  });

  it('shows exact rate limiter behavior for requests', async () => {
    const userId = 'test-user-2';

    // Testing request rate limiter behavior

    const fakeRequest: any = {
      user: { userId },
      userRateLimiters: (app as any).userRateLimiters,
    };
    const fakeReply: any = {
      code: () => fakeReply,
      send: () => {},
    };

    let successCount = 0;

    // Try to make 15 requests (limit is 10)
    for (let i = 1; i <= 15; i++) {
      try {
        await app.checkUserRateLimit(fakeRequest, fakeReply);
        successCount++;
        // Request succeeded
      } catch (error) {
        // Request failed - rate limit exceeded
      }
    }

    const usage = await app.getUserUsage(userId);
    // Final usage check
  });
});
