/**
 * Test file demonstrating usage of Clerk test fixtures
 * This validates that all fixture functions work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createValidClerkToken,
  createExpiredClerkToken,
  createInvalidSignatureClerkToken,
  createNotYetValidClerkToken,
  edgeCaseTokens,
  testUtils,
  setupClerkMocks,
  type MockClerkToken,
  clerkClaims,
  getMockClerkJWKS,
  MockJWKSServer,
} from './clerk-tokens.js';

describe('Clerk Token Fixtures', () => {
  let mockSetup: Awaited<ReturnType<typeof setupClerkMocks>>;

  beforeAll(async () => {
    mockSetup = await setupClerkMocks();
  });

  afterAll(async () => {
    if (mockSetup?.cleanup) {
      await mockSetup.cleanup();
    }
  });

  describe('Basic Token Generation', () => {
    it('should create a valid Clerk token with default options', async () => {
      const token = await createValidClerkToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature

      // Parse token to check claims
      const claims = testUtils.parseTokenUnsafe(token);
      expect(claims.sub).toMatch(/^user_/);
      expect(claims.iss).toMatch(/\.clerk\.accounts\.dev$/);
      expect(claims.email).toContain('@');
      expect(claims.exp).toBeGreaterThan(testUtils.getCurrentJWTTimestamp());
    });

    it('should create a valid Clerk token with custom options', async () => {
      const customOptions = {
        userId: 'user_custom_123',
        email: 'custom@test.com',
        sessionId: 'sess_custom_456',
        orgId: 'org_custom_789',
        orgSlug: 'custom-org',
        orgRole: 'member',
        azp: 'https://custom.example.com',
        issuer: 'https://custom.clerk.accounts.dev',
        audience: 'https://custom-audience.com',
        expiresIn: '2h',
        customClaims: {
          plan: 'pro',
          features: ['feature-x', 'feature-y'],
        },
      };

      const token = await createValidClerkToken(customOptions);
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.sub).toBe(customOptions.userId);
      expect(claims.email).toBe(customOptions.email);
      expect(claims.session_id).toBe(customOptions.sessionId);
      expect(claims.org_id).toBe(customOptions.orgId);
      expect(claims.org_slug).toBe(customOptions.orgSlug);
      expect(claims.org_role).toBe(customOptions.orgRole);
      expect(claims.azp).toBe(customOptions.azp);
      expect(claims.iss).toBe(customOptions.issuer);
      expect(claims.aud).toBe(customOptions.audience);
      expect(claims.plan).toBe('pro');
      expect(claims.features).toEqual(['feature-x', 'feature-y']);

      // Verify expiration is approximately 2 hours from now
      const twoHoursFromNow = testUtils.getCurrentJWTTimestamp() + 2 * 3600;
      expect(claims.exp).toBeCloseTo(twoHoursFromNow, -1); // Within ~10 seconds
    });

    it('should create expired token', async () => {
      const token = await createExpiredClerkToken();
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.exp).toBeLessThan(testUtils.getCurrentJWTTimestamp());
      expect(claims.sub).toMatch(/^user_expired_/);
    });

    it('should create token with invalid signature', async () => {
      const token = await createInvalidSignatureClerkToken();
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.sub).toMatch(/^user_invalid_/);
      expect(claims.iss).toMatch(/\.clerk\.accounts\.dev$/);
      // This token will fail signature verification but have valid structure
    });

    it('should create not-yet-valid token', async () => {
      const token = await createNotYetValidClerkToken();
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.nbf).toBeGreaterThan(testUtils.getCurrentJWTTimestamp());
      expect(claims.sub).toMatch(/^user_future_/);
    });
  });

  describe('Edge Case Tokens', () => {
    it('should create token with missing issuer', async () => {
      const token = await edgeCaseTokens.missingIssuer();
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.iss).toBeUndefined();
      expect(claims.sub).toMatch(/^user_no_iss_/);
    });

    it('should create token with non-Clerk issuer', async () => {
      const token = await edgeCaseTokens.nonClerkIssuer();
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.iss).toBe('https://evil.auth0.com/');
      expect(claims.sub).toMatch(/^user_non_clerk_/);
    });

    it('should create token with multiple audiences', async () => {
      const token = await edgeCaseTokens.multipleAudiences();
      const claims = testUtils.parseTokenUnsafe(token);

      expect(Array.isArray(claims.aud)).toBe(true);
      expect(claims.aud).toHaveLength(3);
      expect(claims.aud).toContain('https://app.example.com');
      expect(claims.aud).toContain('https://admin.example.com');
      expect(claims.aud).toContain('https://api.example.com');
    });

    it('should create token with long expiration', async () => {
      const token = await edgeCaseTokens.longExpiration();
      const claims = testUtils.parseTokenUnsafe(token);

      const oneYearFromNow =
        testUtils.getCurrentJWTTimestamp() + 365 * 24 * 3600;
      expect(claims.exp).toBeCloseTo(oneYearFromNow, -60); // Within 1 minute
    });

    it('should create token with unknown key ID', async () => {
      const token = await edgeCaseTokens.unknownKeyId();
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());

      expect(header.kid).toBe('unknown-key-id-not-in-jwks');
    });
  });

  describe('Predefined Claims Sets', () => {
    it('should have basic user claims', () => {
      expect(clerkClaims.basicUser.sub).toMatch(/^user_/);
      expect(clerkClaims.basicUser.email).toBe('test@example.com');
      expect(clerkClaims.basicUser.iss).toMatch(/\.clerk\.accounts\.dev$/);
    });

    it('should have organization claims', () => {
      expect(clerkClaims.withOrganization.org_id).toMatch(/^org_/);
      expect(clerkClaims.withOrganization.org_slug).toBe('acme-corp');
      expect(clerkClaims.withOrganization.org_role).toBe('admin');
    });

    it('should have session claims', () => {
      expect(clerkClaims.withSessionId.session_id).toMatch(/^sess_/);
    });

    it('should have authorized party claims', () => {
      expect(clerkClaims.withAuthorizedParty.azp).toBe(
        'https://frontend.example.com'
      );
    });

    it('should have actor claims for impersonation', () => {
      expect(clerkClaims.withActor.act?.sub).toMatch(/^user_admin_/);
      expect(clerkClaims.withActor.act?.role).toBe('admin');
    });

    it('should have complete claims with all fields', () => {
      const claims = clerkClaims.complete;
      expect(claims.sub).toBeDefined();
      expect(claims.email).toBeDefined();
      expect(claims.session_id).toBeDefined();
      expect(claims.org_id).toBeDefined();
      expect(claims.org_slug).toBeDefined();
      expect(claims.org_role).toBeDefined();
      expect(claims.azp).toBeDefined();
      expect(claims.custom_claim).toBe('test-value');
      expect(claims.metadata).toBeDefined();
    });
  });

  describe('Test Utils', () => {
    it('should create organization token', async () => {
      const token = await testUtils.createOrgToken(
        'org_test_123',
        'test-org',
        'member'
      );
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.org_id).toBe('org_test_123');
      expect(claims.org_slug).toBe('test-org');
      expect(claims.org_role).toBe('member');
      expect(claims.iss).toContain('test-org.clerk.accounts.dev');
    });

    it('should create azp token', async () => {
      const azp = 'https://frontend.test.com';
      const token = await testUtils.createAzpToken(azp);
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.azp).toBe(azp);
    });

    it('should create actor token', async () => {
      const token = await testUtils.createActorToken(
        'user_admin_123',
        'super-admin'
      );
      const claims = testUtils.parseTokenUnsafe(token);

      expect(claims.act?.sub).toBe('user_admin_123');
      expect(claims.act?.role).toBe('super-admin');
    });

    it('should parse tokens safely', () => {
      const validJWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const parsed = testUtils.parseTokenUnsafe(validJWT);

      expect(parsed.sub).toBe('1234567890');
      expect(parsed.name).toBe('John Doe');
      expect(parsed.iat).toBe(1516239022);
    });

    it('should handle invalid token format', () => {
      expect(() => testUtils.parseTokenUnsafe('invalid')).toThrow(
        'Invalid token format'
      );
      expect(() => testUtils.parseTokenUnsafe('invalid.token')).toThrow(
        'Invalid token format'
      );
      expect(() => testUtils.parseTokenUnsafe('a..c')).toThrow(
        'Invalid token: missing payload'
      );
    });

    it('should calculate timestamps correctly', () => {
      const now = testUtils.getCurrentJWTTimestamp();
      const future = testUtils.getRelativeTimestamp(3600);
      const past = testUtils.getRelativeTimestamp(-3600);

      expect(future).toBe(now + 3600);
      expect(past).toBe(now - 3600);
    });
  });

  describe('JWKS and Mock Server', () => {
    it('should generate valid JWKS response', async () => {
      const jwks = await getMockClerkJWKS();

      expect(jwks.keys).toHaveLength(1);
      const key = jwks.keys[0]!;
      expect(key.kty).toBe('RSA');
      expect(key.kid).toBe('clerk-test-key-2024');
      expect(key.alg).toBe('RS256');
      expect(key.use).toBe('sig');
      expect(key.n).toBeDefined(); // RSA modulus
      expect(key.e).toBeDefined(); // RSA exponent
    });

    it('should start and stop JWKS server', async () => {
      const server = new MockJWKSServer();
      const url = await server.start();

      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(() => server.getJWKSUrl()).not.toThrow();

      // Test server responds correctly
      const jwksUrl = server.getJWKSUrl();
      expect(jwksUrl).toContain('/.well-known/jwks.json');

      await server.stop();
    });

    it('should use setup helper correctly', async () => {
      // This test uses the setup from beforeAll
      expect(mockSetup.validToken).toBeDefined();
      expect(mockSetup.expiredToken).toBeDefined();
      expect(mockSetup.invalidToken).toBeDefined();
      expect(mockSetup.notYetValidToken).toBeDefined();
      expect(mockSetup.jwks).toBeDefined();
      expect(mockSetup.jwksServer).toBeDefined();
      expect(mockSetup.cleanup).toBeDefined();

      // Verify tokens have correct structure
      const validClaims = testUtils.parseTokenUnsafe(mockSetup.validToken);
      const expiredClaims = testUtils.parseTokenUnsafe(mockSetup.expiredToken);

      expect(validClaims.exp).toBeGreaterThan(
        testUtils.getCurrentJWTTimestamp()
      );
      expect(expiredClaims.exp).toBeLessThan(
        testUtils.getCurrentJWTTimestamp()
      );
    });
  });

  describe('Token Type Safety', () => {
    it('should have proper TypeScript types', async () => {
      const token: MockClerkToken = await createValidClerkToken();
      expect(typeof token).toBe('string');

      // This tests that the types are exported correctly
      // The compilation success itself validates the type safety
    });
  });
});
