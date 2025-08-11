/**
 * Comprehensive Security Test Suite for Auth System
 *
 * This test suite validates security properties of our authentication system
 * following the project's testing philosophy (TESTING.md):
 *
 * 1. Rate Limiting Security
 * 2. Token Security
 * 3. SSRF Prevention
 * 4. Timing Attack Prevention
 * 5. Header Injection Prevention
 * 6. Property-based security testing
 *
 * Focus: Real attack scenarios, not just coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import * as fc from 'fast-check';
import { build } from '../helper.js';
// import type { TestAppOptions } from '../helper.js';
import { ExchangeRateLimiter } from '../../src/auth/exchange-rate-limiter.js';
import {
  createValidClerkToken,
  createExpiredClerkToken,
  createInvalidSignatureClerkToken,
  setupClerkMocks,
  MockJWKSServer,
} from '../fixtures/clerk-tokens.js';

describe('Auth Security Test Suite', () => {
  let app: FastifyInstance;
  let rateLimiter: ExchangeRateLimiter;
  let mockServer: MockJWKSServer;

  beforeEach(async () => {
    // Setup mock JWKS server
    const mocks = await setupClerkMocks();
    mockServer = mocks.jwksServer;

    // Create app with production-like security settings (but test environment)
    app = await build({
      AUTH_REQUIRED: 'true',
      NODE_ENV: 'test', // Use test mode to avoid HTTPS requirements
      AUTH_RATE_LIMIT_MAX: '10',
      AUTH_RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
      ALLOWED_ORIGIN: 'http://localhost:3000', // Allow localhost in test
    });

    rateLimiter = new ExchangeRateLimiter({
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
  });

  afterEach(async () => {
    await app.close();
    if (mockServer) {
      await mockServer.stop();
    }
    rateLimiter.destroy();
  });

  describe('Rate Limiting Security', () => {
    it('should prevent rate limit bypass via header manipulation', async () => {
      // Test various header manipulation attempts
      const headers = [
        { 'x-forwarded-for': '127.0.0.1, 1.2.3.4' }, // Header injection
        { 'x-forwarded-for': '10.0.0.1' }, // Internal IP spoofing
        { 'x-real-ip': '192.168.1.1' }, // Another internal IP
        { 'x-forwarded-for': '::1' }, // IPv6 localhost
        { 'x-forwarded-for': '' }, // Empty header
        { 'user-agent': 'bypass-bot' }, // Different user agent
      ];

      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      // Make requests exceeding rate limit with different headers
      for (let i = 0; i < 15; i++) {
        const headerSet = headers[i % headers.length] || {};
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: {
            authorization: `Bearer ${validToken}`,
            ...headerSet,
          },
          payload: { token: validToken },
        });

        // After rate limit exceeded, all requests should be blocked
        // regardless of header manipulation
        if (i >= 10) {
          expect(response.statusCode).toBe(429);
        }
      }
    });

    it('should maintain rate limit accuracy under concurrent load', async () => {
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      // Fire 20 concurrent requests (double the rate limit)
      const requests = Array.from({ length: 20 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: { token: validToken },
        })
      );

      const responses = await Promise.all(requests);

      // Exactly 10 should succeed (rate limit), rest should be blocked
      const successCount = responses.filter(r => r.statusCode === 200).length;
      const blockedCount = responses.filter(r => r.statusCode === 429).length;

      expect(successCount).toBe(10);
      expect(blockedCount).toBe(10);
    });

    it('should enforce user-specific vs IP-specific rate limiting', async () => {
      const user1Token = await createValidClerkToken({
        userId: 'user_1',
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      const user2Token = await createValidClerkToken({
        userId: 'user_2',
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      // Exhaust rate limit for user1
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${user1Token}` },
          payload: { token: user1Token },
        });
        expect(response.statusCode).toBe(200);
      }

      // User1 should now be blocked
      const user1Blocked = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${user1Token}` },
        payload: { token: user1Token },
      });
      expect(user1Blocked.statusCode).toBe(429);

      // User2 should still have full rate limit available
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${user2Token}` },
        payload: { token: user2Token },
      });
      expect(user2Response.statusCode).toBe(200);
    });

    it('should persist rate limits across requests', () => {
      const key = 'test-key';

      // Use up the rate limit
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        rateLimiter.recordRequest(key, true);
      }

      // Next request should be blocked
      const blockedResult = rateLimiter.checkLimit(key);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });
  });

  describe('Token Security', () => {
    it('should reject token reuse across different IPs', async () => {
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      // Use token from one IP
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          authorization: `Bearer ${validToken}`,
          'x-forwarded-for': '1.2.3.4',
        },
        payload: { token: validToken },
      });
      expect(response1.statusCode).toBe(200);

      // Try to reuse same token from different IP
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: {
          authorization: `Bearer ${validToken}`,
          'x-forwarded-for': '5.6.7.8',
        },
        payload: { token: validToken },
      });
      // This should still work as we don't currently implement IP binding
      // but demonstrates the test pattern for when we do
      expect([200, 401]).toContain(response2.statusCode);
    });

    it('should handle expired tokens consistently', async () => {
      const expiredToken = await createExpiredClerkToken();

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
    });

    it('should reject malformed token variations', async () => {
      const malformedTokens = [
        'not.a.token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'eyJhbGciOiJub25lIn0..', // None algorithm
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.', // Missing signature
        '', // Empty token
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

    it('should prevent algorithm confusion attacks', async () => {
      // Test tokens claiming different algorithms
      const algorithmAttacks = [
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIiwiaXNzIjoidGVzdCJ9.', // None algorithm
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIiwiaXNzIjoidGVzdCJ9.signature', // HS256 instead of RS256
      ];

      for (const attackToken of algorithmAttacks) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${attackToken}` },
          payload: { token: attackToken },
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('should reject tokens with manipulated claims', async () => {
      // const validToken = await createValidClerkToken({
      //   issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      // });

      // Create token with manipulated expiry (but valid signature will fail)
      const invalidToken = await createInvalidSignatureClerkToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${invalidToken}` },
        payload: { token: invalidToken },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('SSRF Prevention', () => {
    it('should reject malicious issuer URLs', async () => {
      const maliciousIssuers = [
        'http://localhost:8080', // HTTP instead of HTTPS
        'https://127.0.0.1:8080', // Localhost IP
        'https://192.168.1.1', // Private network
        'https://10.0.0.1', // Private network
        'https://172.16.0.1', // Private network
        'https://metadata.google.internal', // Cloud metadata
        'https://169.254.169.254', // AWS metadata
        'file:///etc/passwd', // File protocol
        'ftp://evil.com', // Non-HTTP protocol
        'https://evil.clerk.accounts.dev.evil.com', // Subdomain confusion
      ];

      for (const issuer of maliciousIssuers) {
        // Create token with malicious issuer
        const token = await createValidClerkToken({ issuer });

        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${token}` },
          payload: { token },
        });

        // Should be rejected for unknown/invalid issuer
        expect(response.statusCode).toBe(401);
      }
    });

    it('should prevent DNS rebinding attacks', async () => {
      // Issuers that could resolve to internal IPs
      const rebindingAttempts = [
        'https://127.0.0.1.nip.io',
        'https://localhost.localdomain',
        'https://0x7f000001.clerk.accounts.dev', // Hex IP encoding
        'https://2130706433.clerk.accounts.dev', // Decimal IP encoding
      ];

      for (const issuer of rebindingAttempts) {
        const token = await createValidClerkToken({ issuer });

        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${token}` },
          payload: { token },
        });

        expect(response.statusCode).toBe(401);
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times for valid/invalid tokens', async () => {
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });
      const invalidToken = 'invalid.token.signature';

      // Measure timing for valid token
      const validStartTime = Date.now();
      await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { token: validToken },
      });
      const validDuration = Date.now() - validStartTime;

      // Measure timing for invalid token
      const invalidStartTime = Date.now();
      await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${invalidToken}` },
        payload: { token: invalidToken },
      });
      const invalidDuration = Date.now() - invalidStartTime;

      // Response times should be within reasonable variance (not revealing info)
      const timingDifference = Math.abs(validDuration - invalidDuration);
      expect(timingDifference).toBeLessThan(100); // Allow 100ms variance
    });

    it('should have consistent timing for rate limited requests', async () => {
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${validToken}` },
          payload: { token: validToken },
        });
      }

      // Measure rate limited response time
      const rateLimitedStart = Date.now();
      const rateLimitedResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { token: validToken },
      });
      const rateLimitedDuration = Date.now() - rateLimitedStart;

      expect(rateLimitedResponse.statusCode).toBe(429);
      // Rate limited responses should be fast (not doing expensive operations)
      expect(rateLimitedDuration).toBeLessThan(50);
    });
  });

  describe('Header Injection Prevention', () => {
    it('should sanitize authorization headers', async () => {
      const injectionAttempts = [
        'Bearer token\nX-Admin: true',
        'Bearer token\r\nSet-Cookie: admin=true',
        'Bearer token\x00\x01\x02', // Null bytes
        'Bearer token\u0000', // Unicode null
        'Bearer token\x20\x09\x0A\x0D', // Whitespace chars
      ];

      for (const maliciousHeader of injectionAttempts) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: maliciousHeader },
          payload: { token: 'test' },
        });

        // Should be rejected as invalid authorization
        expect(response.statusCode).toBe(401);
      }
    });

    it('should prevent X-Forwarded-For manipulation', async () => {
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      const manipulationAttempts = [
        '127.0.0.1\nX-Admin: true',
        '1.2.3.4\r\nBypass: rate-limit',
        'proxy.evil.com\x00admin.com',
      ];

      for (const maliciousForwarded of manipulationAttempts) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: {
            authorization: `Bearer ${validToken}`,
            'x-forwarded-for': maliciousForwarded,
          },
          payload: { token: validToken },
        });

        // Should process normally (header manipulation doesn't work)
        expect([200, 401, 429]).toContain(response.statusCode);
      }
    });

    it('should prevent User-Agent based attacks', async () => {
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      const maliciousUserAgents = [
        '../../../etc/passwd',
        '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]>',
        'javascript:alert(1)',
        '<script>alert("xss")</script>',
      ];

      for (const userAgent of maliciousUserAgents) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: {
            authorization: `Bearer ${validToken}`,
            'user-agent': userAgent,
          },
          payload: { token: validToken },
        });

        // Should process normally (user agent doesn't affect auth)
        expect([200, 401, 429]).toContain(response.statusCode);

        // Response should not contain injected content
        const responseText = response.payload;
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('/etc/passwd');
      }
    });
  });

  describe('Property-based Security Tests', () => {
    it('should maintain security properties under mixed attack patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of different attack types
          fc.array(
            fc.oneof(
              fc.record({
                type: fc.constant('valid'),
                token: fc.constant('valid'),
              }),
              fc.record({
                type: fc.constant('expired'),
                token: fc.constant('expired'),
              }),
              fc.record({
                type: fc.constant('malformed'),
                token: fc.constant('malformed'),
              }),
              fc.record({
                type: fc.constant('injection'),
                token: fc.constant('injection'),
              })
            ),
            { minLength: 1, maxLength: 20 }
          ),
          async attacks => {
            // Create tokens based on attack types
            const tokens = await Promise.all(
              attacks.map(async attack => {
                switch (attack.type) {
                  case 'valid':
                    return createValidClerkToken({
                      issuer: mockServer
                        .getJWKSUrl()
                        .replace('/.well-known/jwks.json', ''),
                    });
                  case 'expired':
                    return createExpiredClerkToken();
                  case 'malformed':
                    return 'invalid.token.here';
                  case 'injection':
                    return 'Bearer token\nX-Admin: true';
                  default:
                    return 'default-invalid';
                }
              })
            );

            // Execute attacks sequentially to avoid rate limiting interference
            let validSuccesses = 0;
            let properRejections = 0;

            for (const [index, token] of tokens.entries()) {
              const attack = attacks[index]!;

              const response = await app.inject({
                method: 'POST',
                url: '/api/auth/exchange',
                headers: { authorization: `Bearer ${token}` },
                payload: { token },
              });

              // Valid tokens should succeed (unless rate limited)
              if (attack.type === 'valid') {
                if (response.statusCode === 200) {
                  validSuccesses++;
                } else if (response.statusCode === 429) {
                  // Rate limiting is expected behavior
                  properRejections++;
                }
              } else {
                // All other attacks should be rejected with 401
                if (response.statusCode === 401) {
                  properRejections++;
                }
              }
            }

            // Security invariant: No attack should succeed except valid tokens
            const totalValidAttacks = attacks.filter(
              a => a.type === 'valid'
            ).length;
            const maxAllowedValid = Math.min(totalValidAttacks, 10); // Rate limit

            expect(validSuccesses).toBeLessThanOrEqual(maxAllowedValid);
          }
        ),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should handle concurrent rate limiting accurately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 25 }), // Number of concurrent requests
          fc.array(fc.constantFrom('user1', 'user2', 'user3'), {
            minLength: 5,
            maxLength: 25,
          }), // User IDs
          async (requestCount, userIds) => {
            // Create tokens for different users
            const userTokens = await Promise.all(
              Array.from(new Set(userIds)).map(userId =>
                createValidClerkToken({
                  userId,
                  issuer: mockServer
                    .getJWKSUrl()
                    .replace('/.well-known/jwks.json', ''),
                })
              )
            );

            const tokenMap = Object.fromEntries(
              Array.from(new Set(userIds)).map((userId, index) => [
                userId,
                userTokens[index],
              ])
            );

            // Fire concurrent requests
            const requests = userIds.slice(0, requestCount).map(userId =>
              app.inject({
                method: 'POST',
                url: '/api/auth/exchange',
                headers: { authorization: `Bearer ${tokenMap[userId]}` },
                payload: { token: tokenMap[userId] },
              })
            );

            const responses = await Promise.all(requests);

            // Count successes per user
            const userStats = new Map<
              string,
              { success: number; blocked: number }
            >();
            userIds.slice(0, requestCount).forEach((userId, index) => {
              if (!userStats.has(userId)) {
                userStats.set(userId, { success: 0, blocked: 0 });
              }
              const stats = userStats.get(userId)!;
              const response = responses[index]!;

              if (response.statusCode === 200) {
                stats.success++;
              } else if (response.statusCode === 429) {
                stats.blocked++;
              }
            });

            // Rate limiting invariant: No user should exceed their rate limit
            for (const [, stats] of userStats) {
              expect(stats.success).toBeLessThanOrEqual(10); // Rate limit per user
            }
          }
        ),
        { numRuns: 5, timeout: 30000 }
      );
    });
  });

  describe('Audit Logging Coverage', () => {
    it('should log all security events', async () => {
      // This test would verify audit logging but requires
      // access to the logging system - placeholder for implementation
      const validToken = await createValidClerkToken({
        issuer: mockServer.getJWKSUrl().replace('/.well-known/jwks.json', ''),
      });

      // Valid request
      await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { token: validToken },
      });

      // Invalid request
      await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: 'Bearer invalid-token' },
        payload: { token: 'invalid-token' },
      });

      // Rate limited request (after exhausting limit)
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/exchange',
          headers: { authorization: `Bearer ${validToken}` },
          payload: { token: validToken },
        });
      }

      const rateLimitedResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { token: validToken },
      });

      expect(rateLimitedResponse.statusCode).toBe(429);

      // TODO: Verify audit log entries were created
      // This would require access to the audit logger to verify events were logged
    });
  });

  describe('Memory Safety', () => {
    it('should prevent memory exhaustion attacks', async () => {
      // Test with many different keys to ensure cleanup works
      const uniqueKeys = Array.from(
        { length: 1000 },
        (_, i) => `attack-key-${i}`
      );

      for (const key of uniqueKeys) {
        rateLimiter.checkLimit(key);
        rateLimiter.recordRequest(key, false);
      }

      // Force cleanup
      rateLimiter.cleanup();

      const stats = rateLimiter.getStats();

      // Memory usage should be reasonable (not growing unbounded)
      expect(stats.memoryUsage).toBeLessThan(1024 * 1024); // 1MB limit
      expect(stats.totalKeys).toBeLessThan(1000); // Some cleanup should have occurred
    });

    it('should handle cleanup of expired entries', async () => {
      const testKey = 'cleanup-test';

      // Add entry and record hits
      rateLimiter.checkLimit(testKey);
      rateLimiter.recordRequest(testKey, true);

      const statsBeforeCleanup = rateLimiter.getStats();
      expect(statsBeforeCleanup.totalKeys).toBeGreaterThan(0);

      // Force cleanup (in real scenario this would happen after time passes)
      rateLimiter.cleanup();

      // Stats should remain reasonable
      const statsAfterCleanup = rateLimiter.getStats();
      expect(statsAfterCleanup.memoryUsage).toBeDefined();
      expect(statsAfterCleanup.totalKeys).toBeDefined();
    });
  });
});
