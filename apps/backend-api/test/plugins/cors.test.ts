import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { createTestEnv } from '@airbolt/test-utils';

import envPlugin from '@airbolt/core/plugins/env.js';
import corsPlugin from '@airbolt/core/plugins/cors.js';

describe('CORS Plugin Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const createApp = async (allowedOrigin = 'http://localhost:3000') => {
    const app = Fastify({
      logger: false,
    });

    // Setup test environment
    createTestEnv({
      ALLOWED_ORIGIN: allowedOrigin,
    });

    await app.register(envPlugin);
    await app.register(corsPlugin);

    // Add test routes
    app.get('/test', async () => {
      return { hello: 'world' };
    });

    app.post('/test', async request => {
      return { received: request.body };
    });

    return app;
  };

  describe('Basic CORS functionality', () => {
    it('should allow requests from allowed origin', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://example.com'
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');

      await app.close();
    });

    it('should reject requests from disallowed origin', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://evil.com',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();

      await app.close();
    });

    it('should allow requests with no origin header', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ hello: 'world' });

      await app.close();
    });
  });

  describe('Multiple origins support', () => {
    it.each([
      ['first origin', 'https://example.com'],
      ['second origin', 'http://localhost:3000'],
      ['third origin', 'https://app.example.com'],
    ])('should handle comma-separated origins: %s', async (_, origin) => {
      const app = await createApp(
        'https://example.com, http://localhost:3000, https://app.example.com'
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { origin },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);

      await app.close();
    });

    it('should handle origins with spaces in configuration', async () => {
      const app = await createApp(
        '  https://example.com  ,  http://localhost:3000  '
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://example.com'
      );

      await app.close();
    });
  });

  describe('Preflight requests', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'OPTIONS',
        url: '/test',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://example.com'
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST'
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Content-Type'
      );
      expect(response.headers['access-control-max-age']).toBe('86400');

      await app.close();
    });

    it('should reject preflight from disallowed origin', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'OPTIONS',
        url: '/test',
        headers: {
          origin: 'https://evil.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();

      await app.close();
    });
  });

  describe('CORS headers configuration', () => {
    it('should set proper allowed methods', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'OPTIONS',
        url: '/test',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'DELETE',
        },
      });

      expect(response.statusCode).toBe(204);
      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).toContain('GET');
      expect(allowedMethods).toContain('POST');
      expect(allowedMethods).toContain('PUT');
      expect(allowedMethods).toContain('DELETE');
      expect(allowedMethods).toContain('PATCH');
      expect(allowedMethods).toContain('OPTIONS');

      await app.close();
    });

    it('should expose custom headers', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const exposedHeaders = response.headers['access-control-expose-headers'];
      expect(exposedHeaders).toContain('X-Total-Count');
      expect(exposedHeaders).toContain('X-Page');
      expect(exposedHeaders).toContain('X-Per-Page');

      await app.close();
    });

    it('should handle Authorization header in preflight', async () => {
      const app = await createApp('https://example.com');

      const response = await app.inject({
        method: 'OPTIONS',
        url: '/test',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Authorization, Content-Type',
        },
      });

      expect(response.statusCode).toBe(204);
      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('Authorization');
      expect(allowedHeaders).toContain('Content-Type');

      await app.close();
    });
  });

  describe('Development auto-enhancement', () => {
    it('should auto-add common dev ports in development mode', async () => {
      // Create app with development environment
      vi.unstubAllEnvs();
      createTestEnv({
        NODE_ENV: 'development',
        ALLOWED_ORIGIN: 'http://localhost:5173',
      });

      const app = Fastify({ logger: false });
      await app.register(envPlugin);
      await app.register(corsPlugin);
      app.get('/test', async () => ({ hello: 'world' }));

      const commonPorts = [5173, 5174, 3000, 4200, 8080];

      for (const port of commonPorts) {
        const response = await app.inject({
          method: 'OPTIONS',
          url: '/test',
          headers: {
            origin: `http://localhost:${port}`,
            'access-control-request-method': 'POST',
          },
        });

        expect(response.statusCode).toBe(204);
      }

      await app.close();
    });
  });

  describe('Edge cases', () => {
    it.each([
      ['allowed port 3000', 'http://localhost:3000', 200],
      ['allowed port 5173', 'http://localhost:5173', 200],
      ['auto-enhanced port 8080', 'http://localhost:8080', 200], // Now auto-enhanced in development
      ['blocked non-common port 9999', 'http://localhost:9999', 500],
    ])(
      'should handle localhost ports: %s',
      async (_, origin, expectedStatus) => {
        // Use development environment for auto-enhancement testing
        vi.unstubAllEnvs();
        createTestEnv({
          NODE_ENV: 'development',
          ALLOWED_ORIGIN: 'http://localhost:3000, http://localhost:5173',
        });

        const app = Fastify({ logger: false });
        await app.register(envPlugin);
        await app.register(corsPlugin);
        app.get('/test', async () => ({ hello: 'world' }));

        const response = await app.inject({
          method: 'GET',
          url: '/test',
          headers: { origin },
        });

        expect(response.statusCode).toBe(expectedStatus);
        await app.close();
      }
    );

    it.each([
      ['HTTPS allowed', 'https://example.com', 200],
      ['HTTP blocked', 'http://example.com', 500],
    ])(
      'should handle protocol correctly: %s',
      async (_, origin, expectedStatus) => {
        const app = await createApp('https://example.com');

        const response = await app.inject({
          method: 'GET',
          url: '/test',
          headers: { origin },
        });

        expect(response.statusCode).toBe(expectedStatus);
        await app.close();
      }
    );
  });
});
