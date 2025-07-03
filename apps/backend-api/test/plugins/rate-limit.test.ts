import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { setTimeout } from 'node:timers/promises';

import envPlugin from '../../src/plugins/env.js';
import rateLimitPlugin from '../../src/plugins/rate-limit.js';

describe('Rate Limit Plugin Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createApp = async (
    rateLimitMax = 3,
    rateLimitTimeWindow = 1000,
    trustProxy = false
  ) => {
    const app = Fastify({
      logger: false,
    });

    // Mock environment variables
    process.env['OPENAI_API_KEY'] = 'sk-test123';
    process.env['RATE_LIMIT_MAX'] = String(rateLimitMax);
    process.env['RATE_LIMIT_TIME_WINDOW'] = String(rateLimitTimeWindow);
    process.env['TRUST_PROXY'] = String(trustProxy);

    await app.register(envPlugin);
    await app.register(rateLimitPlugin);

    // Add a test route
    app.get('/test', async () => {
      return { hello: 'world' };
    });

    return app;
  };

  describe('Basic rate limiting', () => {
    it('should allow requests within the limit', async () => {
      const app = await createApp(3, 1000);

      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/test',
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ hello: 'world' });
      }

      await app.close();
    });

    it('should include rate limit headers in responses', async () => {
      const app = await createApp(5, 60000);

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      await app.close();
    });

    it('should block requests exceeding the limit', async () => {
      const app = await createApp(2, 1000);

      // Make 2 requests (within limit)
      for (let i = 0; i < 2; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/test',
        });
        expect(response.statusCode).toBe(200);
      }

      // Third request should be rate limited
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response.statusCode).toBe(429);
      const body = response.json();
      expect(body.error).toBe('RateLimitExceeded');
      expect(body.message).toContain(
        'You have exceeded the allowed number of requests'
      );

      await app.close();
    });

    it('should reset limit after time window', async () => {
      const app = await createApp(1, 1000); // 1s window

      // First request should succeed
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response1.statusCode).toBe(200);

      // Second request should be rate limited
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response2.statusCode).toBe(429);

      // Wait for time window to pass
      await setTimeout(1100);

      // Third request should succeed after window reset
      const response3 = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response3.statusCode).toBe(200);

      await app.close();
    });
  });

  describe('IP-based rate limiting', () => {
    it('should track limits per IP address when TRUST_PROXY is enabled', async () => {
      const app = await createApp(1, 1000, true); // Enable TRUST_PROXY

      // Request from first IP
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });
      expect(response1.statusCode).toBe(200);

      // Second request from same IP should be limited
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });
      expect(response2.statusCode).toBe(429);

      // Request from different IP should succeed
      const response3 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.2',
        },
      });
      expect(response3.statusCode).toBe(200);

      await app.close();
    });

    it('should ignore X-Forwarded-For when TRUST_PROXY is disabled', async () => {
      const app = await createApp(2, 60000, false); // Disable TRUST_PROXY

      // Mock different remoteAddress values for each request
      const originalInject = app.inject.bind(app);
      let requestCount = 0;

      // @ts-expect-error - Mocking inject for testing
      app.inject = function (opts: any) {
        requestCount++;
        // Override remoteAddress for each request
        const modifiedOpts = {
          ...opts,
          remoteAddress: `127.0.0.${requestCount}`,
        };
        return originalInject(modifiedOpts);
      };

      // When TRUST_PROXY is false, X-Forwarded-For headers are ignored
      // Requests from different IPs should be tracked separately

      // First request from IP 127.0.0.1 should succeed
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });
      expect(response1.statusCode).toBe(200);

      // Second request from IP 127.0.0.2 should also succeed (different IP)
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.2',
        },
      });
      expect(response2.statusCode).toBe(200);

      await app.close();
    });

    it('should handle multiple IPs in x-forwarded-for header', async () => {
      const app = await createApp(1, 1000, true); // Enable TRUST_PROXY

      // Request with multiple IPs (common with proxies)
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        },
      });
      expect(response1.statusCode).toBe(200);

      // Should use first IP for rate limiting
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.2, 172.16.0.2',
        },
      });
      expect(response2.statusCode).toBe(429);

      await app.close();
    });
  });

  describe('Error response format', () => {
    it('should return proper error structure', async () => {
      const app = await createApp(1, 60000); // 1 minute window

      // Use up the limit
      await app.inject({
        method: 'GET',
        url: '/test',
      });

      // This should be rate limited
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(429);
      const body = response.json();
      expect(body).toMatchObject({
        error: 'RateLimitExceeded',
        statusCode: 429,
      });
      expect(body.message).toMatch(
        /You have exceeded the allowed number of requests/
      );
      expect(body.message).toMatch(/Try again in/);

      await app.close();
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle string environment variables', async () => {
      const app = await createApp(5, 2000);

      // Should work with string values that can be coerced
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/test',
        });
        expect(response.statusCode).toBe(200);
      }

      // 6th request should be limited
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response.statusCode).toBe(429);

      await app.close();
    });
  });
});
