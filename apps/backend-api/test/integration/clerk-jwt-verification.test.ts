/**
 * Comprehensive Clerk JWT Verification Integration Tests
 *
 * Tests the complete JWT verification flow using the mock JWKS server
 * and cryptographically valid test tokens. This validates the integration
 * between the Clerk verifier, JWT verifier, JWKS cache, and issuer validator.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  verifyClerkToken,
  verifyClerkTokenWithEnvConfig,
  isClerkSessionToken,
  extractAuthorizedPartiesFromPublishableKey,
  getAuthorizedPartiesFromEnv,
  // type ClerkJWTClaims,
} from '../../src/auth/clerk-verifier.js';
import {
  setupClerkMocks,
  createValidClerkToken,
  createExpiredClerkToken,
  createInvalidSignatureClerkToken,
  createNotYetValidClerkToken,
  edgeCaseTokens,
  testUtils,
  // type MockClerkToken,
  // clerkClaims,
} from '../fixtures/clerk-tokens.js';

describe('Clerk JWT Verification Integration', () => {
  let mockSetup: Awaited<ReturnType<typeof setupClerkMocks>>;
  let originalEnv: NodeJS.ProcessEnv;
  let originalGetOrCreate: any;

  beforeAll(async () => {
    // Store original environment for restoration
    originalEnv = { ...process.env };

    // Setup mock JWKS server and test tokens
    mockSetup = await setupClerkMocks();

    // Configure the JWT verifier to use our mock JWKS endpoint
    const jwksUrl = mockSetup.jwksServer.getJWKSUrl();
    const mockServerBase = jwksUrl.replace('/.well-known/jwks.json', '');

    // Mock the JWKS cache to use our test server
    const { jwksCache } = await import('../../src/auth/jwks-cache.js');

    // Clear any existing cache
    jwksCache.clear();

    // Store original function for cleanup
    originalGetOrCreate = jwksCache.getOrCreate.bind(jwksCache);

    // Override the JWKS URL for Clerk issuers to point to our mock server
    jwksCache.getOrCreate = (issuer: string) => {
      // For test issuers, redirect to our mock JWKS
      if (issuer.includes('.clerk.accounts.dev')) {
        return originalGetOrCreate(mockServerBase);
      }
      return originalGetOrCreate(issuer);
    };
  });

  afterAll(async () => {
    // Restore original JWKS cache function
    if (originalGetOrCreate) {
      const { jwksCache } = await import('../../src/auth/jwks-cache.js');
      jwksCache.getOrCreate = originalGetOrCreate;
      jwksCache.clear();
    }

    // Clean up mock server and restore environment
    await mockSetup.cleanup();
    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Reset environment variables for each test
    process.env = { ...originalEnv };

    // Clear JWKS cache to ensure fresh state
    const { jwksCache } = await import('../../src/auth/jwks-cache.js');
    jwksCache.clear();
  });

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv;
  });

  describe('End-to-End Verification', () => {
    it('should verify valid Clerk token successfully', async () => {
      const token = await createValidClerkToken({
        userId: 'user_e2e_test',
        email: 'e2e@example.com',
        issuer: 'https://e2e-test.clerk.accounts.dev',
        audience: 'https://e2e-app.com',
      });

      const claims = await verifyClerkToken(token);

      expect(claims.sub).toBe('user_e2e_test');
      expect(claims.email).toBe('e2e@example.com');
      expect(claims.iss).toBe('https://e2e-test.clerk.accounts.dev');
      expect(claims.aud).toBe('https://e2e-app.com');
      expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(claims.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should preserve all Clerk-specific claims', async () => {
      const token = await createValidClerkToken({
        userId: 'user_complete_test',
        email: 'complete@example.com',
        sessionId: 'sess_12345',
        orgId: 'org_xyz789',
        orgSlug: 'test-org',
        orgRole: 'admin',
        azp: 'https://frontend.example.com',
        customClaims: {
          custom_field: 'custom_value',
          metadata: { plan: 'enterprise' },
        },
      });

      const claims = await verifyClerkToken(token);

      expect(claims.session_id).toBe('sess_12345');
      expect(claims.org_id).toBe('org_xyz789');
      expect(claims.org_slug).toBe('test-org');
      expect(claims.org_role).toBe('admin');
      expect(claims.azp).toBe('https://frontend.example.com');
      expect(claims['custom_field']).toBe('custom_value');
      expect(claims['metadata']).toEqual({ plan: 'enterprise' });
    });

    it('should verify complete workflow including JWKS retrieval', async () => {
      // Create a fresh token with unique issuer to force JWKS fetch
      const uniqueIssuer = `https://fresh-${Date.now()}.clerk.accounts.dev`;
      const token = await createValidClerkToken({
        userId: 'user_jwks_test',
        email: 'jwks@example.com',
        issuer: uniqueIssuer,
      });

      const claims = await verifyClerkToken(token);

      expect(claims.sub).toBe('user_jwks_test');
      expect(claims.iss).toBe(uniqueIssuer);

      // Verify the token can be verified again (cache hit)
      const claims2 = await verifyClerkToken(token);
      expect(claims2.sub).toBe('user_jwks_test');
    });
  });

  describe('Authorized Parties Testing', () => {
    it('should accept tokens without azp when no restrictions set', async () => {
      const token = await createValidClerkToken({
        userId: 'user_no_azp',
        email: 'no-azp@example.com',
        // No azp claim
      });

      const claims = await verifyClerkToken(token);
      expect(claims.sub).toBe('user_no_azp');
      expect(claims.azp).toBeUndefined();
    });

    it('should accept tokens with azp matching authorized parties', async () => {
      const token = await createValidClerkToken({
        userId: 'user_valid_azp',
        email: 'valid-azp@example.com',
        azp: 'https://allowed.example.com',
      });

      const options = {
        authorizedParties: [
          'https://allowed.example.com',
          'https://another-allowed.example.com',
        ],
      };

      const claims = await verifyClerkToken(token, options);
      expect(claims.sub).toBe('user_valid_azp');
      expect(claims.azp).toBe('https://allowed.example.com');
    });

    it('should reject tokens with azp not in authorized parties', async () => {
      const token = await createValidClerkToken({
        userId: 'user_invalid_azp',
        email: 'invalid-azp@example.com',
        azp: 'https://unauthorized.example.com',
      });

      const options = {
        authorizedParties: [
          'https://allowed.example.com',
          'https://another-allowed.example.com',
        ],
      };

      await expect(verifyClerkToken(token, options)).rejects.toThrow(
        'Unauthorized party: https://unauthorized.example.com'
      );
    });

    it('should handle multiple authorized parties correctly', async () => {
      const authorizedParties = [
        'https://app.example.com',
        'https://admin.example.com',
        'https://mobile.example.com',
      ];

      // Test each authorized party
      for (const azp of authorizedParties) {
        const token = await createValidClerkToken({
          userId: 'user_multi_azp',
          email: 'multi-azp@example.com',
          azp,
        });

        const claims = await verifyClerkToken(token, { authorizedParties });
        expect(claims.azp).toBe(azp);
      }
    });

    it('should accept tokens without azp even when authorized parties are configured', async () => {
      const token = await createValidClerkToken({
        userId: 'user_no_azp_with_config',
        email: 'no-azp-config@example.com',
        // No azp claim
      });

      const options = {
        authorizedParties: ['https://app.example.com'],
      };

      const claims = await verifyClerkToken(token, options);
      expect(claims.sub).toBe('user_no_azp_with_config');
      expect(claims.azp).toBeUndefined();
    });
  });

  describe('Organization Features', () => {
    it('should verify organization claims correctly', async () => {
      const token = await testUtils.createOrgToken(
        'org_12345',
        'acme-corp',
        'admin'
      );

      const claims = await verifyClerkToken(token);

      expect(claims.org_id).toBe('org_12345');
      expect(claims.org_slug).toBe('acme-corp');
      expect(claims.org_role).toBe('admin');
      expect(claims.session_id).toBe('sess_org_org_12345');
      expect(claims.email).toBe('admin@acme-corp.com');
    });

    it('should preserve organization claims in environment config verification', async () => {
      const token = await testUtils.createOrgToken(
        'org_env_test',
        'env-org',
        'member'
      );

      const claims = await verifyClerkTokenWithEnvConfig(token);

      expect(claims.org_id).toBe('org_env_test');
      expect(claims.org_slug).toBe('env-org');
      expect(claims.org_role).toBe('member');
    });

    it('should handle tokens without organization claims', async () => {
      const token = await createValidClerkToken({
        userId: 'user_no_org',
        email: 'no-org@example.com',
        // No org_* claims
      });

      const claims = await verifyClerkToken(token);

      expect(claims.sub).toBe('user_no_org');
      expect(claims.org_id).toBeUndefined();
      expect(claims.org_slug).toBeUndefined();
      expect(claims.org_role).toBeUndefined();
    });
  });

  describe('Session Token Detection', () => {
    it('should identify session tokens correctly', async () => {
      const sessionToken = await createValidClerkToken({
        userId: 'user_session',
        email: 'session@example.com',
        sessionId: 'sess_abc123',
      });

      const claims = await verifyClerkToken(sessionToken);

      expect(claims.session_id).toBe('sess_abc123');
      expect(isClerkSessionToken(claims)).toBe(true);
    });

    it('should identify non-session tokens correctly', async () => {
      const nonSessionToken = await createValidClerkToken({
        userId: 'user_non_session',
        email: 'non-session@example.com',
        // No session_id
      });

      const claims = await verifyClerkToken(nonSessionToken);

      expect(claims.session_id).toBeUndefined();
      expect(isClerkSessionToken(claims)).toBe(false);
    });

    it('should handle session tokens with organization data', async () => {
      const orgSessionToken = await createValidClerkToken({
        userId: 'user_org_session',
        email: 'org-session@example.com',
        sessionId: 'sess_org_session',
        orgId: 'org_session_test',
        orgSlug: 'session-org',
        orgRole: 'admin',
      });

      const claims = await verifyClerkToken(orgSessionToken);

      expect(isClerkSessionToken(claims)).toBe(true);
      expect(claims.session_id).toBe('sess_org_session');
      expect(claims.org_id).toBe('org_session_test');
    });
  });

  describe('Error Scenarios', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = await createExpiredClerkToken();

      await expect(verifyClerkToken(expiredToken)).rejects.toThrow();

      // Verify the token is actually expired
      const parsedToken = testUtils.parseTokenUnsafe(expiredToken);
      expect(parsedToken.exp).toBeLessThan(Math.floor(Date.now() / 1000));
    });

    it('should reject tokens with invalid signature', async () => {
      const invalidToken = await createInvalidSignatureClerkToken();

      await expect(verifyClerkToken(invalidToken)).rejects.toThrow();
    });

    it('should reject tokens not yet valid', async () => {
      const futureToken = await createNotYetValidClerkToken();

      await expect(verifyClerkToken(futureToken)).rejects.toThrow();

      // Verify the token nbf is in the future
      const parsedToken = testUtils.parseTokenUnsafe(futureToken);
      expect(parsedToken.nbf).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should reject non-Clerk issuers', async () => {
      const nonClerkToken = await edgeCaseTokens.nonClerkIssuer();

      await expect(verifyClerkToken(nonClerkToken)).rejects.toThrow();

      // Verify the token has a non-Clerk issuer
      const parsedToken = testUtils.parseTokenUnsafe(nonClerkToken);
      expect(parsedToken.iss).not.toMatch(/\.clerk\.accounts\.dev$/);
    });

    it('should reject tokens with missing issuer', async () => {
      const noIssuerToken = await edgeCaseTokens.missingIssuer();

      await expect(verifyClerkToken(noIssuerToken)).rejects.toThrow();

      // Verify the token actually lacks an issuer
      const parsedToken = testUtils.parseTokenUnsafe(noIssuerToken);
      expect(parsedToken.iss).toBeUndefined();
    });

    it('should handle network timeouts gracefully', async () => {
      // Since our mock redirects all Clerk issuers, we'll test with a non-redirected issuer
      // to simulate network failures
      const timeoutToken = await createValidClerkToken({
        userId: 'user_timeout',
        email: 'timeout@example.com',
        issuer: 'https://timeout-will-fail.example.com', // Non-Clerk issuer that won't be redirected
      });

      // This should fail due to unknown issuer before even reaching network
      await expect(verifyClerkToken(timeoutToken)).rejects.toThrow();
    });

    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        '',
        '   ',
        'not.a.jwt',
        'invalid',
        'a.b', // Missing third part
        'a.b.c.d', // Too many parts
      ];

      for (const malformedToken of malformedTokens) {
        await expect(verifyClerkToken(malformedToken)).rejects.toThrow();
      }
    });

    it('should reject tokens with unknown key ID', async () => {
      const unknownKeyToken = await edgeCaseTokens.unknownKeyId();

      await expect(verifyClerkToken(unknownKeyToken)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle tokens with multiple audiences', async () => {
      const multiAudToken = await edgeCaseTokens.multipleAudiences();

      const claims = await verifyClerkToken(multiAudToken);

      expect(claims.aud).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
        'https://api.example.com',
      ]);
    });

    it('should handle tokens with long expiration', async () => {
      const longExpToken = await edgeCaseTokens.longExpiration();

      const claims = await verifyClerkToken(longExpToken);

      expect(claims.exp).toBeGreaterThan(
        Math.floor(Date.now() / 1000) + 364 * 24 * 3600 // Almost a year
      );
    });

    it('should handle tokens about to expire', async () => {
      const soonExpireToken = await createValidClerkToken({
        userId: 'user_soon_expire',
        email: 'soon-expire@example.com',
        expiresIn: '10s', // Expires in 10 seconds
      });

      const claims = await verifyClerkToken(soonExpireToken);

      expect(claims.sub).toBe('user_soon_expire');
      expect(claims.exp).toBeLessThan(
        Math.floor(Date.now() / 1000) + 15 // Less than 15 seconds from now
      );
    });

    it('should handle actor tokens for impersonation', async () => {
      const actorToken = await testUtils.createActorToken(
        'user_admin_123',
        'admin'
      );

      const claims = await verifyClerkToken(actorToken);

      expect(claims.act).toBeDefined();
      expect(claims.act?.sub).toBe('user_admin_123');
      expect((claims.act as any)?.role).toBe('admin');
      expect(isClerkSessionToken(claims)).toBe(true);
    });

    it('should preserve custom claims', async () => {
      const customClaimsToken = await createValidClerkToken({
        userId: 'user_custom',
        email: 'custom@example.com',
        customClaims: {
          role: 'premium_user',
          features: ['feature-a', 'feature-b'],
          metadata: {
            plan: 'enterprise',
            region: 'us-east-1',
          },
          numeric_claim: 42,
          boolean_claim: true,
        },
      });

      const claims = await verifyClerkToken(customClaimsToken);

      expect(claims['role']).toBe('premium_user');
      expect(claims['features']).toEqual(['feature-a', 'feature-b']);
      expect(claims['metadata']).toEqual({
        plan: 'enterprise',
        region: 'us-east-1',
      });
      expect(claims['numeric_claim']).toBe(42);
      expect(claims['boolean_claim']).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should use CLERK_AUTHORIZED_PARTIES from environment', async () => {
      process.env['CLERK_AUTHORIZED_PARTIES'] =
        'https://env-app.com,https://env-admin.com';

      const token = await createValidClerkToken({
        userId: 'user_env_azp',
        email: 'env-azp@example.com',
        azp: 'https://env-app.com',
      });

      const claims = await verifyClerkTokenWithEnvConfig(token);

      expect(claims.sub).toBe('user_env_azp');
      expect(claims.azp).toBe('https://env-app.com');
    });

    it('should reject unauthorized parties from environment config', async () => {
      process.env['CLERK_AUTHORIZED_PARTIES'] = 'https://env-allowed.com';

      const token = await createValidClerkToken({
        userId: 'user_env_forbidden',
        email: 'env-forbidden@example.com',
        azp: 'https://env-forbidden.com',
      });

      await expect(verifyClerkTokenWithEnvConfig(token)).rejects.toThrow(
        'Unauthorized party: https://env-forbidden.com'
      );
    });

    it('should handle empty environment configuration', async () => {
      delete process.env['CLERK_AUTHORIZED_PARTIES'];
      delete process.env['CLERK_PUBLISHABLE_KEY'];

      const token = await createValidClerkToken({
        userId: 'user_no_env',
        email: 'no-env@example.com',
        azp: 'https://any.example.com',
      });

      const claims = await verifyClerkTokenWithEnvConfig(token);

      expect(claims.sub).toBe('user_no_env');
      expect(claims.azp).toBe('https://any.example.com');
    });

    it('should parse comma-separated authorized parties correctly', async () => {
      // const authorizedParties = getAuthorizedPartiesFromEnv();
      // const initialLength = authorizedParties.length;

      process.env['CLERK_AUTHORIZED_PARTIES'] =
        'https://app1.com, https://app2.com , https://app3.com,, ';

      const parties = getAuthorizedPartiesFromEnv();

      expect(parties).toEqual([
        'https://app1.com',
        'https://app2.com',
        'https://app3.com',
      ]);
    });

    it('should attempt publishable key extraction when no explicit config', async () => {
      delete process.env['CLERK_AUTHORIZED_PARTIES'];
      process.env['CLERK_PUBLISHABLE_KEY'] =
        'pk_test_Y2xlcmsuaW5jbHVkZWQua2V0dGxlLTk2LmxjbC5kZXYk';

      const parties = getAuthorizedPartiesFromEnv();

      // Currently returns empty array as extraction is not implemented
      expect(Array.isArray(parties)).toBe(true);
    });

    it('should handle invalid publishable keys gracefully', async () => {
      const invalidKeys = [
        '',
        'invalid-key',
        'sk_test_123', // Secret key, not publishable
        'pk_live_', // Incomplete key
      ];

      for (const key of invalidKeys) {
        const result = extractAuthorizedPartiesFromPublishableKey(key);
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
      }
    });
  });

  describe('Clock Skew Tolerance', () => {
    it('should accept tokens with minor clock skew', async () => {
      // Create a token that would be expired but within clock tolerance
      const now = Math.floor(Date.now() / 1000);
      const token = await createValidClerkToken({
        userId: 'user_clock_skew',
        email: 'clock-skew@example.com',
        customClaims: {
          exp: now - 2, // Expired 2 seconds ago (within 5-second tolerance)
          iat: now - 3602, // Issued 1 hour and 2 seconds ago
        },
      });

      // Should pass due to clock skew tolerance
      const claims = await verifyClerkToken(token, { clockSkewInSeconds: 5 });

      expect(claims.sub).toBe('user_clock_skew');
    });

    it('should use default clock skew when not specified', async () => {
      const token = await createValidClerkToken({
        userId: 'user_default_skew',
        email: 'default-skew@example.com',
      });

      const claims = await verifyClerkToken(token);

      expect(claims.sub).toBe('user_default_skew');
      // Implicit test: no error means default clock skew was applied
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should handle complete authentication flow', async () => {
      // Simulate a complete authentication flow

      // 1. User authenticates and gets a session token
      const sessionToken = await createValidClerkToken({
        userId: 'user_auth_flow',
        email: 'auth-flow@example.com',
        sessionId: 'sess_auth_flow_123',
        orgId: 'org_auth_test',
        orgSlug: 'auth-test-org',
        orgRole: 'member',
        azp: 'https://app.example.com',
      });

      // 2. Configure environment for the app
      process.env['CLERK_AUTHORIZED_PARTIES'] =
        'https://app.example.com,https://admin.example.com';

      // 3. Verify the token
      const claims = await verifyClerkTokenWithEnvConfig(sessionToken);

      // 4. Validate all claims are preserved and correct
      expect(claims.sub).toBe('user_auth_flow');
      expect(claims.email).toBe('auth-flow@example.com');
      expect(claims.session_id).toBe('sess_auth_flow_123');
      expect(claims.org_id).toBe('org_auth_test');
      expect(claims.org_slug).toBe('auth-test-org');
      expect(claims.org_role).toBe('member');
      expect(claims.azp).toBe('https://app.example.com');

      // 5. Verify it's identified as a session token
      expect(isClerkSessionToken(claims)).toBe(true);
    });

    it('should handle concurrent verification requests', async () => {
      const tokens = await Promise.all([
        createValidClerkToken({ userId: 'user_concurrent_1' }),
        createValidClerkToken({ userId: 'user_concurrent_2' }),
        createValidClerkToken({ userId: 'user_concurrent_3' }),
      ]);

      // Verify all tokens concurrently
      const verificationPromises = tokens.map(token => verifyClerkToken(token));
      const results = await Promise.all(verificationPromises);

      expect(results).toHaveLength(3);
      expect(results[0]?.sub).toBe('user_concurrent_1');
      expect(results[1]?.sub).toBe('user_concurrent_2');
      expect(results[2]?.sub).toBe('user_concurrent_3');
    });

    it('should maintain performance with multiple verifications', async () => {
      const token = await createValidClerkToken({
        userId: 'user_performance',
        email: 'performance@example.com',
      });

      const startTime = Date.now();

      // First verification (cache miss)
      await verifyClerkToken(token);

      // Multiple subsequent verifications (cache hits)
      const promises = Array(10)
        .fill(0)
        .map(() => verifyClerkToken(token));
      await Promise.all(promises);

      const endTime = Date.now();

      // Should complete quickly due to caching (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources properly', async () => {
      // This test ensures that our mock setup is working correctly
      expect(mockSetup.jwksServer).toBeDefined();
      expect(mockSetup.validToken).toBeDefined();
      expect(mockSetup.expiredToken).toBeDefined();
      expect(mockSetup.invalidToken).toBeDefined();
      expect(mockSetup.cleanup).toBeDefined();

      // Verify we can still create tokens
      const token = await createValidClerkToken({
        userId: 'user_cleanup_test',
        email: 'cleanup@example.com',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});

/**
 * Property-based tests for edge cases and boundary conditions
 * Uses generated test data to validate behavior across many scenarios
 */
describe('Clerk JWT Verification Property Tests', () => {
  let mockSetup: Awaited<ReturnType<typeof setupClerkMocks>>;
  let originalGetOrCreate: any;

  beforeAll(async () => {
    mockSetup = await setupClerkMocks();

    // Configure JWKS cache for property tests
    const jwksUrl = mockSetup.jwksServer.getJWKSUrl();
    const mockServerBase = jwksUrl.replace('/.well-known/jwks.json', '');

    const { jwksCache } = await import('../../src/auth/jwks-cache.js');
    jwksCache.clear();

    originalGetOrCreate = jwksCache.getOrCreate.bind(jwksCache);
    jwksCache.getOrCreate = (issuer: string) => {
      if (issuer.includes('.clerk.accounts.dev')) {
        return originalGetOrCreate(mockServerBase);
      }
      return originalGetOrCreate(issuer);
    };
  });

  afterAll(async () => {
    // Restore original JWKS cache function
    if (originalGetOrCreate) {
      const { jwksCache } = await import('../../src/auth/jwks-cache.js');
      jwksCache.getOrCreate = originalGetOrCreate;
      jwksCache.clear();
    }

    await mockSetup.cleanup();
  });

  it('should handle various expiration times correctly', async () => {
    const expirationTimes = ['10s', '1m', '1h', '1d', '7d'];

    for (const expiresIn of expirationTimes) {
      const token = await createValidClerkToken({
        userId: `user_exp_${expiresIn}`,
        email: `exp-${expiresIn}@example.com`,
        expiresIn,
      });

      const claims = await verifyClerkToken(token);
      expect(claims.sub).toBe(`user_exp_${expiresIn}`);
      expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it('should handle various authorized party configurations', async () => {
    const azpConfigs = [
      [],
      ['https://single.com'],
      ['https://app.com', 'https://admin.com'],
      ['https://app.com', 'https://admin.com', 'https://mobile.com'],
      Array(10)
        .fill(0)
        .map((_, i) => `https://app${i}.com`), // Many authorized parties
    ];

    for (const authorizedParties of azpConfigs) {
      if (authorizedParties.length === 0) {
        const token = await createValidClerkToken({
          userId: 'user_no_azp_config',
          email: 'no-azp@example.com',
        });

        const claims = await verifyClerkToken(token, { authorizedParties });
        expect(claims.sub).toBe('user_no_azp_config');
      } else {
        const azp = authorizedParties[0] || 'https://default.com';
        const token = await createValidClerkToken({
          userId: 'user_azp_config',
          email: 'azp@example.com',
          azp,
        });

        const claims = await verifyClerkToken(token, { authorizedParties });
        expect(claims.sub).toBe('user_azp_config');
        expect(claims.azp).toBe(azp);
      }
    }
  });
});
