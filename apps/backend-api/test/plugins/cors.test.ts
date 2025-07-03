import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

import envPlugin from '../../src/plugins/env.js';
import corsPlugin from '../../src/plugins/cors.js';

describe('CORS Plugin Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createApp = async (allowedOrigin = 'http://localhost:3000') => {
    const app = Fastify({
      logger: false,
    });

    // Mock environment variables
    process.env['OPENAI_API_KEY'] = 'sk-test123';
    process.env['ALLOWED_ORIGIN'] = allowedOrigin;

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
    it('should handle comma-separated origins', async () => {
      const app = await createApp(
        'https://example.com, http://localhost:3000, https://app.example.com'
      );

      // Test first origin
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://example.com',
        },
      });
      expect(response1.statusCode).toBe(200);
      expect(response1.headers['access-control-allow-origin']).toBe(
        'https://example.com'
      );

      // Test second origin
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'http://localhost:3000',
        },
      });
      expect(response2.statusCode).toBe(200);
      expect(response2.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );

      // Test third origin
      const response3 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://app.example.com',
        },
      });
      expect(response3.statusCode).toBe(200);
      expect(response3.headers['access-control-allow-origin']).toBe(
        'https://app.example.com'
      );

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

  describe('Edge cases', () => {
    it('should handle localhost with different ports', async () => {
      const app = await createApp(
        'http://localhost:3000, http://localhost:5173'
      );

      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'http://localhost:3000',
        },
      });
      expect(response1.statusCode).toBe(200);

      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'http://localhost:5173',
        },
      });
      expect(response2.statusCode).toBe(200);

      // Different port should be rejected
      const response3 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'http://localhost:8080',
        },
      });
      expect(response3.statusCode).toBe(500);

      await app.close();
    });

    it('should handle HTTPS vs HTTP correctly', async () => {
      const app = await createApp('https://example.com');

      // HTTPS should be allowed
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'https://example.com',
        },
      });
      expect(response1.statusCode).toBe(200);

      // HTTP should be rejected (different protocol)
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'http://example.com',
        },
      });
      expect(response2.statusCode).toBe(500);

      await app.close();
    });
  });
});
