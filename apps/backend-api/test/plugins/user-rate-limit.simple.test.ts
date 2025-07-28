import { describe, it, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import userRateLimit from '@airbolt/core/plugins/user-rate-limit';
import envPlugin from '../../src/plugins/env.js';
import sensiblePlugin from '@airbolt/core/plugins/sensible';
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

    console.log('\n=== Token Rate Limiter Test ===');

    // Test 1: Can we consume exactly up to the limit?
    console.log('\nTest 1: Consuming exactly 1000 tokens');
    await app.consumeTokens(userId, 1000);
    let usage = await app.getUserUsage(userId);
    console.log(
      `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
    );

    // Try one more
    try {
      await app.consumeTokens(userId, 1);
      console.log('SUCCESS: Consumed 1 more token after reaching limit');
      usage = await app.getUserUsage(userId);
      console.log(
        `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    } catch (error) {
      console.log(
        'FAILED: Could not consume 1 more token after reaching limit'
      );
    }
  });

  it('shows behavior when approaching limit', async () => {
    const userId = 'test-user-2';

    console.log('\n=== Approaching Limit Test ===');

    // Test 2: What happens when we go from below to above limit?
    console.log('\nTest 2: Consuming 999 then 2 tokens');
    await app.consumeTokens(userId, 999);
    let usage = await app.getUserUsage(userId);
    console.log(
      `After 999: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
    );

    try {
      await app.consumeTokens(userId, 2);
      console.log('SUCCESS: Consumed 2 more tokens (now at 1001)');
      usage = await app.getUserUsage(userId);
      console.log(
        `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    } catch (error) {
      console.log('FAILED: Could not consume 2 more tokens');
    }
  });

  it('shows behavior with larger over-limit request', async () => {
    const userId = 'test-user-3';

    console.log('\n=== Large Over-Limit Test ===');

    // Test 3: What about a larger jump over the limit?
    console.log('\nTest 3: Consuming 800 then 300 tokens');
    await app.consumeTokens(userId, 800);
    let usage = await app.getUserUsage(userId);
    console.log(
      `After 800: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
    );

    try {
      await app.consumeTokens(userId, 300);
      console.log('SUCCESS: Consumed 300 more tokens (now at 1100)');
      usage = await app.getUserUsage(userId);
      console.log(
        `Result: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    } catch (error) {
      console.log('FAILED: Could not consume 300 more tokens');
      usage = await app.getUserUsage(userId);
      console.log(
        `Still at: used=${usage.tokens?.used}, remaining=${usage.tokens?.remaining}`
      );
    }
  });

  it('shows exact rate limiter behavior for requests', async () => {
    const userId = 'test-user-2';

    console.log('\n=== Request Rate Limiter Test ===');

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
        console.log(
          `Request ${i}: SUCCESS (total successful: ${successCount})`
        );
      } catch (error) {
        console.log(`Request ${i}: FAILED - rate limit exceeded`);
      }
    }

    const usage = await app.getUserUsage(userId);
    console.log(`Final usage: ${usage.requests.used} requests`);
  });
});
