import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestEnv } from '@airbolt/test-utils';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

/**
 * Security headers plugin tests
 * Verifies that appropriate security headers are applied to different routes
 */

describe('security headers plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.clearAllMocks();
    createTestEnv(); // Set up test environment
    app = await buildApp({ skipEnvValidation: true, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies standard security headers to regular routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(302);

    // Check standard security headers are applied even to redirect responses
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(response.headers['permissions-policy']).toContain('geolocation=()');
    expect(response.headers['x-download-options']).toBe('noopen');
    expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
  });

  it('applies stricter headers to auth routes', async () => {
    // Test auth exchange endpoint (should have stricter headers)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/exchange',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    // Check standard headers are still present
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');

    // Check auth-specific stricter headers
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none';"
    );
    expect(response.headers['cache-control']).toBe(
      'no-store, no-cache, must-revalidate, private'
    );
    expect(response.headers['pragma']).toBe('no-cache');
    expect(response.headers['expires']).toBe('0');
  });

  it('production headers are not set in development', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(302);

    // HSTS should not be present in development
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('headers are set on error responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    expect(response.statusCode).toBe(404);

    // Security headers should still be present on error responses
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('headers are applied consistently across different HTTP methods', async () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];

    for (const method of methods) {
      const response = await app.inject({
        method: method as any,
        url: '/',
      });

      // GET returns 302 (redirect), other methods will return 404 (method not allowed)
      expect([302, 404].includes(response.statusCode)).toBe(true);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    }
  });

  it('auth route detection works correctly', async () => {
    const authRoutes = ['/api/auth/exchange'];

    const nonAuthRoutes = ['/', '/docs'];

    for (const route of authRoutes) {
      const response = await app.inject({
        method: 'POST',
        url: route,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Auth routes should have stricter CSP
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'none'"
      );
    }

    for (const route of nonAuthRoutes) {
      const response = await app.inject({
        method: 'GET',
        url: route,
      });

      // Non-auth routes should not have the strict CSP
      const csp = response.headers['content-security-policy'];
      if (csp) {
        expect(csp).not.toContain("default-src 'none'");
      }
    }
  });

  it('permissions policy includes security-relevant directives', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(302);

    const permissionsPolicy = response.headers['permissions-policy'];
    expect(permissionsPolicy).toBeDefined();

    // Check that sensitive permissions are disabled
    const expectedDirectives = [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ];

    for (const directive of expectedDirectives) {
      expect(permissionsPolicy).toContain(directive);
    }
  });
});
