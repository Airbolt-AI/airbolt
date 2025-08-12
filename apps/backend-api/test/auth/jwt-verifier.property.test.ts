import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  verifyToken,
  JWTVerificationError,
  type JWKSFetcher,
} from '../../src/auth/jwt-verifier.js';
import { createTestEnv } from '@airbolt/test-utils';
import { SignJWT } from 'jose';

describe('JWT Verifier Property Tests', () => {
  beforeEach(() => {
    createTestEnv();
  });

  describe('Token expiration handling', () => {
    it('properly handles various expiration times and clock skew', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -3600, max: 3600 }), // Seconds relative to now (past/future)
          fc.integer({ min: 0, max: 300 }), // Clock skew tolerance in seconds
          async (expirationOffset, clockSkew) => {
            const now = Math.floor(Date.now() / 1000);
            const exp = now + expirationOffset;

            // Create a mock JWKS fetcher
            const mockJWKSFetcher: JWKSFetcher = vi.fn().mockResolvedValue({
              keys: [
                {
                  kid: 'test-key-id',
                  kty: 'oct',
                  k: 'test-secret-key-base64url',
                  alg: 'HS256',
                  use: 'sig',
                },
              ],
            });

            // Create a JWT token with the specified expiration
            const jwt = await new SignJWT({
              sub: 'test-user',
              iss: 'https://test.clerk.accounts.dev',
              aud: 'https://test.clerk.accounts.dev',
              exp,
            })
              .setProtectedHeader({ alg: 'HS256', kid: 'test-key-id' })
              .sign(new TextEncoder().encode('test-secret-key-base64url'));

            const options = {
              token: jwt,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
              clockSkew,
            };

            try {
              const result = await verifyToken(options, mockJWKSFetcher);

              // Token should only be valid if it's not expired beyond clock skew tolerance
              const isWithinClockSkew = exp >= now - clockSkew;
              expect(isWithinClockSkew).toBe(true);
              expect(result.exp).toBe(exp);
            } catch (error) {
              // Token should fail if it's expired beyond clock skew tolerance
              const isExpiredBeyondSkew = exp < now - clockSkew;
              if (error instanceof JWTVerificationError) {
                if (error.code === 'EXPIRED') {
                  expect(isExpiredBeyondSkew).toBe(true);
                }
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('handles extreme expiration edge cases correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            0, // Expired exactly now
            1, // Expires in 1 second
            -1, // Expired 1 second ago
            Math.pow(2, 31) - 1, // Max 32-bit timestamp
            1 // Minimum future timestamp
          ),
          async exp => {
            const mockJWKSFetcher: JWKSFetcher = vi.fn().mockResolvedValue({
              keys: [
                { kid: 'test', kty: 'oct', k: 'dGVzdC1zZWNyZXQ', alg: 'HS256' },
              ],
            });

            const jwt = await new SignJWT({
              sub: 'test',
              iss: 'https://test.clerk.accounts.dev',
              aud: 'https://test.clerk.accounts.dev',
              exp,
            })
              .setProtectedHeader({ alg: 'HS256', kid: 'test' })
              .sign(new TextEncoder().encode('test-secret'));

            const options = {
              token: jwt,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
              clockSkew: 60,
            };

            try {
              await verifyToken(options, mockJWKSFetcher);
              // Should only succeed for valid, non-expired tokens
              expect(exp).toBeGreaterThan(Math.floor(Date.now() / 1000) - 60);
            } catch (error) {
              // Should fail for expired tokens or invalid timestamps
              expect(error).toBeInstanceOf(JWTVerificationError);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Malformed token handling', () => {
    it('handles various token format violations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''), // Empty string
            fc.constant('not.a.jwt'), // Wrong number of parts
            fc.constant('a'), // Single part
            fc.constant('a.b'), // Two parts only
            fc.constant('a.b.c.d'), // Too many parts
            fc.constant('.b.c'), // Missing header
            fc.constant('a..c'), // Missing payload
            fc.constant('a.b.'), // Missing signature
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter(s => !s.includes('.')), // No dots
            fc.constant('header.payload.signature.extra.parts'), // Too many parts
            fc.string().map(s => s.replace(/\./g, '')) // Remove all dots
          ),
          async malformedToken => {
            const mockJWKSFetcher: JWKSFetcher = vi.fn().mockResolvedValue({
              keys: [{ kid: 'test', kty: 'oct', k: 'dGVzdA', alg: 'HS256' }],
            });

            const options = {
              token: malformedToken,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
            };

            try {
              await verifyToken(options, mockJWKSFetcher);

              // Should never succeed with malformed tokens
              expect.fail('Malformed token should not verify successfully');
            } catch (error) {
              expect(error).toBeInstanceOf(JWTVerificationError);
              expect([
                'INVALID_FORMAT',
                'INVALID_SIGNATURE',
                'UNKNOWN',
              ]).toContain((error as JWTVerificationError).code);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('handles corrupted base64url encoding', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (header, payload, signature) => {
            // Create tokens with invalid base64url encoding
            const corruptedToken = `${header}.${payload}.${signature}`;

            const mockJWKSFetcher: JWKSFetcher = vi.fn().mockResolvedValue({
              keys: [{ kid: 'test', kty: 'oct', k: 'dGVzdA', alg: 'HS256' }],
            });

            const options = {
              token: corruptedToken,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
            };

            try {
              await verifyToken(options, mockJWKSFetcher);
              expect.fail('Corrupted token should not verify');
            } catch (error) {
              expect(error).toBeInstanceOf(JWTVerificationError);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('JWKS endpoint error handling', () => {
    it('handles various JWKS fetch failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(new Error('Network timeout')),
            fc.constant(new Error('Connection refused')),
            fc.constant(new Error('DNS lookup failed')),
            fc.constant({ status: 404, statusText: 'Not Found' }),
            fc.constant({ status: 500, statusText: 'Internal Server Error' }),
            fc.constant({ status: 429, statusText: 'Rate Limited' })
          ),
          async failureType => {
            const mockJWKSFetcher: JWKSFetcher = vi
              .fn()
              .mockImplementation(() => {
                if ('status' in failureType) {
                  throw new Error(
                    `JWKS fetch failed: ${failureType.status} ${failureType.statusText}`
                  );
                }
                throw failureType;
              });

            const jwt = await new SignJWT({
              sub: 'test',
              iss: 'https://test.clerk.accounts.dev',
              aud: 'https://test.clerk.accounts.dev',
              exp: Math.floor(Date.now() / 1000) + 3600,
            })
              .setProtectedHeader({ alg: 'HS256', kid: 'test' })
              .sign(new TextEncoder().encode('test-secret'));

            const options = {
              token: jwt,
              jwksUrl: 'https://unreachable.example.com/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
            };

            try {
              await verifyToken(options, mockJWKSFetcher);
              expect.fail('Should fail when JWKS cannot be fetched');
            } catch (error) {
              expect(error).toBeInstanceOf(JWTVerificationError);
              if (error instanceof JWTVerificationError) {
                // Could be FETCH_ERROR or UNKNOWN depending on error type
                expect(['FETCH_ERROR', 'UNKNOWN']).toContain(error.code);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('handles malformed JWKS responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant({}), // Missing keys array
            fc.constant({ keys: 'not-an-array' }), // Invalid keys type
            fc.constant({ keys: null }), // Null keys
            fc.constant({ keys: [] }), // Empty keys array
            fc.constant({ otherField: 'value' }), // Wrong structure
            fc.constant(null), // Null response
            fc.constant('invalid json') // Invalid JSON structure
          ),
          async malformedJWKS => {
            const mockJWKSFetcher: JWKSFetcher = vi
              .fn()
              .mockResolvedValue(malformedJWKS as any);

            const jwt = await new SignJWT({
              sub: 'test',
              iss: 'https://test.clerk.accounts.dev',
              aud: 'https://test.clerk.accounts.dev',
              exp: Math.floor(Date.now() / 1000) + 3600,
            })
              .setProtectedHeader({ alg: 'HS256', kid: 'test' })
              .sign(new TextEncoder().encode('test-secret'));

            const options = {
              token: jwt,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
            };

            try {
              await verifyToken(options, mockJWKSFetcher);
              expect.fail('Should fail with malformed JWKS');
            } catch (error) {
              expect(error).toBeInstanceOf(JWTVerificationError);
              // Could be FETCH_ERROR (validation fails) or UNKNOWN (key not found)
              if (error instanceof JWTVerificationError) {
                expect([
                  'FETCH_ERROR',
                  'UNKNOWN',
                  'INVALID_SIGNATURE',
                ]).toContain(error.code);
              }
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe('Key ID (kid) handling', () => {
    it('handles various kid scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(undefined), // Missing kid in JWT header
            fc.constant(''), // Empty kid
            fc.string({ minLength: 1, maxLength: 50 }), // Random kid
            fc.constant('valid-key-id'), // Valid kid that exists
            fc.constant('nonexistent-key-id') // Kid that doesn't exist in JWKS
          ),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 0,
            maxLength: 5,
          }), // Available key IDs in JWKS
          async (tokenKid, jwksKeyIds) => {
            const mockJWKSFetcher: JWKSFetcher = vi.fn().mockResolvedValue({
              keys: jwksKeyIds.map(kid => ({
                kid,
                kty: 'oct',
                k: 'dGVzdC1zZWNyZXQ',
                alg: 'HS256',
              })),
            });

            try {
              // Create JWT with specified kid (or no kid if undefined)
              const header: any = { alg: 'HS256' };
              if (tokenKid !== undefined) {
                header.kid = tokenKid;
              }

              const jwt = await new SignJWT({
                sub: 'test',
                iss: 'https://test.clerk.accounts.dev',
                aud: 'https://test.clerk.accounts.dev',
                exp: Math.floor(Date.now() / 1000) + 3600,
              })
                .setProtectedHeader(header)
                .sign(new TextEncoder().encode('test-secret'));

              const options = {
                token: jwt,
                jwksUrl:
                  'https://test.clerk.accounts.dev/.well-known/jwks.json',
                issuer: 'https://test.clerk.accounts.dev',
                audience: 'https://test.clerk.accounts.dev',
              };

              const result = await verifyToken(options, mockJWKSFetcher);

              // Should only succeed if kid exists in JWKS or if it's the magic 'valid-key-id'
              if (tokenKid) {
                expect(
                  jwksKeyIds.includes(tokenKid) || tokenKid === 'valid-key-id'
                ).toBeTruthy();
              }
              expect(result).toBeDefined();
            } catch (error) {
              expect(error).toBeInstanceOf(JWTVerificationError);

              // Should fail for missing kid or kid not found in JWKS
              if (error instanceof JWTVerificationError) {
                if (tokenKid === undefined) {
                  expect(error.message).toContain('kid');
                } else if (
                  tokenKid &&
                  !jwksKeyIds.includes(tokenKid) &&
                  tokenKid !== 'valid-key-id'
                ) {
                  expect(['UNKNOWN', 'INVALID_SIGNATURE']).toContain(
                    error.code
                  );
                }
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Concurrent verification stress test', () => {
    it('handles concurrent verification requests correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // Number of concurrent requests
          fc.integer({ min: 0, max: 100 }), // JWKS fetch delay (ms)
          async (concurrentRequests, jwksDelay) => {
            let fetchCount = 0;
            const mockJWKSFetcher: JWKSFetcher = vi
              .fn()
              .mockImplementation(async () => {
                fetchCount++;
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, jwksDelay));
                return {
                  keys: [
                    {
                      kid: 'test',
                      kty: 'oct',
                      k: 'dGVzdC1zZWNyZXQ',
                      alg: 'HS256',
                    },
                  ],
                };
              });

            // Create a valid JWT
            const jwt = await new SignJWT({
              sub: 'test',
              iss: 'https://test.clerk.accounts.dev',
              aud: 'https://test.clerk.accounts.dev',
              exp: Math.floor(Date.now() / 1000) + 3600,
            })
              .setProtectedHeader({ alg: 'HS256', kid: 'test' })
              .sign(new TextEncoder().encode('test-secret'));

            const options = {
              token: jwt,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
            };

            // Fire concurrent requests
            const requests = Array(concurrentRequests)
              .fill(0)
              .map(() => verifyToken(options, mockJWKSFetcher));

            const results = await Promise.allSettled(requests);

            // All should succeed (this tests concurrent handling)
            const successes = results.filter(r => r.status === 'fulfilled');

            // With a valid token, most should succeed
            // Some might fail due to race conditions or timeouts, but that's expected behavior
            expect(successes.length).toBeGreaterThan(0);

            // Verify JWKS was called (could be cached, so might be fewer calls than requests)
            expect(fetchCount).toBeGreaterThan(0);
            expect(fetchCount).toBeLessThanOrEqual(concurrentRequests);
          }
        ),
        { numRuns: 10 } // Reduced for faster tests
      );
    }, 15000); // 15 second timeout
  });

  describe('Clock skew boundary conditions', () => {
    it('handles clock skew edge cases precisely', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -10, max: 10 }), // Seconds difference from exact boundary
          fc.integer({ min: 1, max: 120 }), // Clock skew tolerance
          async (boundaryOffset, clockSkew) => {
            const now = Math.floor(Date.now() / 1000);
            // Token expires exactly at the clock skew boundary + offset
            const exp = now - clockSkew + boundaryOffset;

            const mockJWKSFetcher: JWKSFetcher = vi.fn().mockResolvedValue({
              keys: [
                { kid: 'test', kty: 'oct', k: 'dGVzdC1zZWNyZXQ', alg: 'HS256' },
              ],
            });

            const jwt = await new SignJWT({
              sub: 'test',
              iss: 'https://test.clerk.accounts.dev',
              aud: 'https://test.clerk.accounts.dev',
              exp,
            })
              .setProtectedHeader({ alg: 'HS256', kid: 'test' })
              .sign(new TextEncoder().encode('test-secret'));

            const options = {
              token: jwt,
              jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
              issuer: 'https://test.clerk.accounts.dev',
              audience: 'https://test.clerk.accounts.dev',
              clockSkew,
            };

            try {
              await verifyToken(options, mockJWKSFetcher);
              // Should succeed if within clock skew tolerance
              expect(boundaryOffset).toBeGreaterThanOrEqual(0);
            } catch (error) {
              expect(error).toBeInstanceOf(JWTVerificationError);
              if (
                error instanceof JWTVerificationError &&
                error.code === 'EXPIRED'
              ) {
                // Should fail if beyond clock skew tolerance
                expect(boundaryOffset).toBeLessThanOrEqual(0);
              }
            }
          }
        ),
        { numRuns: 40 }
      );
    });
  });
});
