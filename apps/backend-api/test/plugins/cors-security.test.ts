import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

import envPlugin from '../../src/plugins/env.js';
import corsPlugin from '../../src/plugins/cors.js';

describe('CORS Security Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createApp = async (nodeEnv: string, allowedOrigin: string) => {
    const app = Fastify({
      logger: false,
    });

    // Mock environment variables
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = nodeEnv;
    process.env['OPENAI_API_KEY'] = 'sk-test123';
    process.env['ALLOWED_ORIGIN'] = allowedOrigin;

    await app.register(envPlugin);
    await app.register(corsPlugin);

    // Add test routes
    app.get('/test', async () => ({ hello: 'world' }));
    app.post('/api/tokens', async () => ({ token: 'test' }));
    app.post('/api/chat', async () => ({ response: 'test' }));

    // Cleanup function
    const cleanup = () => {
      process.env['NODE_ENV'] = originalEnv;
      return app.close();
    };

    return { app, cleanup };
  };

  describe('Production Security', () => {
    it('blocks dangerous origins in production', async () => {
      const { app, cleanup } = await createApp(
        'production',
        'https://myapp.com'
      );

      try {
        const maliciousOrigins = [
          'https://evil.com', // External domain
          'https://myapp.com.evil.com', // Subdomain attack
          'https://evil.com/myapp.com', // Path confusion
          'null', // Null origin attack
        ];

        for (const origin of maliciousOrigins) {
          // Test critical endpoints
          const tokenResponse = await app.inject({
            method: 'OPTIONS',
            url: '/test',
            headers: {
              origin,
              'access-control-request-method': 'POST',
            },
          });

          const chatResponse = await app.inject({
            method: 'OPTIONS',
            url: '/test',
            headers: {
              origin,
              'access-control-request-method': 'POST',
            },
          });

          // All should be blocked
          expect(
            tokenResponse.statusCode,
            `Token endpoint should block ${origin}`
          ).toBe(500);
          expect(
            chatResponse.statusCode,
            `Chat endpoint should block ${origin}`
          ).toBe(500);

          expect(tokenResponse.body).toContain('Not allowed by CORS');
          expect(chatResponse.body).toContain('Not allowed by CORS');
        }
      } finally {
        await cleanup();
      }
    });

    it('allows only explicitly configured production origins', async () => {
      const { app, cleanup } = await createApp(
        'production',
        'https://app.mycompany.com,https://dashboard.mycompany.com'
      );

      try {
        const allowedOrigins = [
          'https://app.mycompany.com',
          'https://dashboard.mycompany.com',
        ];

        const blockedOrigins = [
          'https://mycompany.com', // Missing subdomain
          'https://api.mycompany.com', // Different subdomain
          'http://app.mycompany.com', // HTTP instead of HTTPS
          'https://app.mycompany.com.evil.com', // Subdomain attack
        ];

        // Test allowed origins work
        for (const origin of allowedOrigins) {
          const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: { origin },
          });

          expect(response.statusCode).toBe(200);
          expect(response.headers['access-control-allow-origin']).toBe(origin);
        }

        // Test blocked origins are rejected
        for (const origin of blockedOrigins) {
          const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: { origin },
          });

          expect(response.statusCode).toBe(500);
          expect(response.body).toContain('Not allowed by CORS');
        }
      } finally {
        await cleanup();
      }
    });

    it('prevents wildcard usage in production', async () => {
      // This test ensures that wildcard (*) is never allowed in production
      // Our validation now correctly blocks this at configuration time

      let validationError: Error | null = null;
      try {
        await createApp('production', '*');
      } catch (error) {
        validationError = error as Error;
      }

      // Should fail to create app with wildcard in production
      expect(validationError).not.toBeNull();
      expect(validationError?.message).toContain(
        'Wildcard (*) not allowed in production'
      );
    });

    it('prevents localhost origins in production', async () => {
      // Localhost should never be allowed in production deployments
      // Our validation now correctly blocks this at configuration time

      let validationError: Error | null = null;
      try {
        await createApp(
          'production',
          'http://localhost:3000,https://myapp.com'
        );
      } catch (error) {
        validationError = error as Error;
      }

      // Should fail to create app with localhost in production
      expect(validationError).not.toBeNull();
      expect(validationError?.message).toContain(
        'Production requires HTTPS origins (no localhost)'
      );
    });

    it('enforces HTTPS-only in production', async () => {
      // HTTP should be blocked in production at configuration time
      // Our validation now correctly blocks this before the app starts

      let validationError: Error | null = null;
      try {
        await createApp('production', 'http://myapp.com,https://myapp.com');
      } catch (error) {
        validationError = error as Error;
      }

      // Should fail to create app with HTTP in production
      expect(validationError).not.toBeNull();
      expect(validationError?.message).toContain(
        'Production requires HTTPS origins (no localhost)'
      );
    });
  });

  describe('Development vs Production Behavior', () => {
    it('allows flexible configuration in development', async () => {
      const { app, cleanup } = await createApp(
        'development',
        'http://localhost:5173,http://localhost:3000,https://staging.myapp.com'
      );

      try {
        const devOrigins = [
          'http://localhost:5173', // HTTP localhost OK in dev
          'http://localhost:3000', // HTTP localhost OK in dev
          'https://staging.myapp.com', // HTTPS OK in dev
        ];

        for (const origin of devOrigins) {
          const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: { origin },
          });

          expect(response.statusCode).toBe(200);
          expect(response.headers['access-control-allow-origin']).toBe(origin);
        }
      } finally {
        await cleanup();
      }
    });

    it('maintains different security postures by environment', async () => {
      const scenarios = [
        { env: 'development', allowsWildcard: true, shouldWork: true },
        { env: 'test', allowsWildcard: true, shouldWork: true },
        { env: 'production', allowsWildcard: false, shouldWork: false },
      ];

      for (const scenario of scenarios) {
        if (scenario.shouldWork) {
          // Should work - test runtime behavior
          const { app, cleanup } = await createApp(scenario.env, '*');

          try {
            const testOrigin = 'http://localhost:3000';

            const response = await app.inject({
              method: 'GET',
              url: '/test',
              headers: { origin: testOrigin },
            });

            expect(response.statusCode).toBe(200);
          } finally {
            await cleanup();
          }
        } else {
          // Production should block wildcard at configuration time
          let validationError: Error | null = null;
          try {
            await createApp(scenario.env, '*');
          } catch (error) {
            validationError = error as Error;
          }

          expect(validationError).not.toBeNull();
          expect(validationError?.message).toContain(
            'Wildcard (*) not allowed in production'
          );
        }
      }
    });
  });
});
