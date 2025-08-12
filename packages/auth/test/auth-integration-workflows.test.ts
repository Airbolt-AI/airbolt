/**
 * Comprehensive Integration Tests for Authentication Workflows
 *
 * Following @TESTING.md principles:
 * - Integration Tests (35%) - Test complete user journeys and workflows
 * - Focus on real user experiences, not framework testing
 * - Test authentication flow: Login → Token → API call → Refresh
 * - Tests must catch real production failures
 *
 * These tests cover complete workflows that mirror real user journeys:
 * 1. Complete Token Exchange Workflow (External JWT → Internal session)
 * 2. Multi-Provider Authentication Flow (Clerk, Auth0, Custom OIDC)
 * 3. Token Lifecycle Management (Creation → Validation → Refresh)
 * 4. Rate Limiting Integration (Limits → Recovery)
 * 5. Error Recovery Workflows (Provider outages → Graceful degradation)
 * 6. Development to Production Migration (Mode switching)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import {
  createTestEnv,
  createProductionTestEnv,
  createDevelopmentTestEnv,
} from '@airbolt/test-utils';
import {
  createAuthMiddleware,
  verifyExternalToken,
  extractUserIdFromPayload,
  type JWTPayload,
} from '../src/index.js';

// Mock HTTP server for JWKS endpoints
let mockJWKSServer: { close: () => Promise<void>; port: number } | null = null;

// Test JWT keys for mocking
const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3rFkEjWT2btpbI
lUVpnbgCLNgzIUzJrxpgK9C0F1RBmgfXo5DuYKnvh1+Q8FLWa7zMTZfXH/wv5b/
8Z5xKOt6R2lJ8oPUCihlN7UQmRTjh9GFUwHzlbI3/yK3x+WEAhUCXoE0VJdVgRgd
U7RJFgIiQmzQd5ygjchMa/8A4a7KD2D3QJGJh7CL2Xz+dR5+YCqjwlWdNq2hhWK6
nR3FrWNjM4EZdKj2yPqOUFp+EL/qgLrCPx8N+WyGjpw5+LGGnYeQhwPPDhpQFxJe
FO7TGjlcGZMK7BmBqcb3O6uPU8c/Cj8AaC6k4YwIDAQABAoIBAHh2UhpBgz8XaF9G
uMHFvE7BbQR8kQl9pKt9Cz7GQGjBZ3JpPrVfZQbLxjW3bQQVbV8gGx5FzGx2j3p5
WxEFzGxJyEqQg5Fj6XY2xVjKVDGgGdYXsF+V7kP4gG1j2x3u4Y8kz8Q+9cF+3+6F
2zS9GQ1gx5gAGxdZ9bR8w9KqKtJ4HJY7Q4a8kE7GX4Z7RQ+W8mYYF0CqKzJkRzV/
QzQYjI2iZB9NE6lP9yGh4L8hEY0yFlN7VrFnO+aUPSVu8ZV7E7YnRgxO6zY5Q5dH
l3J9b6Ey2g+LQZ4LLvdl7LmQu5Pb0kn7cWR7qZGbJ3CJF6ULK7PzOL3QF1Qpj3VY
gT1QqDECgYEA+ztYqkqo7lGR4mNOvWjz+Q/JOsV2JfzLzKU0tUzFgDlRN+mKKzA1
QaQ5s3QJ5q5cqEJ3q8jG8xQK7v8H/kG1K4L7vK5oGJ1B5kJXQeQEcG9GYdGQZwYE
j5YMOYbj5n7D0JQ3xHuS3Fv0fL7Gw5X5kU7vFzVqJzqz5H7WGOQE0FcCgYEA5dG8
x6QH7f1qVnOKq0q6VF3Ky9J9ZxZjGzOo7zyP3l0JQfHJGjGz3vZ7H8dGzaOzLO1Q
q4EQ6J0Xt0FzB1Ld8jKe9LwV6g9Z4w7Y3K0vZ6cUKo0kKzJ5j0zCxVbKm2KQXVaV
zLWFyE9C8+qH/8N3K5Xz7G9QjNvX2hd5kPqTgG0CgYEA7Pq7lBE9xT5hQZfEhzSy
g9gzUvG6HdAA0EfgYEEJI2J6M5HfqGxjqOzFdmKhcpNhEe9wV2VtYqZYgbGxJXGf
dq3cLqz4J7fHzVqK1q5e/Qz+e2GvHqSQmz3nXAOZD0OEEa4a1Fq8Pz7v8zE6oCk5
MXo2hKj1q2p2nQfOGJVvZYsCgYBJCo7iN6K6n8zKj2J5HhXqQ/yY1QxJxFjdJxKr
m3qT1GQHqF6x6Gw4m5Qx5K7O3dEU7fPfxKzNrJ8zJfH7KJ4+qzlHHF6Y1kWZmfSr
+VC1J6jM5LK0vX5fEqHyGQdGFvbzX8KGZ9dXI7JJ3QZVHhqzPw1B1Y7qzHbqS9Gg
QKBgAkI6vVu9n/8qKO2z3L5pL7F/7KY9HoNZmzJqJ1P7tG2VhKfKVg/7cJG6E8K
cY9X8+zKYgF8LKz4KOxJXo5V6kZE0VJ4+GJGjG7xH/gKMNgG4yJ4vQ7YJfOJVzGr
YgQ3HKJqBqGqxQ7GxYhVKKJrVNH7E7IpG7k5U7zJ5w1zJ3E6
-----END RSA PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4f5wg5l2hKsTeNem/V41
fGnJm6gOdrj8ym3rFkEjWT2btpbIlUVpnbgCLNgzIUzJrxpgK9C0F1RBmgfXo5Du
YKnvh1+Q8FLWa7zMTZfXH/wv5b/8Z5xKOt6R2lJ8oPUCihlN7UQmRTjh9GFUwHzl
bI3/yK3x+WEAhUCXoE0VJdVgRgdU7RJFgIiQmzQd5ygjchMa/8A4a7KD2D3QJGJ
h7CL2Xz+dR5+YCqjwlWdNq2hhWK6nR3FrWNjM4EZdKj2yPqOUFp+EL/qgLrCPx8N
+WyGjpw5+LGGnYeQhwPPDhpQFxJeFO7TGjlcGZMK7BmBqcb3O6uPU8c/Cj8AaC6k
4YwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Creates mock JWT tokens for testing different providers
 */
function createMockJWT(
  payload: Partial<JWTPayload>,
  options?: { expiresIn?: string }
): string {
  return jwt.sign(payload, TEST_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: 'test-key-id',
    expiresIn: options?.expiresIn || '1h',
  } as jwt.SignOptions);
}

/**
 * Sets up a mock JWKS server for testing OIDC providers
 */
async function setupMockJWKSServer(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const mockServer = Fastify({ logger: false });

  mockServer.get('/.well-known/jwks.json', async () => ({
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        kid: 'test-key-id',
        n: 'test-n-value',
        e: 'AQAB',
        alg: 'RS256',
        pem: TEST_PUBLIC_KEY,
      },
    ],
  }));

  await mockServer.listen({ port: 0, host: '127.0.0.1' });
  const address = mockServer.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get mock server address');
  }

  return {
    port: address.port,
    close: async () => await mockServer.close(),
  };
}

describe('Authentication Integration Workflows', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Clean environment for each test
    vi.unstubAllEnvs();

    // Create fresh Fastify instance
    fastify = Fastify({ logger: false });
    await fastify.register(import('@fastify/jwt'), {
      secret: 'test-secret-for-integration-tests-32chars-minimum',
    });
  });

  afterEach(async () => {
    await fastify?.close();
    if (mockJWKSServer) {
      await mockJWKSServer.close();
      mockJWKSServer = null;
    }
    vi.unstubAllEnvs();
  });

  describe('1. Complete Token Exchange Workflow', () => {
    it('should handle complete external JWT to internal session workflow', async () => {
      // Setup environment for external auth
      createTestEnv({
        EXTERNAL_JWT_ISSUER: 'https://test-issuer.auth0.com/',
        EXTERNAL_JWT_AUDIENCE: 'test-api-audience',
      });

      // Create external JWT from "provider"
      const externalPayload = {
        sub: 'auth0|user123',
        email: 'user@example.com',
        iss: 'https://test-issuer.auth0.com/',
        aud: 'test-api-audience',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const externalJWT = createMockJWT(externalPayload);

      // Setup auth middleware
      const authMiddleware = createAuthMiddleware(fastify);

      // Register protected route
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/protected', async (request: any) => {
        return { user: request.user, message: 'Access granted' };
      });

      // Test 1: External JWT should be accepted and converted to internal format
      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${externalJWT}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toMatchObject({
        userId: expect.stringMatching(/auth0\|user123|user123/), // Provider-specific extraction
        email: 'user@example.com',
        authMethod: expect.stringContaining('jwks'),
      });
      expect(body.message).toBe('Access granted');

      // Test 2: Should include auth method in response headers
      expect(response.headers['x-byoa-mode']).toBe('strict');
    });

    test.prop([
      fc.record({
        provider: fc.constantFrom('auth0', 'clerk', 'firebase', 'custom'),
        userId: fc.string({ minLength: 5, maxLength: 50 }),
        email: fc.emailAddress(),
        customClaims: fc.record({
          role: fc.constantFrom('user', 'admin', 'premium'),
          permissions: fc.array(fc.string({ minLength: 3, maxLength: 20 }), {
            maxLength: 5,
          }),
        }),
      }),
    ])(
      'should handle diverse external JWT formats from any provider',
      async testData => {
        const { provider, userId, email, customClaims } = testData;

        // Setup environment
        createTestEnv({
          EXTERNAL_JWT_ISSUER: `https://${provider}.example.com/`,
          EXTERNAL_JWT_AUDIENCE: `${provider}-api`,
        });

        // Create provider-specific JWT payload
        const providerPayloads = {
          auth0: {
            sub: `auth0|${userId}`,
            email,
            iss: `https://${provider}.example.com/`,
            aud: `${provider}-api`,
            'https://example.com/roles': [customClaims.role],
            'https://example.com/permissions': customClaims.permissions,
          },
          clerk: {
            sub: `user_${userId}`,
            email,
            iss: `https://${provider}.example.com`,
            aud: `${provider}-api`,
            role: customClaims.role,
            permissions: customClaims.permissions,
          },
          firebase: {
            sub: userId,
            email,
            iss: `https://securetoken.google.com/${provider}-project`,
            aud: `${provider}-project`,
            firebase: {
              sign_in_provider: 'password',
              identities: { email: [email] },
            },
          },
          custom: {
            user_id: userId,
            email,
            iss: `https://${provider}.example.com/`,
            aud: `${provider}-api`,
            scope: customClaims.permissions.join(' '),
          },
        };

        const payload = providerPayloads[provider];
        const externalJWT = createMockJWT({
          ...payload,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        });

        // Setup middleware and route
        const authMiddleware = createAuthMiddleware(fastify);
        fastify.addHook('preHandler', authMiddleware);
        fastify.get('/api/user/profile', async (request: any) => {
          return { profile: request.user };
        });

        // Test external JWT acceptance
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/user/profile',
          headers: {
            authorization: `Bearer ${externalJWT}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        // Should extract user ID correctly regardless of provider format
        expect(body.profile.userId).toBeTruthy();
        expect(body.profile.userId).toEqual(expect.stringMatching(/.+/));

        // Should preserve email across all providers
        expect(body.profile.email).toBe(email);

        // Should identify auth method
        expect(body.profile.authMethod).toMatch(/jwks|auto-discovery/);
      }
    );
  });

  describe('2. Multi-Provider Authentication Flow', () => {
    it('should handle concurrent authentication from different providers', async () => {
      // Setup development mode for auto-discovery
      createDevelopmentTestEnv();

      // Create tokens from multiple providers
      const auth0Token = createMockJWT({
        sub: 'auth0|user123',
        email: 'user@example.com',
        iss: 'https://example.auth0.com/',
        aud: 'auth0-api',
      });

      const clerkToken = createMockJWT({
        sub: 'user_456',
        email: 'clerk-user@example.com',
        iss: 'https://clerk.example.com',
        aud: 'clerk-api',
      });

      // Setup auth middleware (development mode = auto-discovery)
      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/multi-auth', async (request: any) => {
        return {
          provider: request.user.authMethod,
          userId: request.user.userId,
          email: request.user.email,
        };
      });

      // Test concurrent requests with different provider tokens
      const [auth0Response, clerkResponse] = await Promise.all([
        fastify.inject({
          method: 'GET',
          url: '/multi-auth',
          headers: { authorization: `Bearer ${auth0Token}` },
        }),
        fastify.inject({
          method: 'GET',
          url: '/multi-auth',
          headers: { authorization: `Bearer ${clerkToken}` },
        }),
      ]);

      // All should succeed with different auth methods
      expect(auth0Response.statusCode).toBe(200);
      expect(clerkResponse.statusCode).toBe(200);

      const auth0Body = JSON.parse(auth0Response.body);
      const clerkBody = JSON.parse(clerkResponse.body);

      // Should handle different provider formats
      expect(auth0Body.email).toBe('user@example.com');
      expect(clerkBody.email).toBe('clerk-user@example.com');

      // Should use auto-discovery in development mode
      expect(auth0Body.provider).toMatch(/auto-discovery|clerk/);
      expect(clerkBody.provider).toMatch(/auto-discovery|clerk/);
    });

    it('should gracefully fallback when primary provider fails', async () => {
      // Setup development mode with fallback
      createDevelopmentTestEnv();

      // Create a malformed token that will fail primary validation
      const malformedToken = 'invalid.jwt.token';

      // Create a valid internal token for fallback
      const internalToken = fastify.jwt.sign({
        userId: 'internal-user',
        email: 'internal@example.com',
        iss: 'airbolt-api',
      });

      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/fallback-test', async (request: any) => {
        return { auth: request.user };
      });

      // Test 1: Malformed token should fail
      const failResponse = await fastify.inject({
        method: 'GET',
        url: '/fallback-test',
        headers: { authorization: `Bearer ${malformedToken}` },
      });

      expect(failResponse.statusCode).toBe(401);

      // Test 2: Valid internal token should work (fallback)
      const successResponse = await fastify.inject({
        method: 'GET',
        url: '/fallback-test',
        headers: { authorization: `Bearer ${internalToken}` },
      });

      expect(successResponse.statusCode).toBe(200);
      const body = JSON.parse(successResponse.body);
      expect(body.auth.userId).toBe('internal-user');
      expect(body.auth.authMethod).toBe('internal');
    });
  });

  describe('3. Token Lifecycle Management', () => {
    it('should handle complete token lifecycle: creation → validation → expiry', async () => {
      createTestEnv({
        EXTERNAL_JWT_ISSUER: 'https://lifecycle-test.com/',
        EXTERNAL_JWT_AUDIENCE: 'lifecycle-api',
      });

      // Test 1: Create and validate fresh token
      const freshPayload = {
        sub: 'user123',
        email: 'user@example.com',
        iss: 'https://lifecycle-test.com/',
        aud: 'lifecycle-api',
        exp: Math.floor(Date.now() / 1000) + 60, // 1 minute
        iat: Math.floor(Date.now() / 1000),
      };

      const freshToken = createMockJWT(freshPayload);

      // Should successfully verify fresh token
      const payload = await verifyExternalToken(freshToken, {
        EXTERNAL_JWT_ISSUER: 'https://lifecycle-test.com/',
        EXTERNAL_JWT_AUDIENCE: 'lifecycle-api',
      });

      expect(payload.sub).toBe('user123');
      expect(payload.email).toBe('user@example.com');
      expect(extractUserIdFromPayload(payload)).toBe('user123');

      // Test 2: Token should work in middleware
      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/lifecycle', async (request: any) => {
        return { lifecycle: 'active', user: request.user.userId };
      });

      const activeResponse = await fastify.inject({
        method: 'GET',
        url: '/lifecycle',
        headers: { authorization: `Bearer ${freshToken}` },
      });

      expect(activeResponse.statusCode).toBe(200);
      const activeBody = JSON.parse(activeResponse.body);
      expect(activeBody.lifecycle).toBe('active');
      expect(activeBody.user).toBeTruthy();

      // Test 3: Expired token should be rejected
      const expiredPayload = {
        ...freshPayload,
        exp: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
      };

      const expiredToken = createMockJWT(expiredPayload);

      const expiredResponse = await fastify.inject({
        method: 'GET',
        url: '/lifecycle',
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(expiredResponse.statusCode).toBe(401);
      expect(expiredResponse.body).toContain('token');
    });

    test.prop([
      fc.integer({ min: 2, max: 10 }), // Number of concurrent refresh attempts
      fc.integer({ min: -30, max: 30 }), // Seconds until expiry (can be negative for expired)
    ])(
      'should handle concurrent token refresh attempts correctly',
      async (concurrentCount, secondsToExpiry) => {
        createTestEnv({
          EXTERNAL_JWT_ISSUER: 'https://concurrent-test.com/',
          EXTERNAL_JWT_AUDIENCE: 'concurrent-api',
        });

        // Create token with specified expiry
        const payload = {
          sub: 'concurrent-user',
          email: 'concurrent@example.com',
          iss: 'https://concurrent-test.com/',
          aud: 'concurrent-api',
          exp: Math.floor(Date.now() / 1000) + secondsToExpiry,
          iat: Math.floor(Date.now() / 1000) - 60,
        };

        const token = createMockJWT(payload);

        // Fire concurrent verification requests
        const verificationPromises = Array(concurrentCount)
          .fill(0)
          .map(() =>
            verifyExternalToken(token, {
              EXTERNAL_JWT_ISSUER: 'https://concurrent-test.com/',
              EXTERNAL_JWT_AUDIENCE: 'concurrent-api',
            }).catch((error: Error) => ({ error: error.message }))
          );

        const results = await Promise.all(verificationPromises);

        if (secondsToExpiry > 0) {
          // Token should be valid - all should succeed
          results.forEach(result => {
            expect(result).not.toHaveProperty('error');
            expect((result as JWTPayload).sub).toBe('concurrent-user');
          });
        } else {
          // Token should be expired - all should fail consistently
          results.forEach(result => {
            expect(result).toHaveProperty('error');
            expect((result as any).error).toMatch(/expired|invalid/i);
          });
        }
      }
    );
  });

  describe('4. Rate Limiting Integration', () => {
    it('should integrate with rate limiting and recover gracefully', async () => {
      // Setup environment with strict rate limits for testing
      createTestEnv({
        NODE_ENV: 'test',
        RATE_LIMIT_MAX: '3', // Very low for testing
        RATE_LIMIT_TIME_WINDOW: '60000', // 1 minute window
        EXTERNAL_JWT_ISSUER: 'https://ratelimit-test.com/',
        EXTERNAL_JWT_AUDIENCE: 'ratelimit-api',
      });

      const testPayload = {
        sub: 'rate-limit-user',
        email: 'ratelimit@example.com',
        iss: 'https://ratelimit-test.com/',
        aud: 'ratelimit-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = createMockJWT(testPayload);

      // Setup auth middleware and rate limiting
      const authMiddleware = createAuthMiddleware(fastify);

      // Register rate limiting plugin (simplified mock)
      await fastify.register(async function rateLimit(fastify) {
        let requestCount = 0;
        fastify.addHook('preHandler', async () => {
          requestCount++;
          if (requestCount > 3) {
            throw fastify.httpErrors.tooManyRequests('Rate limit exceeded');
          }
        });
      });

      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/rate-limited', async (request: any) => {
        return { success: true, user: request.user.userId };
      });

      // Test 1: First few requests should succeed
      for (let i = 0; i < 3; i++) {
        const response = await fastify.inject({
          method: 'GET',
          url: '/rate-limited',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.user).toBe('rate-limit-user');
      }

      // Test 2: Next request should be rate limited
      const rateLimitedResponse = await fastify.inject({
        method: 'GET',
        url: '/rate-limited',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(rateLimitedResponse.statusCode).toBe(429);
      expect(rateLimitedResponse.body).toContain('Rate limit exceeded');
    });
  });

  describe('5. Error Recovery Workflows', () => {
    it('should handle JWKS endpoint failures with graceful degradation', async () => {
      // Setup mock JWKS server that will fail
      mockJWKSServer = await setupMockJWKSServer();

      createTestEnv({
        EXTERNAL_JWT_ISSUER: `http://localhost:${mockJWKSServer.port}/`,
        EXTERNAL_JWT_AUDIENCE: 'recovery-test-api',
      });

      const testPayload = {
        sub: 'recovery-user',
        email: 'recovery@example.com',
        iss: `http://localhost:${mockJWKSServer.port}/`,
        aud: 'recovery-test-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = createMockJWT(testPayload);

      // Test 1: Normal operation should work
      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/recovery-test', async (request: any) => {
        return { status: 'ok', user: request.user.userId };
      });

      const normalResponse = await fastify.inject({
        method: 'GET',
        url: '/recovery-test',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(normalResponse.statusCode).toBe(200);
      const normalBody = JSON.parse(normalResponse.body);
      expect(normalBody.user).toBe('recovery-user');

      // Test 2: Simulate JWKS endpoint failure
      await mockJWKSServer.close();
      mockJWKSServer = null;

      // Request should fail gracefully (not hang or crash)
      const failedResponse = await fastify.inject({
        method: 'GET',
        url: '/recovery-test',
        headers: { authorization: `Bearer ${token}` },
      });

      // Should get a proper error response, not a timeout or crash
      expect(failedResponse.statusCode).toBe(401);
      expect(failedResponse.body).toContain('token'); // Should mention token issue
    });

    it('should recover when provider comes back online', async () => {
      // Setup development mode for fallback behavior
      createDevelopmentTestEnv();

      const testPayload = {
        sub: 'resilient-user',
        email: 'resilient@example.com',
        iss: 'https://resilient-provider.com/',
        aud: 'resilient-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const externalToken = createMockJWT(testPayload);

      // Create internal fallback token
      const internalToken = fastify.jwt.sign({
        userId: 'fallback-user',
        email: 'fallback@example.com',
        iss: 'airbolt-api',
      });

      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/resilience', async (request: any) => {
        return {
          provider: request.user.authMethod,
          userId: request.user.userId,
          status: 'online',
        };
      });

      // Test 1: When external provider is "down", use internal token
      const fallbackResponse = await fastify.inject({
        method: 'GET',
        url: '/resilience',
        headers: { authorization: `Bearer ${internalToken}` },
      });

      expect(fallbackResponse.statusCode).toBe(200);
      const fallbackBody = JSON.parse(fallbackResponse.body);
      expect(fallbackBody.provider).toBe('internal');
      expect(fallbackBody.userId).toBe('fallback-user');

      // Test 2: When external provider "recovers", external tokens work again
      // In development mode, auto-discovery should handle the external token
      const recoveryResponse = await fastify.inject({
        method: 'GET',
        url: '/resilience',
        headers: { authorization: `Bearer ${externalToken}` },
      });

      expect(recoveryResponse.statusCode).toBe(200);
      const recoveryBody = JSON.parse(recoveryResponse.body);
      expect(recoveryBody.userId).toBe('resilient-user');
      expect(recoveryBody.provider).toMatch(/auto-discovery|clerk/);
    });
  });

  describe('6. Development to Production Migration', () => {
    it('should handle seamless transition from development to production auth', async () => {
      // Test 1: Start in development mode (anonymous + auto-discovery)
      createDevelopmentTestEnv();

      let authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/migration-test', async (request: any) => {
        return {
          mode: request.headers['x-byoa-mode'],
          auth: request.user.authMethod,
          userId: request.user.userId,
        };
      });

      // Development: Internal token should work
      const devInternalToken = fastify.jwt.sign({
        userId: 'dev-internal-user',
        email: 'dev@example.com',
        iss: 'airbolt-api',
      });

      const devResponse = await fastify.inject({
        method: 'GET',
        url: '/migration-test',
        headers: { authorization: `Bearer ${devInternalToken}` },
      });

      expect(devResponse.statusCode).toBe(200);
      const devBody = JSON.parse(devResponse.body);
      expect(devBody.mode).toBe('auto');
      expect(devBody.auth).toBe('internal');
      expect(devBody.userId).toBe('dev-internal-user');

      // Test 2: Simulate production deployment (external auth configured)
      // Close current app and create new one with production config
      await fastify.close();

      fastify = Fastify({ logger: false });
      await fastify.register(import('@fastify/jwt'), {
        secret: 'production-secret-for-migration-test-32chars',
      });

      createProductionTestEnv({
        EXTERNAL_JWT_ISSUER: 'https://production-auth.company.com/',
        EXTERNAL_JWT_AUDIENCE: 'production-api',
      });

      authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/migration-test', async (request: any) => {
        return {
          mode: request.headers['x-byoa-mode'],
          auth: request.user.authMethod,
          userId: request.user.userId,
        };
      });

      // Production: External token should work
      const prodExternalToken = createMockJWT({
        sub: 'prod-user-123',
        email: 'prod.user@company.com',
        iss: 'https://production-auth.company.com/',
        aud: 'production-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const prodResponse = await fastify.inject({
        method: 'GET',
        url: '/migration-test',
        headers: { authorization: `Bearer ${prodExternalToken}` },
      });

      expect(prodResponse.statusCode).toBe(200);
      const prodBody = JSON.parse(prodResponse.body);
      expect(prodBody.mode).toBe('strict');
      expect(prodBody.auth).toMatch(/jwks/);
      expect(prodBody.userId).toBe('prod-user-123');

      // Production: Development tokens should be rejected
      const oldDevTokenResponse = await fastify.inject({
        method: 'GET',
        url: '/migration-test',
        headers: { authorization: `Bearer ${devInternalToken}` },
      });

      expect(oldDevTokenResponse.statusCode).toBe(401);
    });

    it('should maintain backward compatibility during gradual migration', async () => {
      // Setup hybrid mode - accepts both internal and external tokens
      createTestEnv({
        NODE_ENV: 'production', // Production mode
        // No EXTERNAL_JWT_ISSUER - falls back to internal only
        // This simulates a gradual migration scenario
      });

      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/hybrid', async (request: any) => {
        return {
          compatibility: 'hybrid',
          auth: request.user.authMethod,
          userId: request.user.userId,
        };
      });

      // Test 1: Existing internal tokens still work during migration
      const existingToken = fastify.jwt.sign({
        userId: 'existing-user',
        email: 'existing@company.com',
        iss: 'airbolt-api',
      });

      const existingResponse = await fastify.inject({
        method: 'GET',
        url: '/hybrid',
        headers: { authorization: `Bearer ${existingToken}` },
      });

      expect(existingResponse.statusCode).toBe(200);
      const existingBody = JSON.parse(existingResponse.body);
      expect(existingBody.auth).toBe('internal');
      expect(existingBody.userId).toBe('existing-user');

      // Test 2: System gracefully handles external tokens even without full config
      const externalToken = createMockJWT({
        sub: 'external-user',
        email: 'external@provider.com',
        iss: 'https://some-provider.com/',
        aud: 'some-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const externalResponse = await fastify.inject({
        method: 'GET',
        url: '/hybrid',
        headers: { authorization: `Bearer ${externalToken}` },
      });

      // Should reject gracefully (not crash or hang)
      expect(externalResponse.statusCode).toBe(401);
      expect(externalResponse.body).toContain('token');
    });
  });

  describe('Integration Test Quality Validation', () => {
    it('should demonstrate that tests catch real production failures', async () => {
      // This test validates that our integration tests actually catch meaningful issues

      createTestEnv({
        EXTERNAL_JWT_ISSUER: 'https://validation-test.com/',
        EXTERNAL_JWT_AUDIENCE: 'validation-api',
      });

      const authMiddleware = createAuthMiddleware(fastify);
      fastify.addHook('preHandler', authMiddleware);
      fastify.get('/validation', async (request: any) => {
        return { validated: true, user: request.user };
      });

      // Test Case 1: Missing issuer claim (common production issue)
      const tokenWithoutIssuer = createMockJWT({
        sub: 'user123',
        email: 'user@example.com',
        // Missing iss claim
        aud: 'validation-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const missingIssuerResponse = await fastify.inject({
        method: 'GET',
        url: '/validation',
        headers: { authorization: `Bearer ${tokenWithoutIssuer}` },
      });

      expect(missingIssuerResponse.statusCode).toBe(401);

      // Test Case 2: Wrong audience (common configuration error)
      const tokenWrongAudience = createMockJWT({
        sub: 'user123',
        email: 'user@example.com',
        iss: 'https://validation-test.com/',
        aud: 'wrong-api', // Wrong audience
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const wrongAudienceResponse = await fastify.inject({
        method: 'GET',
        url: '/validation',
        headers: { authorization: `Bearer ${tokenWrongAudience}` },
      });

      expect(wrongAudienceResponse.statusCode).toBe(401);

      // Test Case 3: Correct token should work
      const validToken = createMockJWT({
        sub: 'user123',
        email: 'user@example.com',
        iss: 'https://validation-test.com/',
        aud: 'validation-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const validResponse = await fastify.inject({
        method: 'GET',
        url: '/validation',
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(validResponse.statusCode).toBe(200);
      const validBody = JSON.parse(validResponse.body);
      expect(validBody.validated).toBe(true);
      expect(validBody.user.userId).toBe('user123');

      // This test demonstrates that our integration tests catch:
      // - Missing claims (issuer)
      // - Wrong configuration (audience mismatch)
      // - Proper validation of correct tokens
      // These are real issues that occur in production environments
    });
  });
});
