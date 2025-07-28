import { describe, it, expect, afterEach, vi } from 'vitest';
import { build } from '../../helper.js';
import type { FastifyInstance } from 'fastify';

describe('Security Isolation Tests', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.restoreAllMocks();
  });

  describe('Internal Token Endpoint Protection', () => {
    it('should disable /api/tokens when external auth is configured', async () => {
      app = await build({
        EXTERNAL_JWT_ISSUER: 'https://test.auth0.com/',
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: {
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain(
        'Endpoint disabled when external auth is configured'
      );
    });

    it('should enable /api/tokens in anonymous mode', async () => {
      app = await build({
        NODE_ENV: 'production',
        ALLOWED_ORIGIN: 'https://example.com',
        // Explicitly disable external auth
        EXTERNAL_JWT_ISSUER: '',
        EXTERNAL_JWT_PUBLIC_KEY: '',
        EXTERNAL_JWT_SECRET: '',
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: {
          'content-type': 'application/json',
        },
        payload: {},
      });

      // Should return 201 with a token (not 404)
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe('string');
    });

    it.skip('should disable tokens in all external auth modes', async () => {
      const authConfigs = [
        // Configured issuer mode
        { EXTERNAL_JWT_ISSUER: 'https://auth.example.com/' },
        // Legacy key mode
        { EXTERNAL_JWT_PUBLIC_KEY: 'some-public-key' },
        // Legacy secret mode
        { EXTERNAL_JWT_SECRET: 'some-shared-secret' },
      ];

      for (const config of authConfigs) {
        if (app) await app.close();

        app = await build(config);
        await app.ready();

        const response = await app.inject({
          method: 'POST',
          url: '/api/tokens',
          headers: {
            'content-type': 'application/json',
          },
          payload: {},
        });

        expect(response.statusCode).toBe(404);
      }
    });
  });

  describe('Auth Mode Headers', () => {
    it.skip('should set X-BYOA-Mode header for all auth responses', async () => {
      const testCases = [
        {
          config: {
            NODE_ENV: 'production',
            ALLOWED_ORIGIN: 'https://example.com',
            // Explicitly disable external auth
            EXTERNAL_JWT_ISSUER: '',
            EXTERNAL_JWT_PUBLIC_KEY: '',
            EXTERNAL_JWT_SECRET: '',
          },
          expectedMode: 'auto',
        },
        {
          config: { NODE_ENV: 'development' },
          expectedMode: 'auto',
        },
        {
          config: { EXTERNAL_JWT_ISSUER: 'https://test.auth0.com/' },
          expectedMode: 'strict',
        },
        {
          config: { EXTERNAL_JWT_PUBLIC_KEY: 'test-key' },
          expectedMode: 'strict',
        },
      ];

      for (const testCase of testCases) {
        if (app) await app.close();

        app = await build(testCase.config);
        await app.ready();

        // Mock AI provider for successful requests
        if (app.aiProvider) {
          vi.spyOn(app.aiProvider, 'createChatCompletion').mockResolvedValue({
            content: 'Test response',
            usage: { total_tokens: 10 },
          });
        }

        // Test successful request
        const successResponse = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: { 'content-type': 'application/json' },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(successResponse.headers['x-byoa-mode']).toBe(
          testCase.expectedMode
        );

        // Test failed auth request
        const failResponse = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer invalid-token',
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(failResponse.headers['x-byoa-mode']).toBe(testCase.expectedMode);
      }
    });
  });

  describe('Cross-Mode Security', () => {
    it.skip('should not accept internal tokens when external auth is configured', async () => {
      // First, get an internal token in anonymous mode
      const anonymousApp = await build({
        NODE_ENV: 'production',
        ALLOWED_ORIGIN: 'https://example.com',
        // Explicitly disable external auth
        EXTERNAL_JWT_ISSUER: '',
        EXTERNAL_JWT_PUBLIC_KEY: '',
        EXTERNAL_JWT_SECRET: '',
      });
      await anonymousApp.ready();

      const tokenResponse = await anonymousApp.inject({
        method: 'POST',
        url: '/api/tokens',
      });

      expect(tokenResponse.statusCode).toBe(201);
      const { token: internalToken } = JSON.parse(tokenResponse.payload);

      await anonymousApp.close();

      // Now try to use that token with external auth configured
      app = await build({
        EXTERNAL_JWT_ISSUER: 'https://test.auth0.com/',
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${internalToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Unauthorized');
    });

    it('should not accept external tokens in anonymous mode', async () => {
      app = await build({
        NODE_ENV: 'production',
        ALLOWED_ORIGIN: 'https://example.com',
        // Explicitly disable external auth - anonymous mode
        EXTERNAL_JWT_ISSUER: '',
        EXTERNAL_JWT_PUBLIC_KEY: '',
        EXTERNAL_JWT_SECRET: '',
      });
      await app.ready();

      // Create a mock external token
      const header = { alg: 'RS256', typ: 'JWT', kid: 'external-key' };
      const payload = {
        iss: 'https://external.auth0.com/',
        sub: 'auth0|user123',
        aud: 'https://api.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
        'base64url'
      );
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url'
      );
      const externalToken = `${encodedHeader}.${encodedPayload}.mock-signature`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${externalToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Development vs Production Security', () => {
    it('should enforce strict issuer validation in production', async () => {
      app = await build({
        NODE_ENV: 'production',
        ALLOWED_ORIGIN: 'https://example.com',
        EXTERNAL_JWT_ISSUER: 'https://prod.auth0.com/',
      });
      await app.ready();

      // Mock JWKS endpoint
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [] }),
      } as Response);

      // Token from different issuer
      const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key' };
      const payload = {
        iss: 'https://different.auth0.com/', // Wrong issuer
        sub: 'auth0|user123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
        'base64url'
      );
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url'
      );
      const wrongIssuerToken = `${encodedHeader}.${encodedPayload}.mock-signature`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${wrongIssuerToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Invalid authorization token');
    });

    it.skip('should allow any HTTPS issuer in development mode', async () => {
      app = await build({
        NODE_ENV: 'development',
        // Explicitly disable external auth - auto-discovery mode
        EXTERNAL_JWT_ISSUER: '',
        EXTERNAL_JWT_PUBLIC_KEY: '',
        EXTERNAL_JWT_SECRET: '',
      });
      await app.ready();

      // Mock JWKS endpoint
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          keys: [
            {
              kty: 'RSA',
              kid: 'test-key',
              use: 'sig',
              n: 'mock-key-data',
              e: 'AQAB',
              alg: 'RS256',
            },
          ],
        }),
      } as Response);

      // Mock AI provider
      if (app.aiProvider) {
        vi.spyOn(app.aiProvider, 'createChatCompletion').mockResolvedValue({
          content: 'Test response',
          usage: { total_tokens: 10 },
        });
      }

      // Tokens from different issuers should all work
      const issuers = [
        'https://dev.auth0.com/',
        'https://clerk.example.com',
        'https://firebase.google.com/project-123',
      ];

      for (const issuer of issuers) {
        const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key' };
        const payload = {
          iss: issuer,
          sub: 'user123',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
          'base64url'
        );
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
          'base64url'
        );
        const token = `${encodedHeader}.${encodedPayload}.mock-signature`;

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

        // Should accept all HTTPS issuers in dev mode
        expect(response.statusCode).toBe(200);
      }

      // But reject non-HTTPS issuers
      const insecureToken = `${Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
        JSON.stringify({
          iss: 'http://insecure.com/', // HTTP not HTTPS
          sub: 'user123',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url')}.mock-signature`;

      const insecureResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${insecureToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(insecureResponse.statusCode).toBe(401);
    });
  });

  describe('Migration Path', () => {
    it.skip('should support legacy PUBLIC_KEY configuration', async () => {
      const mockPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxGOr+H0A+6/BFZS9t3P7
SsE8YPjWJKukR/Fgtm3qBSgeOEXyTj4qDgLDqLjqUBk1U6GGutdmci8VNa0tRkZr
HaVEr9OsZAgrPgrnvBYGP/g4rnCfvHP+g0Cb6g6fYLf0t9+fKi0KS8XfZnD7Q6UY
bIChqCIBqTSB7YH5RnGxYK8hQxnZ3aYvMKxAMa+J4CoJ19GTTFxYF4h0S6F4tqkB
qr0e94r/GaFIg9c9FMYHbmHeBr9fDmQRygA9bXHJfWjxYWL1tBHKnAGMfAC8qHez
xes04cDPzXRJQglk39r76Ug7qKBBiwWl5PwAUV0OGKM0/xjvJmpKoQkQ2S0cVQID
AQAB
-----END PUBLIC KEY-----`;

      app = await build({
        EXTERNAL_JWT_PUBLIC_KEY: mockPublicKey,
      });
      await app.ready();

      // Should be in legacy mode
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.headers['x-byoa-mode']).toBe('legacy');

      // Should disable internal tokens
      const tokenResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
      });

      expect(tokenResponse.statusCode).toBe(404);
    });

    it.skip('should support legacy SECRET configuration', async () => {
      app = await build({
        EXTERNAL_JWT_SECRET: 'shared-secret-key-for-hmac',
      });
      await app.ready();

      // Should be in legacy mode
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.headers['x-byoa-mode']).toBe('legacy');

      // Should disable internal tokens
      const tokenResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
      });

      expect(tokenResponse.statusCode).toBe(404);
    });
  });
});
