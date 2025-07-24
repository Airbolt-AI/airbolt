import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  InternalJWTValidator,
  ExternalJWTValidator,
  createAuthMiddleware,
} from './index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

describe('Real Provider JWT Integration', () => {
  const testSecret = 'test-secret-at-least-32-chars-long';
  const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu
NMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa0VzMaQ8s+CLOyS56YyCFGeJZ
qgtzJ6GR3eqoYSW9b9UMvkBpZODSctWSNGj3P7jRFDO5VoTwCQAWbFnOjDfH5Ulg
p2PKSQnSJP3AJLQNFNe7br1XbrhV//eO+t51mIpGSDCUv3E0DDFcWDTH9cXDTTlR
ZVEiR2BwpZOOkE/Z0/BVnhZYL71oZV34bKfWjQIt6V/isSMahdsAASACp4ZTGtwi
VuNd9tybAgMBAAECggEBAKTmjaS6tkK8BlPXClTQ2vpz/N6uxDeS35mXpqasqskV
laAidgg/sWqpjXDbXr93otIMLlWsM+X0CqMDgSXKejLS2jx4GDjI1ZTXg++0AMJ8
sJ74pWzVDOfmCEQ/7wXs3+cbnXhKriO8Z036q92Qc1+N87SI38nkGa0ABH9CN83H
mQqt4fB7UdHzuIRe/me2PGhIq5ZBzj6h3BpoPGzEP+x3l9YmK8t/1cN0pqI+dQwY
dgfGjackLu/2qH80MCF7IyQaseZUOJyKrCLtSD/Iixv/hzDEUPfOCjFDgTpzf3cw
ta8+oE4wHCo1iI1/4TlPkwmXx4qSXtmw4aQPz7IDQvECgYEA8KNThCO2gsC2I9PQ
DM/8Cw0O983WCDY+oi+7JPiNAJwv5DYBqEZB1QYdj06YD16XlC/HAZMsMku1na2T
N0driwenQQWzoev3g2S7gRDoS/FCJSI3jJ+kjgtaA7Qmzlgk1TxODN+G1H91HW7t
0l7VnL27IWyYo2qRRK3jzxqUiPUCgYEAx0oQs2reBQGMVZnApD1jeq7n4MvNLcPv
t8b/eU9iUv6Y4Mj0Suo/AU8lYZXm8ubbqAlwz2VSVunD2tOplHyMUrtCtObAfVDU
AhCndKaA9gApgfb3xw1IKbuQ1u4IF1FJl3VtumfQn//LiH1B3rXhcdyo3/vIttEk
48RakUKClU8CgYEAzV7W3COOlDDcQd935DdtKBFRAPRPAlspQUnzMi5eSHMD/ISL
DY5IiQHbIH83D4bvXq0X7qQoSBSNP7Dvv3HYuqMhf0DaegrlBuJllFVVq9qPVRnK
xt1Il2HgxOBvbhOT+9in1BzA+YJ99UzC85O0Qz06A+CmtHEy4aZ2kj5hHjECgYEA
mNS4+A8Fkss8Js1RieK2LniBxMgmYml3pfVLKGnzmng7H2+cwPLhPIzIuwytXywh
2bzbsYEfYx3EoEVgMEpPhoarQnYPukrJO4gwE2o5Te6T5mJSZGlQJQj9q4ZB2Dfz
et6INsK0oG8XVGXSpQvQh3RUYekCZQkBBFcpqWpbIEsCgYAnM3DQf3FJoSnXaMhr
VBIovic5l0xFkEHskAjFTevO86Fsz1C2aSeRKSqGFoOQ0tmJzBEs1R6KqnHInicD
TQrKhArgLXX4v3CddjfTRJkFWDbE/CkvKZNOrcf1nhaGCPspRJj2KUkj1Fhl9Cnc
dn/RsYEONbwQSjIfMPkvxF+8HQ==
-----END PRIVATE KEY-----`;
  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;

  let mockFastify: any;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    mockFastify = {
      jwt: {
        verify: (token: string) =>
          jwt.verify(token, testSecret, { issuer: 'airbolt-api' }),
      },
      httpErrors: {
        unauthorized: (msg: string) => new Error(`Unauthorized: ${msg}`),
      },
      log: {
        debug: () => {},
      },
    };

    mockRequest = {
      headers: {},
      server: mockFastify,
    };

    mockReply = {};
  });

  // Real provider token structures based on 2025 documentation
  const REAL_PROVIDER_TOKENS = {
    clerk: {
      sub: 'user_1deJLArSTiWiF1YdsEWysnhJLLY',
      iss: 'https://clean-mayfly-62.clerk.accounts.dev',
      aud: 'http://localhost:3000',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      azp: 'http://localhost:3000',
      jti: '10db7f531a90cb2faea4',
      nbf: Math.floor(Date.now() / 1000) - 60,
    },
    auth0: {
      sub: 'auth0|123456',
      iss: 'https://myapp.auth0.com/',
      aud: ['https://myapp.com/api', 'https://myapp.auth0.com/userinfo'],
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      azp: 'client-id',
    },
    firebase: {
      sub: 'firebase-uuid-d4f7b8c9a2e1',
      iss: 'https://securetoken.google.com/project-id',
      aud: 'project-id',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      auth_time: Math.floor(Date.now() / 1000),
      firebase: {
        identities: {},
        sign_in_provider: 'custom',
      },
    },
    supabase: {
      sub: '8ccaa7af-909f-44e7-84cb-67cdccb56be6',
      user_id: '8ccaa7af-909f-44e7-84cb-67cdccb56be6',
      iss: 'https://myproject.supabase.co/auth/v1',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      role: 'authenticated',
      aal: 'aal1',
      session_id: 'session-uuid',
      email: 'user@example.com',
      is_anonymous: false,
    },
  };

  describe('validates real provider token structures', () => {
    for (const [provider, claims] of Object.entries(REAL_PROVIDER_TOKENS)) {
      it(`correctly handles ${provider} tokens`, async () => {
        // Create properly signed token
        const token = jwt.sign(claims, testPrivateKey, { algorithm: 'RS256' });

        // Setup validators
        const validators = [
          new InternalJWTValidator(mockFastify as FastifyInstance),
          new ExternalJWTValidator(testPublicKey, ['RS256']),
        ];

        // Setup request
        mockRequest.headers.authorization = `Bearer ${token}`;

        // Create and execute middleware
        const middleware = createAuthMiddleware(
          mockFastify as FastifyInstance,
          validators
        );

        await middleware(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        );

        // Verify token was accepted
        expect(mockRequest.user).toBeDefined();
        expect(mockRequest.user.authMethod).toBe('external');
        expect(mockRequest.user.userId).toBeTruthy();
        expect(typeof mockRequest.user.userId).toBe('string');

        // Verify correct userId extraction based on provider
        let expectedUserId: string;
        if (provider === 'auth0') {
          // Auth0 prefix should be cleaned
          expectedUserId = '123456';
        } else if (provider === 'supabase') {
          // Supabase uses sub claim
          expectedUserId = claims.sub;
        } else {
          // Clerk and Firebase use sub directly
          expectedUserId = claims.sub;
        }

        expect(mockRequest.user.userId).toBe(expectedUserId);
      });
    }
  });

  describe('handles provider-specific edge cases', () => {
    it('handles Auth0 tokens with various sub formats', async () => {
      const auth0Formats = [
        'auth0|123456',
        'google-oauth2|987654321',
        'facebook|abcdef',
        'github|username',
      ];

      for (const sub of auth0Formats) {
        const claims = {
          sub,
          iss: 'https://myapp.auth0.com/',
          aud: 'https://myapp.com/api',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        };

        const token = jwt.sign(claims, testPrivateKey, { algorithm: 'RS256' });
        mockRequest.headers.authorization = `Bearer ${token}`;
        mockRequest.user = undefined;

        const validators = [
          new InternalJWTValidator(mockFastify as FastifyInstance),
          new ExternalJWTValidator(testPublicKey, ['RS256']),
        ];

        const middleware = createAuthMiddleware(
          mockFastify as FastifyInstance,
          validators
        );

        await middleware(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        );

        // Should clean the provider prefix
        const expectedUserId = sub.replace(
          /^(auth0\||google-oauth2\||facebook\|)/,
          ''
        );
        expect(mockRequest.user.userId).toBe(expectedUserId);
      }
    });

    it('rejects tokens with missing user identification claims', async () => {
      const invalidClaims = {
        iss: 'https://example.com',
        aud: 'test',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        // No sub, user_id, userId, or email
      };

      const token = jwt.sign(invalidClaims, testPrivateKey, {
        algorithm: 'RS256',
      });
      mockRequest.headers.authorization = `Bearer ${token}`;

      const validators = [
        new InternalJWTValidator(mockFastify as FastifyInstance),
        new ExternalJWTValidator(testPublicKey, ['RS256']),
      ];

      const middleware = createAuthMiddleware(
        mockFastify as FastifyInstance,
        validators
      );

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Invalid authorization token');
    });

    it('rejects expired tokens', async () => {
      const expiredClaims = {
        sub: 'user123',
        iss: 'https://example.com',
        aud: 'test',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
      };

      const token = jwt.sign(expiredClaims, testPrivateKey, {
        algorithm: 'RS256',
      });
      mockRequest.headers.authorization = `Bearer ${token}`;

      const validators = [
        new InternalJWTValidator(mockFastify as FastifyInstance),
        new ExternalJWTValidator(testPublicKey, ['RS256']),
      ];

      const middleware = createAuthMiddleware(
        mockFastify as FastifyInstance,
        validators
      );

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Invalid authorization token');
    });
  });
});
