import { describe, it, expect, afterEach } from 'vitest';
import { build, createMockJWT } from '../../../helper.js';
import type { FastifyInstance } from 'fastify';

describe('Token Exchange Route', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/auth/exchange', () => {
    it('should require Authorization header', async () => {
      app = await build({ AUTH_REQUIRED: '1' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Authorization header is required');
    });

    it('should require Bearer format in Authorization header', async () => {
      app = await build({ AUTH_REQUIRED: '1' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: 'Basic invalid-format',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe(
        'Authorization header must be in format "Bearer <token>"'
      );
    });

    it('should reject empty Bearer token', async () => {
      app = await build({ AUTH_REQUIRED: '1' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer   ', // Empty token with spaces
        },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Provider token cannot be empty');
    });

    it('should return mock session token for valid provider token', async () => {
      app = await build();
      await app.ready();

      const mockProviderToken = createMockJWT({
        provider: 'clerk',
        userId: 'user_12345',
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${mockProviderToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Verify response structure
      expect(body).toHaveProperty('sessionToken');
      expect(body).toHaveProperty('expiresAt');
      expect(body).toHaveProperty('provider');

      // Verify types
      expect(typeof body.sessionToken).toBe('string');
      expect(typeof body.expiresAt).toBe('string');
      expect(typeof body.provider).toBe('string');

      // Verify token is not empty
      expect(body.sessionToken.length).toBeGreaterThan(0);

      // Verify expiresAt is valid ISO timestamp
      expect(() => new Date(body.expiresAt)).not.toThrow();
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      // Verify provider is set (mock returns 'clerk')
      expect(body.provider).toBe('clerk');
    });

    it('should handle optional metadata in request body', async () => {
      app = await build();
      await app.ready();

      const mockProviderToken = createMockJWT({
        provider: 'clerk',
        userId: 'user_meta123',
        email: 'metadata@example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${mockProviderToken}`,
        },
        payload: {
          metadata: {
            userAgent: 'Mozilla/5.0 (Test Browser)',
            deviceId: 'device-123',
            ipAddress: '192.168.1.1',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Should still return valid response
      expect(body.sessionToken).toBeDefined();
      expect(body.expiresAt).toBeDefined();
      expect(body.provider).toBe('clerk');
    });

    it('should ignore metadata in request body (simplified implementation)', async () => {
      app = await build();
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${createMockJWT({ provider: 'clerk', userId: 'user_validation' })}`,
        },
        payload: {
          metadata: 'any-value-ignored', // Metadata is ignored in simplified implementation
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.sessionToken).toBeDefined();
      expect(body.expiresAt).toBeDefined();
      expect(body.provider).toBe('clerk');
    });

    it('should work with empty request body', async () => {
      app = await build();
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${createMockJWT({ provider: 'clerk', userId: 'user_empty' })}`,
        },
        payload: {}, // Explicitly empty object instead of no payload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.sessionToken).toBeDefined();
      expect(body.expiresAt).toBeDefined();
      expect(body.provider).toBe('clerk');
    });

    it('should create session token with proper structure', async () => {
      app = await build();
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${createMockJWT({ provider: 'clerk', userId: 'user_jwt_test' })}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Verify session token is a base64url string (not a JWT)
      expect(typeof body.sessionToken).toBe('string');
      expect(body.sessionToken.length).toBeGreaterThan(40); // 32 bytes base64url encoded

      // Should not contain JWT structure (no dots)
      expect(body.sessionToken.includes('.')).toBe(false);

      // Should be valid base64url (only contains A-Z, a-z, 0-9, -, _)
      expect(/^[A-Za-z0-9_-]+$/.test(body.sessionToken)).toBe(true);

      // Verify response includes required fields
      expect(body).toHaveProperty('expiresAt');
      expect(body).toHaveProperty('provider', 'clerk');

      // Verify expiresAt is a valid ISO date string
      expect(() => new Date(body.expiresAt)).not.toThrow();
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('OpenAPI Documentation', () => {
    it('should be documented in OpenAPI schema', async () => {
      app = await build();
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);
      const openApiSpec = JSON.parse(response.payload);

      // Check that the exchange endpoint is documented
      expect(openApiSpec.paths).toHaveProperty('/api/auth/exchange');
      const exchangeEndpoint = openApiSpec.paths['/api/auth/exchange'];

      // Verify POST method exists
      expect(exchangeEndpoint).toHaveProperty('post');

      const postOperation = exchangeEndpoint.post;

      // Verify basic documentation
      expect(postOperation.summary).toBe(
        'Exchange provider token for session token'
      );
      expect(postOperation.tags).toContain('Authentication');

      // Verify security requirement
      expect(postOperation.security).toContainEqual({ BearerAuth: [] });

      // Verify response schemas
      expect(postOperation.responses).toHaveProperty('200');
      expect(postOperation.responses).toHaveProperty('401');
      expect(postOperation.responses).toHaveProperty('400');
    });
  });
});
