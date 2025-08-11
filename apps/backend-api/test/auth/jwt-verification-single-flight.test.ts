import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock dependencies
vi.mock('../../src/auth/jwks-cache.js', () => ({
  jwksCache: {
    getOrCreate: vi.fn(),
  },
}));

vi.mock('../../src/auth/issuer-validator.js', () => ({
  validateIssuerBeforeNetwork: vi.fn(),
}));

vi.mock('jose', async () => {
  const actual = await vi.importActual('jose');
  return {
    ...actual,
    jwtVerify: vi.fn(),
  };
});

// Import after mocking
import { verifyJWT } from '../../src/auth/jwt-verifier.js';
import { jwksCache } from '../../src/auth/jwks-cache.js';
import { jwtSingleFlight } from '../../src/auth/single-flight.js';
import { validateIssuerBeforeNetwork } from '../../src/auth/issuer-validator.js';
import { jwtVerify } from 'jose';

describe('JWT Verification Single-Flight Integration', () => {
  const mockGetKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    jwtSingleFlight.clear();

    // Setup default successful mocks
    vi.mocked(validateIssuerBeforeNetwork).mockImplementation(async () => {});
    vi.mocked(jwksCache.getOrCreate).mockReturnValue(mockGetKey);
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: 'test-user',
        iss: 'https://example.com',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        email: 'test@example.com',
      },
      protectedHeader: { alg: 'RS256', typ: 'JWT' },
      key: {} as any,
    });
  });

  afterEach(() => {
    jwtSingleFlight.clear();
  });

  describe('concurrent verification coalescing', () => {
    it('should coalesce multiple concurrent verifications of same token', async () => {
      const token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsImV4cCI6MTcwNzY3MjAwMH0.signature';

      // Start 10 concurrent verifications
      const promises = Array(10)
        .fill(0)
        .map(() => verifyJWT(token));

      const results = await Promise.all(promises);

      // All should get the same result
      for (const result of results) {
        expect(result).toMatchObject({
          sub: 'test-user',
          iss: 'https://example.com',
          email: 'test@example.com',
        });
      }

      // Verification should only happen once
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(jwksCache.getOrCreate).toHaveBeenCalledTimes(1);
      expect(validateIssuerBeforeNetwork).toHaveBeenCalledTimes(1);

      // No inflight operations after completion
      expect(jwtSingleFlight.stats().inFlightCount).toBe(0);
    });

    it('should not coalesce different tokens', async () => {
      const token1 =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0MSIsImlzcyI6Imh0dHBzOi8vZXhhbXBsZS5jb20ifQ.sig1';
      const token2 =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0MiIsImlzcyI6Imh0dHBzOi8vZXhhbXBsZS5jb20ifQ.sig2';

      // Mock different responses for different tokens
      vi.mocked(jwtVerify)
        .mockResolvedValueOnce({
          payload: {
            sub: 'user1',
            iss: 'https://example.com',
            exp: Date.now() / 1000 + 3600,
            iat: Date.now() / 1000,
          },
          protectedHeader: { alg: 'RS256', typ: 'JWT' },
          key: {} as any,
        })
        .mockResolvedValueOnce({
          payload: {
            sub: 'user2',
            iss: 'https://example.com',
            exp: Date.now() / 1000 + 3600,
            iat: Date.now() / 1000,
          },
          protectedHeader: { alg: 'RS256', typ: 'JWT' },
          key: {} as any,
        });

      const [result1, result2] = await Promise.all([
        verifyJWT(token1),
        verifyJWT(token2),
      ]);

      expect(result1.sub).toBe('user1');
      expect(result2.sub).toBe('user2');

      // Both tokens should be verified separately
      expect(jwtVerify).toHaveBeenCalledTimes(2);
    });

    it('should coalesce tokens with same external issuer', async () => {
      const token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9.signature';
      const externalIssuer = 'https://external.com';

      const promises = Array(5)
        .fill(0)
        .map(() => verifyJWT(token, externalIssuer));

      await Promise.all(promises);

      // Should only verify once
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(validateIssuerBeforeNetwork).toHaveBeenCalledTimes(1);
      expect(validateIssuerBeforeNetwork).toHaveBeenCalledWith(
        'https://example.com',
        externalIssuer,
        expect.any(Function) // constantTimeStringCompare function
      );
    });

    it('should not coalesce same token with different external issuers', async () => {
      const token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9.signature';

      await Promise.all([
        verifyJWT(token, 'https://issuer1.com'),
        verifyJWT(token, 'https://issuer2.com'),
        verifyJWT(token), // No external issuer
      ]);

      // Should verify three times (different keys due to different external issuers)
      expect(jwtVerify).toHaveBeenCalledTimes(3);
    });
  });

  describe('error propagation', () => {
    it('should propagate errors to all waiting callers', async () => {
      const token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9.signature';
      const error = new Error('Verification failed');

      vi.mocked(jwtVerify).mockRejectedValue(error);

      const promises = Array(5)
        .fill(0)
        .map(() => verifyJWT(token));

      const results = await Promise.allSettled(promises);

      // All should be rejected with the same error type
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toBe('Token verification failed');
        }
      }

      // Verification should only be attempted once
      expect(jwtVerify).toHaveBeenCalledTimes(1);

      // Should be cleaned up after error
      expect(jwtSingleFlight.stats().inFlightCount).toBe(0);
    });

    it('should handle issuer validation errors', async () => {
      const token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoiaHR0cHM6Ly9tYWxpY2lvdXMuY29tIn0.signature';

      vi.mocked(validateIssuerBeforeNetwork).mockImplementation(async () => {
        throw new Error('Untrusted issuer');
      });

      const promises = Array(3)
        .fill(0)
        .map(() => verifyJWT(token));

      const results = await Promise.allSettled(promises);

      // All should fail with issuer validation error
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('Untrusted issuer');
        }
      }

      // Should not reach jwtVerify
      expect(jwtVerify).not.toHaveBeenCalled();

      // Should be cleaned up
      expect(jwtSingleFlight.stats().inFlightCount).toBe(0);
    });
  });

  describe('property-based testing', () => {
    it('should maintain coalescing correctness under high concurrency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 50 }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 100 }),
          async (concurrency, uniqueTokens, delay) => {
            // Setup mock with delay
            vi.mocked(jwtVerify).mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, delay));
              return {
                payload: {
                  sub: 'test-user',
                  iss: 'https://example.com',
                  exp: Date.now() / 1000 + 3600,
                  iat: Date.now() / 1000,
                },
                protectedHeader: { alg: 'RS256', typ: 'JWT' },
                key: {} as any,
              };
            });

            // Generate unique tokens
            const tokens = Array(uniqueTokens)
              .fill(0)
              .map((_, i) => {
                const payload = Buffer.from(
                  JSON.stringify({
                    sub: `test${i}`,
                    iss: 'https://example.com',
                  })
                ).toString('base64url');
                return `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.sig${i}`;
              });

            // Create concurrent requests - some duplicate, some unique
            const requests = Array(concurrency)
              .fill(0)
              .map(() => {
                const tokenIndex = Math.floor(Math.random() * uniqueTokens);
                return verifyJWT(tokens[tokenIndex]!);
              });

            const results = await Promise.all(requests);

            // All should succeed
            expect(results).toHaveLength(concurrency);
            for (const result of results) {
              expect(result).toHaveProperty('sub', 'test-user');
              expect(result).toHaveProperty('iss', 'https://example.com');
            }

            // Verification calls should equal unique tokens (coalescing worked)
            expect(vi.mocked(jwtVerify).mock.calls.length).toBeLessThanOrEqual(
              uniqueTokens
            );

            // Should be cleaned up
            expect(jwtSingleFlight.stats().inFlightCount).toBe(0);

            // Reset for next iteration
            vi.clearAllMocks();
            jwtSingleFlight.clear();
          }
        ),
        { numRuns: 10 } // Reduced for performance
      );
    });
  });

  describe('memory management', () => {
    it('should not leak memory from completed operations', async () => {
      const baseStats = jwtSingleFlight.stats();

      // Perform many sequential operations
      for (let i = 0; i < 100; i++) {
        // Create valid JWT tokens with different sequence numbers in the payload
        const payload = Buffer.from(
          JSON.stringify({
            sub: 'test',
            iss: 'https://example.com',
            seq: i,
          })
        ).toString('base64url');
        const token = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.sig${i}`;
        await verifyJWT(token);
      }

      const finalStats = jwtSingleFlight.stats();

      // Should not have grown
      expect(finalStats.inFlightCount).toBe(baseStats.inFlightCount);
      expect(finalStats.keys).toHaveLength(baseStats.keys.length);
    });

    it('should handle rapid sequential verifications of same token', async () => {
      const token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9.signature';

      // Perform many sequential verifications
      for (let i = 0; i < 50; i++) {
        await verifyJWT(token);
      }

      // Should verify each time (no coalescing for sequential calls)
      expect(jwtVerify).toHaveBeenCalledTimes(50);

      // Should be cleaned up
      expect(jwtSingleFlight.stats().inFlightCount).toBe(0);
    });
  });
});
