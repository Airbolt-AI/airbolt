import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { build } from '../../helper.js';
import type { FastifyInstance } from 'fastify';
import type { AIProviderService } from '../../../src/services/ai-provider.js';

/**
 * These tests violate @TESTING.md principles:
 * - They test JWT cryptographic validation (framework behavior)
 * - They test external services (JWKS fetching)
 * - They don't test our application's behavior
 *
 * See chat.auth-behavior.test.ts for proper auth behavior tests
 */
describe.skip('Auth0 Authentication Journey', () => {
  let app: FastifyInstance;
  let mockAIProviderService: Partial<AIProviderService>;
  const mockJWKS = {
    keys: [
      {
        kty: 'RSA',
        kid: 'test-key-1',
        use: 'sig',
        n: 'xGOr-H0A-6_BFZS9t3P7SsE8YPjWJKukR_Fgtm3qBSgeOEXyTj4qDgLDqLjqUBk1U6GGutdmci8VNa0tRkZrHaVEr9OsZAgrPgrnvBYGP_g4rnCfvHP-g0Cb6g6fYLf0t9-fKi0KS8XfZnD7Q6UYbIChqCIBqTSB7YH5RnGxYK8hQxnZ3aYvMKxAMa-J4CoJ19GTTFxYF4h0S6F4tqkBqr0e94r_GaFIg9c9FMYHbmHeBr9fDmQRygA9bXHJfWjxYWL1tBHKnAGMfAC8qHezxes04cDPzXRJQglk39r76Ug7qKBBiwWl5PwAUV0OGKM0_xjvJmpKoQkQ2S0cVQ',
        e: 'AQAB',
        alg: 'RS256',
      },
    ],
  };

  // Mock fetch for JWKS endpoints
  global.fetch = vi.fn();

  function createMockAuth0Token(
    options: {
      issuer?: string;
      audience?: string;
      subject?: string;
      expiresIn?: string | number;
      kid?: string;
    } = {}
  ) {
    const payload = {
      iss: options.issuer || 'https://dev-example.auth0.com/',
      sub: options.subject || 'auth0|123456789',
      aud: options.audience || 'https://api.example.com',
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) +
        (typeof options.expiresIn === 'number' ? options.expiresIn : 3600),
      azp: 'test-client-id',
      scope: 'openid profile email',
    };

    // Create a properly formatted JWT-like token
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: options.kid || 'test-key-1',
    };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      'base64url'
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url'
    );
    const signature = 'mock-signature';

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  beforeEach(async () => {
    vi.resetAllMocks();

    // Mock successful JWKS fetch by default
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockJWKS,
    } as Response);

    mockAIProviderService = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: 'Hello authenticated user!',
        usage: { total_tokens: 25 },
      }),
    };
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.restoreAllMocks();
  });

  describe('Development Mode (Auto-Discovery)', () => {
    beforeEach(async () => {
      app = await build({
        NODE_ENV: 'development',
        // No EXTERNAL_JWT_ISSUER configured - relies on auto-discovery
      });

      await app.ready();

      if (app.aiProvider) {
        vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
          mockAIProviderService.createChatCompletion as any
        );
      }
    });

    it('should validate Auth0 tokens automatically in dev mode', async () => {
      const auth0Token = createMockAuth0Token();

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${auth0Token}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello from Auth0' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-byoa-mode']).toBe('auto');

      const body = JSON.parse(response.payload);
      expect(body.content).toBe('Hello authenticated user!');

      // Verify JWKS was fetched
      expect(fetch).toHaveBeenCalledWith(
        'https://dev-example.auth0.com/.well-known/jwks.json',
        expect.any(Object)
      );
    });

    it('should handle multiple auth providers in the same session', async () => {
      // Auth0 token
      const auth0Token = createMockAuth0Token({
        issuer: 'https://dev-123.auth0.com/',
      });

      // Clerk token
      const clerkToken = createMockAuth0Token({
        issuer: 'https://clerk.example.com',
        kid: 'clerk-key-1',
      });

      // First request with Auth0
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${auth0Token}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello from Auth0' }],
        },
      });

      expect(response1.statusCode).toBe(200);

      // Second request with Clerk
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${clerkToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello from Clerk' }],
        },
      });

      expect(response2.statusCode).toBe(200);

      // Verify both JWKS endpoints were called
      expect(fetch).toHaveBeenCalledWith(
        'https://dev-123.auth0.com/.well-known/jwks.json',
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        'https://clerk.example.com/.well-known/jwks.json',
        expect.any(Object)
      );
    });

    it('should provide helpful error for Auth0 opaque tokens', async () => {
      // Create an opaque token (missing standard JWT claims)
      const opaqueToken = createMockAuth0Token({
        issuer: 'https://dev-example.auth0.com/',
      });

      // Override the token to be opaque-like
      const [header, , signature] = opaqueToken.split('.');
      const opaquePayload = Buffer.from(
        JSON.stringify({
          iss: 'https://dev-example.auth0.com/',
          // Missing standard claims makes it opaque-like
        })
      ).toString('base64url');
      const mockOpaqueToken = `${header}.${opaquePayload}.${signature}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${mockOpaqueToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Auth0');
      expect(body.message).toMatch(/audience|API/i);
    });
  });

  describe('Production Mode (Configured Issuer)', () => {
    beforeEach(async () => {
      app = await build({
        NODE_ENV: 'production',
        ALLOWED_ORIGIN: 'https://example.com',
        EXTERNAL_JWT_ISSUER: 'https://prod.auth0.com/',
        EXTERNAL_JWT_AUDIENCE: 'https://api.production.com',
      });

      await app.ready();

      if (app.aiProvider) {
        vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
          mockAIProviderService.createChatCompletion as any
        );
      }
    });

    it('should only accept tokens from configured issuer', async () => {
      // Correct issuer
      const validToken = createMockAuth0Token({
        issuer: 'https://prod.auth0.com/',
        audience: 'https://api.production.com',
      });

      const validResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(validResponse.statusCode).toBe(200);
      expect(validResponse.headers['x-byoa-mode']).toBe('configured');

      // Wrong issuer
      const invalidToken = createMockAuth0Token({
        issuer: 'https://different.auth0.com/',
        audience: 'https://api.production.com',
      });

      const invalidResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${invalidToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(invalidResponse.statusCode).toBe(401);
      const body = JSON.parse(invalidResponse.payload);
      expect(body.message).toContain('issuer');
    });

    it('should validate audience when configured', async () => {
      // Wrong audience
      const wrongAudienceToken = createMockAuth0Token({
        issuer: 'https://prod.auth0.com/',
        audience: 'https://wrong-api.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${wrongAudienceToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('audience');
    });
  });

  describe('JWKS Rotation and Caching', () => {
    it('should handle key rotation gracefully', async () => {
      app = await build({ NODE_ENV: 'development' });
      await app.ready();

      if (app.aiProvider) {
        vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
          mockAIProviderService.createChatCompletion as any
        );
      }

      // First token with kid: test-key-1
      const token1 = createMockAuth0Token({ kid: 'test-key-1' });

      const response1 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${token1}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response1.statusCode).toBe(200);

      // Update JWKS to include new key
      const updatedJWKS = {
        keys: [
          ...mockJWKS.keys,
          {
            kty: 'RSA',
            kid: 'test-key-2',
            use: 'sig',
            n: 'different-key-data',
            e: 'AQAB',
            alg: 'RS256',
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => updatedJWKS,
      } as Response);

      // Token with new kid
      const token2 = createMockAuth0Token({ kid: 'test-key-2' });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${token2}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello with new key' }],
        },
      });

      expect(response2.statusCode).toBe(200);
    });

    it('should cache JWKS to avoid excessive fetches', async () => {
      app = await build({ NODE_ENV: 'development' });
      await app.ready();

      if (app.aiProvider) {
        vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
          mockAIProviderService.createChatCompletion as any
        );
      }

      const token = createMockAuth0Token();

      // Multiple requests with same issuer
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          payload: {
            messages: [{ role: 'user', content: `Message ${i}` }],
          },
        });

        expect(response.statusCode).toBe(200);
      }

      // JWKS should only be fetched once due to caching
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle JWKS fetch failures gracefully', async () => {
      app = await build({ NODE_ENV: 'development' });
      await app.ready();

      // Mock JWKS fetch failure
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const token = createMockAuth0Token();

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Failed to fetch JWKS');
    });

    it('should reject expired tokens with clear message', async () => {
      app = await build({ NODE_ENV: 'development' });
      await app.ready();

      const expiredToken = createMockAuth0Token({
        expiresIn: -3600, // Expired 1 hour ago
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${expiredToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toMatch(/expired|exp/i);
    });
  });
});
