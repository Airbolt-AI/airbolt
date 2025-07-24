import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware } from './middleware.js';
import {
  InternalJWTValidator,
  ExternalJWTValidator,
  type JWTValidator,
} from './jwt-validators.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

describe('Auth Middleware Property Tests', () => {
  // Helper function to create test tokens
  const createTestToken = (
    type: 'internal' | 'external' | 'malformed',
    issuer: string,
    valid: boolean = true
  ): string => {
    if (type === 'malformed') {
      return 'not.a.valid.jwt';
    }

    if (type === 'internal') {
      return jwt.sign({ userId: 'test-user', iss: issuer }, testSecret, {
        algorithm: 'HS256',
      });
    }

    // External token
    if (valid) {
      // Never use airbolt-api issuer for external tokens
      const externalIssuer =
        issuer === 'airbolt-api' ? 'https://external.example.com' : issuer;
      return jwt.sign({ sub: 'user123', iss: externalIssuer }, testPrivateKey, {
        algorithm: 'RS256',
      });
    }

    // Invalid external token
    return 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaXNzIjoiaW52YWxpZCJ9.invalid-signature';
  };
  const testSecret = 'test-secret-at-least-32-chars-long';
  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;
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

  describe('JWT claim extraction', () => {
    it('extracts userId from any valid JWT structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.option(fc.string({ minLength: 1 })),
            user_id: fc.option(fc.string({ minLength: 1 })),
            userId: fc.option(fc.string({ minLength: 1 })),
            email: fc.option(fc.emailAddress()),
            iss: fc.string({ minLength: 1 }),
            exp: fc.integer({
              min: Math.floor(Date.now() / 1000) + 60,
              max: 2147483647,
            }),
            iat: fc.integer({ min: 0, max: Math.floor(Date.now() / 1000) }),
          }),
          fc.constantFrom('internal', 'external'),
          async (claims, authType) => {
            // Create validators
            const validators: JWTValidator[] = [
              new InternalJWTValidator(mockFastify as FastifyInstance),
            ];
            if (authType === 'external') {
              validators.push(
                new ExternalJWTValidator(testPublicKey, ['RS256'])
              );
            }

            // Create token
            let token: string;
            if (authType === 'internal') {
              token = jwt.sign(
                {
                  ...claims,
                  iss: 'airbolt-api',
                  userId: claims.userId || 'test-user',
                },
                testSecret,
                {
                  algorithm: 'HS256',
                }
              );
            } else {
              token = jwt.sign(claims, testPrivateKey, {
                algorithm: 'RS256',
              });
            }

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

            // Verify userId extraction
            expect(mockRequest.user).toBeDefined();
            expect(mockRequest.user.userId).toBeDefined();
            expect(typeof mockRequest.user.userId).toBe('string');

            // Verify correct priority and handle provider prefixes
            if (authType === 'external') {
              let expectedUserId =
                claims.sub ||
                claims.user_id ||
                claims.userId ||
                claims.email ||
                'anonymous';

              // Handle arrays by taking the first element (matching validator logic)
              if (Array.isArray(expectedUserId) && expectedUserId.length > 0) {
                expectedUserId = expectedUserId[0];
              }

              // Ensure we have a string
              if (typeof expectedUserId !== 'string') {
                expectedUserId = claims.email || 'anonymous';
              }

              // Clean provider prefixes for comparison (matching the validator logic)
              if (
                expectedUserId &&
                typeof expectedUserId === 'string' &&
                expectedUserId !== 'anonymous' &&
                expectedUserId.trim()
              ) {
                expectedUserId = expectedUserId.replace(
                  /^(auth0\||google-oauth2\||facebook\|)/,
                  ''
                );
              }

              // Handle empty string edge case
              if (
                !expectedUserId ||
                (typeof expectedUserId === 'string' &&
                  expectedUserId.trim() === '')
              ) {
                expectedUserId =
                  typeof claims.email === 'string' ? claims.email : 'anonymous';
              }

              expect(mockRequest.user.userId).toBe(expectedUserId);
            } else {
              // Internal auth
              expect(mockRequest.user.userId).toBeTruthy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple auth methods', () => {
    it('handles any combination of valid/invalid tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              valid: fc.boolean(),
              type: fc.constantFrom('internal', 'external', 'malformed'),
              issuer: fc.constantFrom(
                'airbolt-api',
                'https://clerk.com',
                'https://auth0.com',
                'invalid'
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async tokenConfigs => {
            // Create validators
            const validators = [
              new InternalJWTValidator(mockFastify as FastifyInstance),
              new ExternalJWTValidator(testPublicKey, ['RS256']),
            ];

            // Try each token configuration
            for (const config of tokenConfigs) {
              const token = createTestToken(
                config.type,
                config.issuer,
                config.valid
              );

              mockRequest.headers.authorization = `Bearer ${token}`;
              mockRequest.user = undefined;

              const middleware = createAuthMiddleware(
                mockFastify as FastifyInstance,
                validators
              );

              // Determine if token should be valid
              const shouldSucceed =
                config.type === 'malformed'
                  ? false
                  : config.type === 'internal'
                    ? config.issuer === 'airbolt-api'
                    : config.type === 'external'
                      ? config.valid
                      : false;

              if (shouldSucceed) {
                // Should succeed
                await middleware(
                  mockRequest as FastifyRequest,
                  mockReply as FastifyReply
                );
                expect(mockRequest.user).toBeDefined();
                expect(mockRequest.user.authMethod).toBe(
                  config.type === 'internal' && config.issuer === 'airbolt-api'
                    ? 'internal'
                    : 'external'
                );
              } else {
                // Should fail
                await expect(
                  middleware(
                    mockRequest as FastifyRequest,
                    mockReply as FastifyReply
                  )
                ).rejects.toThrow('Unauthorized: Invalid authorization token');
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Token expiration', () => {
    it('handles tokens with various expiration times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -3600, max: 3600 }), // -1 hour to +1 hour from now
          fc.constantFrom('internal', 'external'),
          async (expirationOffset, authType) => {
            const now = Math.floor(Date.now() / 1000);
            const exp = now + expirationOffset;

            const validators = [
              new InternalJWTValidator(mockFastify as FastifyInstance),
              new ExternalJWTValidator(testPublicKey, ['RS256']),
            ];

            let token: string;
            if (authType === 'internal') {
              token = jwt.sign({ userId: 'test-user', exp }, testSecret, {
                algorithm: 'HS256',
                issuer: 'airbolt-api',
                noTimestamp: true,
              });
            } else {
              token = jwt.sign({ sub: 'user123', exp }, testPrivateKey, {
                algorithm: 'RS256',
                issuer: 'https://clerk.com',
                noTimestamp: true,
              });
            }

            mockRequest.headers.authorization = `Bearer ${token}`;
            const middleware = createAuthMiddleware(
              mockFastify as FastifyInstance,
              validators
            );

            if (expirationOffset > 0) {
              // Token is still valid
              await middleware(
                mockRequest as FastifyRequest,
                mockReply as FastifyReply
              );
              expect(mockRequest.user).toBeDefined();
            } else {
              // Token is expired
              await expect(
                middleware(
                  mockRequest as FastifyRequest,
                  mockReply as FastifyReply
                )
              ).rejects.toThrow();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
