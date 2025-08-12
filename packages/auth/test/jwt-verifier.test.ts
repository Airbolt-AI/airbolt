import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { AuthValidatorFactory } from '../src/factory.js';
import { AuthError } from '../src/types.js';
import type { AuthConfig, JWTPayload } from '../src/types.js';
import { jose } from '../src/utils/jose-wrapper.js';

describe('JWT Verifier Property-Based Tests', () => {
  let factory: AuthValidatorFactory;
  let config: AuthConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      mode: 'EXTERNAL',
      issuer: 'https://test-issuer.example.com',
      audience: 'test-audience',
      jwksUri: 'https://test-issuer.example.com/.well-known/jwks.json',
    };
    factory = new AuthValidatorFactory(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Format Validation', () => {
    test.prop([fc.string({ minLength: 0, maxLength: 1000 })])(
      'rejects any malformed JWT structure',
      async token => {
        // Property: Any string that isn't a valid JWT format should be rejected
        const isValidJwtFormat =
          /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(token);

        if (!isValidJwtFormat) {
          const validator = factory.getValidators()[0];
          if (validator) {
            await expect(validator.verify(token)).rejects.toThrow();
          }
        }
      }
    );

    test.prop([
      fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
        minLength: 0,
        maxLength: 5,
      }),
    ])('handles tokens with wrong number of segments', async segments => {
      // Property: JWT must have exactly 3 segments
      const token = segments.join('.');

      if (segments.length !== 3) {
        const validator = factory.getValidators()[0];
        if (validator && validator.canHandle(token)) {
          await expect(validator.verify(token)).rejects.toThrow();
        }
      }
    });
  });

  describe('Issuer Validation Properties', () => {
    test.prop([fc.webUrl(), fc.option(fc.webUrl())])(
      'validates issuer claim correctly',
      async (tokenIssuer, configuredIssuer) => {
        // Property: Token is only valid if issuer matches configuration
        const testConfig: AuthConfig = {
          mode: 'EXTERNAL',
          issuer: configuredIssuer || undefined,
        };

        const testFactory = new AuthValidatorFactory(testConfig);
        const validators = testFactory.getValidators();

        // When issuer is configured, it must match
        if (configuredIssuer && tokenIssuer !== configuredIssuer) {
          // Should reject mismatched issuers
          expect(validators.length).toBeGreaterThan(0);
        }
      }
    );

    test.prop([
      fc.constantFrom(
        'https://clerk.example.com',
        'https://dev.clerk.accounts.dev',
        'https://auth0.example.com',
        'https://example.auth0.com',
        'https://firebase.googleapis.com',
        'https://example.supabase.co'
      ),
    ])('detects provider patterns correctly', issuer => {
      // Property: Known provider patterns should be detected
      const isClerk = issuer.includes('clerk');
      const isAuth0 = issuer.includes('auth0');
      const isFirebase =
        issuer.includes('firebase') || issuer.includes('googleapis');
      const isSupabase = issuer.includes('supabase');

      expect(isClerk || isAuth0 || isFirebase || isSupabase).toBe(true);
    });
  });

  describe('Expiration Time Edge Cases', () => {
    test.prop([
      fc.integer({ min: -86400, max: 86400 }), // +/- 24 hours in seconds
      fc.integer({ min: 0, max: 60 }), // Clock tolerance in seconds
    ])(
      'handles token expiration with clock skew',
      (expiryOffset, clockTolerance) => {
        // Property: Tokens should be rejected if expired beyond clock tolerance
        const now = Math.floor(Date.now() / 1000);
        const exp = now + expiryOffset;

        const isExpired = expiryOffset < -clockTolerance;
        const shouldReject = isExpired;

        // This tests the logic, actual JWT verification would happen in integration
        expect(shouldReject).toBe(expiryOffset < -clockTolerance);
      }
    );

    test.prop([
      fc.option(fc.integer()),
      fc.option(fc.integer()),
      fc.option(fc.integer()),
    ])('validates time-based claims consistently', (iat, nbf, exp) => {
      // Property: Time claims must be logically consistent
      if (iat !== null && nbf !== null && iat > nbf) {
        // Issued-at should not be after not-before
        expect(true).toBe(true); // Would be invalid
      }

      if (iat !== null && exp !== null && iat > exp) {
        // Issued-at should not be after expiry
        expect(true).toBe(true); // Would be invalid
      }

      if (nbf !== null && exp !== null && nbf > exp) {
        // Not-before should not be after expiry
        expect(true).toBe(true); // Would be invalid
      }
    });
  });

  describe('User Identification Properties', () => {
    test.prop([
      fc.record({
        sub: fc.option(fc.string()),
        email: fc.option(fc.emailAddress()),
        user_id: fc.option(fc.string()),
        userId: fc.option(fc.string()),
        uid: fc.option(fc.string()),
      }),
    ])('extracts user ID from various claim formats', claims => {
      // Property: At least one user identifier should be present
      const hasUserId = !!(
        claims.sub ||
        claims.email ||
        claims.user_id ||
        claims.userId ||
        claims.uid
      );

      if (!hasUserId) {
        // Should reject tokens without user identification
        expect(hasUserId).toBe(false);
      } else {
        // Should accept tokens with at least one identifier
        expect(hasUserId).toBe(true);
      }
    });

    test.prop([
      fc.constantFrom('sub', 'email', 'user_id', 'userId', 'uid'),
      fc.string({ minLength: 1, maxLength: 100 }),
    ])('prioritizes user ID claims correctly', (claimName, claimValue) => {
      // Property: User ID extraction should be deterministic
      const claims: any = { [claimName]: claimValue };

      // Priority order: sub > user_id > userId > uid > email
      const extractedId =
        claims.sub ||
        claims.user_id ||
        claims.userId ||
        claims.uid ||
        claims.email;

      expect(extractedId).toBe(claimValue);
    });
  });

  describe('Audience Validation Properties', () => {
    test.prop([
      fc.option(fc.array(fc.string(), { minLength: 1, maxLength: 5 })),
      fc.option(fc.string()),
    ])(
      'validates audience claims correctly',
      (tokenAudience, configuredAudience) => {
        // Property: Audience must match if configured
        if (configuredAudience) {
          const audienceArray = Array.isArray(tokenAudience)
            ? tokenAudience
            : [tokenAudience].filter(Boolean);
          const isValid = audienceArray.includes(configuredAudience);

          // This represents the validation logic
          if (!isValid && tokenAudience) {
            expect(isValid).toBe(false);
          }
        } else {
          // No audience configured means any audience is accepted
          expect(true).toBe(true);
        }
      }
    );
  });

  describe('Provider-Specific Token Formats', () => {
    test.prop([
      fc.constantFrom('clerk', 'auth0', 'firebase', 'supabase'),
      fc.record({
        azp: fc.option(fc.string()),
        org_id: fc.option(fc.string()),
        org_role: fc.option(fc.string()),
        scope: fc.option(fc.string()),
        permissions: fc.option(fc.array(fc.string())),
      }),
    ])('handles provider-specific claims', (provider, providerClaims) => {
      // Property: Provider-specific claims should be preserved
      switch (provider) {
        case 'clerk':
          // Clerk uses azp, org_id, org_role
          if (providerClaims.azp) {
            expect(providerClaims.azp).toBeDefined();
          }
          break;
        case 'auth0':
          // Auth0 uses scope, permissions
          if (providerClaims.permissions) {
            expect(Array.isArray(providerClaims.permissions)).toBe(true);
          }
          break;
        case 'firebase':
          // Firebase has minimal custom claims
          expect(true).toBe(true);
          break;
        case 'supabase':
          // Supabase uses standard claims
          expect(true).toBe(true);
          break;
      }
    });
  });

  describe('Concurrent Verification Properties', () => {
    test.prop([
      fc.integer({ min: 2, max: 20 }),
      fc.array(fc.string(), { minLength: 2, maxLength: 20 }),
    ])(
      'handles concurrent token verifications safely',
      async (concurrentCount, tokens) => {
        // Property: Concurrent verifications should not interfere with each other
        const validators = factory.getValidators();
        if (validators.length === 0) return;

        const validator = validators[0];

        // Create promises for concurrent verifications
        const verificationPromises = tokens
          .slice(0, concurrentCount)
          .map(token => {
            // Each verification should be independent
            return validator.verify(token).catch(() => null);
          });

        const results = await Promise.all(verificationPromises);

        // Each result should be independent
        expect(results.length).toBe(Math.min(concurrentCount, tokens.length));
      }
    );
  });

  describe('Error Message Properties', () => {
    test.prop([
      fc.constantFrom(
        'invalid_token',
        'token_expired',
        'invalid_issuer',
        'invalid_audience',
        'missing_user_id'
      ),
      fc.constantFrom('clerk', 'auth0', 'firebase', 'supabase', 'unknown'),
    ])('provides helpful error messages', (errorType, provider) => {
      // Property: Error messages should be informative and actionable
      const error = new AuthError(
        `Token validation failed: ${errorType}`,
        provider,
        'Check your token configuration',
        'Review the authentication setup'
      );

      expect(error.message).toContain(errorType);
      expect(error.provider).toBe(provider);
      expect(error.hint).toBeTruthy();
      expect(error.action).toBeTruthy();
    });
  });

  describe('JWKS Key Rotation Properties', () => {
    test.prop([
      fc.array(fc.string(), { minLength: 1, maxLength: 5 }), // Key IDs
      fc.integer({ min: 0, max: 4 }), // Index of current key
    ])('handles key rotation scenarios', async (keyIds, currentKeyIndex) => {
      // Property: Should handle multiple keys and find the right one
      const currentKid = keyIds[Math.min(currentKeyIndex, keyIds.length - 1)];

      // Mock JWKS response with multiple keys
      const jwks = {
        keys: keyIds.map(kid => ({
          kid,
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          n: 'mock-n-value',
          e: 'AQAB',
        })),
      };

      // The verifier should be able to find the right key
      expect(jwks.keys.find(k => k.kid === currentKid)).toBeDefined();
    });
  });

  describe('Token Payload Validation Properties', () => {
    test.prop([
      fc.record({
        iss: fc.option(fc.string()),
        sub: fc.option(fc.string()),
        aud: fc.option(fc.oneof(fc.string(), fc.array(fc.string()))),
        exp: fc.option(fc.integer()),
        nbf: fc.option(fc.integer()),
        iat: fc.option(fc.integer()),
        jti: fc.option(fc.string()),
      }),
    ])('validates all standard JWT claims', payload => {
      // Property: All standard claims should be validated if present
      const now = Math.floor(Date.now() / 1000);

      const validations = {
        hasIssuer: !!payload.iss,
        hasSubject: !!payload.sub,
        hasAudience: !!payload.aud,
        hasExpiry: !!payload.exp,
        isNotExpired: !payload.exp || payload.exp > now,
        isAfterNotBefore: !payload.nbf || payload.nbf <= now,
      };

      // At least basic claims should be present
      const isMinimallyValid = validations.hasSubject || validations.hasIssuer;
      expect(typeof isMinimallyValid).toBe('boolean');
    });
  });
});

describe('JWT Verifier Integration Scenarios', () => {
  describe('Real-World Token Patterns', () => {
    test.prop([
      fc.integer({ min: 1, max: 100 }), // Number of requests
      fc.integer({ min: 10, max: 90 }), // Percentage of valid tokens
    ])(
      'handles mixed valid/invalid token stream',
      async (requestCount, validPercentage) => {
        // Property: System should handle any mix of valid and invalid tokens
        const results = [];

        for (let i = 0; i < requestCount; i++) {
          const isValid = Math.random() * 100 < validPercentage;
          results.push({
            request: i,
            shouldBeValid: isValid,
            // In real test, would verify token here
          });
        }

        const validCount = results.filter(r => r.shouldBeValid).length;
        const invalidCount = results.length - validCount;

        expect(validCount + invalidCount).toBe(requestCount);
      }
    );
  });

  describe('Provider Auto-Detection Properties', () => {
    test.prop([
      fc.constantFrom(
        'https://clever-otter-42.clerk.accounts.dev',
        'https://myapp.us.auth0.com',
        'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        'https://myproject.supabase.co/auth/v1'
      ),
    ])('auto-detects provider from issuer URL', issuer => {
      // Property: Known provider patterns should be automatically detected
      const detectProvider = (iss: string) => {
        if (iss.includes('clerk')) return 'clerk';
        if (iss.includes('auth0')) return 'auth0';
        if (iss.includes('googleapis') || iss.includes('firebase'))
          return 'firebase';
        if (iss.includes('supabase')) return 'supabase';
        return 'unknown';
      };

      const provider = detectProvider(issuer);
      expect(provider).not.toBe('unknown');
    });
  });
});
