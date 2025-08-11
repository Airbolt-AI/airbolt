import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '../../../helper.js';
import type { FastifyInstance } from 'fastify';

describe('POST /api/auth/exchange - Rate Limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Build app with very low rate limits for testing
    app = await build({
      // Default NODE_ENV will be 'development' (doesn't need to be set)
      VALIDATE_JWT: 'false', // Disable JWT validation for simpler testing
      AUTH_RATE_LIMIT_MAX: '2', // Very low limit for testing
      AUTH_RATE_LIMIT_WINDOW_MS: '60000', // 1 minute minimum
      OPENAI_API_KEY: 'sk-test-key-for-rate-limit-testing', // Needed to avoid errors
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should allow requests within rate limit', async () => {
    // First request should succeed
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        'x-forwarded-for': '192.168.1.100',
      },
    });

    if (response1.statusCode !== 200) {
      console.log('Response status:', response1.statusCode);
      console.log('Response body:', response1.body);
    }
    expect(response1.statusCode).toBe(200);
    expect(response1.headers['x-ratelimit-limit']).toBe('2');
    expect(response1.headers['x-ratelimit-remaining']).toBe('1');
    expect(response1.headers['x-ratelimit-reset']).toBeDefined();

    // Second request should also succeed
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        'x-forwarded-for': '192.168.1.100',
      },
    });

    expect(response2.statusCode).toBe(200);
    expect(response2.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should block requests exceeding rate limit', async () => {
    const clientIP = '192.168.1.200';

    // Make requests up to the limit
    await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': clientIP },
    });
    await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': clientIP },
    });

    // Third request should be rate limited
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': clientIP },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['x-ratelimit-limit']).toBe('2');
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers['retry-after']).toBeDefined();

    const body = response.json();
    expect(body.error).toBe('TooManyRequests');
    expect(body.message).toBe('Rate limit exceeded for token exchange');
    expect(body.retryAfter).toBeTypeOf('number');
  });

  it('should track different IPs separately', async () => {
    // Use up limit for first IP
    await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    // First IP should be rate limited
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });
    expect(response1.statusCode).toBe(429);

    // Different IP should still be allowed
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': '192.168.1.2' },
    });
    expect(response2.statusCode).toBe(200);
  });

  it('should provide correct reset time in headers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: { 'x-forwarded-for': '192.168.1.300' },
    });

    expect(response.statusCode).toBe(200);

    // Reset time should be in the future
    const resetHeader = response.headers['x-ratelimit-reset'] as string;
    const resetTime = new Date(resetHeader).getTime();
    expect(resetTime).toBeGreaterThan(Date.now());

    // Should be within 1 minute from now (our window size)
    expect(resetTime).toBeLessThanOrEqual(Date.now() + 60000);
  });

  it('should use Bearer token user ID for more precise rate limiting', async () => {
    // Create two different tokens with different user IDs
    const user1Payload = { sub: 'user-1' };
    const user2Payload = { sub: 'user-2' };

    const user1Token = `header.${Buffer.from(JSON.stringify(user1Payload)).toString('base64url')}.signature`;
    const user2Token = `header.${Buffer.from(JSON.stringify(user2Payload)).toString('base64url')}.signature`;

    // Same IP, different users - should be tracked separately
    await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        'x-forwarded-for': '192.168.1.400',
        authorization: `Bearer ${user1Token}`,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        'x-forwarded-for': '192.168.1.400',
        authorization: `Bearer ${user1Token}`,
      },
    });

    // User 1 should be rate limited
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        'x-forwarded-for': '192.168.1.400',
        authorization: `Bearer ${user1Token}`,
      },
    });
    expect(response1.statusCode).toBe(429);

    // User 2 should still be allowed (different user ID)
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        'x-forwarded-for': '192.168.1.400',
        authorization: `Bearer ${user2Token}`,
      },
    });
    expect(response2.statusCode).toBe(200);
  });

  it('should include proper rate limit headers in all responses', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
    });

    // Even successful responses should include rate limit headers
    expect(response.headers['x-ratelimit-limit']).toBe('2');
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();

    // Verify reset header is a valid ISO date
    const resetHeader = response.headers['x-ratelimit-reset'] as string;
    expect(new Date(resetHeader).getTime()).toBeGreaterThan(Date.now());
  });
});
