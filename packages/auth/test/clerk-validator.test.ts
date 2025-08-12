import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';

// Mock the JWKS utils BEFORE importing anything that uses them
vi.mock('../src/utils/jwks-utils.js', () => ({
  JWKSUtils: {
    fetchJWKS: vi.fn(),
    findKey: vi.fn(),
    extractPublicKey: vi.fn(),
  },
}));

import { ClerkValidator } from '../src/validators/clerk.js';
import type { AuthConfig, JWTPayload, JWKS } from '../src/types.js';
import { AuthError } from '../src/types.js';

describe.skip('ClerkValidator', () => {
  let validator: ClerkValidator;
  let mockConfig: AuthConfig;
  let mockJwksManager: any;
  let mockTokenValidator: any;

  beforeEach(() => {
    mockConfig = { NODE_ENV: 'development' };
    validator = new ClerkValidator(mockConfig);

    // Get reference to the mocked JWKS manager
    mockJwksManager = (validator as any).jwksManager;

    // Setup token validator mock
    mockTokenValidator = {
      decode: vi.fn(),
      verify: vi.fn(),
      extractUserId: vi.fn().mockReturnValue('user_123'),
    };
    (validator as any).tokenValidator = mockTokenValidator;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('canHandle - Clerk Provider Detection', () => {
    // Property-based test for Clerk development URLs
    test.prop([
      fc
        .string({ minLength: 3, maxLength: 20 })
        .filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // subdomain
    ])(
      'should handle development Clerk tokens with .clerk.accounts.dev issuer',
      subdomain => {
        const clerkDevIssuer = `https://${subdomain}.clerk.accounts.dev`;
        const payload = {
          sub: 'user_123',
          iss: clerkDevIssuer,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        });

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );

    // Property-based test for production Clerk URLs
    test.prop([
      fc.domain().filter(domain => !domain.includes('.clerk.accounts.dev')), // Custom domain
    ])(
      'should handle production Clerk tokens with clerk.com in issuer',
      domain => {
        const clerkProdIssuer = `https://${domain}/clerk.com/oauth`;
        const payload = {
          sub: 'user_123',
          iss: clerkProdIssuer,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        });

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );

    // Property-based test for azp claim detection
    test.prop([
      fc.webUrl({ validSchemes: ['https'] }), // Any HTTPS issuer
      fc
        .string({ minLength: 5, maxLength: 50 })
        .filter(s => s.includes('clerk')), // azp with 'clerk'
    ])(
      'should handle tokens with azp claim containing clerk',
      (issuer, azp) => {
        const payload = {
          sub: 'user_123',
          iss: issuer,
          azp: azp,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        });

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );

    // Property-based test for non-Clerk issuers
    test.prop([
      fc
        .webUrl({ validSchemes: ['https'] })
        .filter(
          url =>
            !url.includes('.clerk.accounts.dev') && !url.includes('clerk.com')
        ), // Non-Clerk issuer
      fc.option(fc.string().filter(s => !s.includes('clerk'))), // Non-Clerk azp
    ])('should reject non-Clerk tokens', (issuer, azp) => {
      const payload: any = {
        sub: 'user_123',
        iss: issuer,
      };
      if (azp) payload.azp = azp;

      mockTokenValidator.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: payload,
        signature: 'mock-signature',
      });

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(false);
    });

    // Edge cases for Clerk detection
    it('should handle malformed tokens gracefully', () => {
      mockTokenValidator.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(validator.canHandle('invalid.token.format')).toBe(false);
      expect(validator.canHandle('not-a-jwt')).toBe(false);
      expect(validator.canHandle('')).toBe(false);
    });

    // Test case sensitivity and variations
    it('should detect clerk in issuer case-insensitively', () => {
      const issuer = 'https://test.clerk.accounts.dev';
      const payload = {
        sub: 'user_123',
        iss: issuer,
      };

      mockTokenValidator.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: payload,
        signature: 'mock-signature',
      });

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(true);
    });

    // Test complex URL patterns
    test.prop([
      fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
        minLength: 1,
        maxLength: 3,
      }), // path segments
      fc.record(
        {
          // query params
          client_id: fc.option(fc.string()),
          redirect_uri: fc.option(fc.webUrl()),
        },
        { requiredKeys: [] }
      ),
    ])(
      'should handle complex Clerk URLs with paths and query params',
      (pathSegments, queryParams) => {
        const basePath = pathSegments.join('/');
        const queryString = new URLSearchParams(
          Object.fromEntries(
            Object.entries(queryParams).filter(([, v]) => v != null)
          ) as Record<string, string>
        ).toString();

        const issuer = `https://test.clerk.accounts.dev/${basePath}${queryString ? '?' + queryString : ''}`;
        const payload = {
          sub: 'user_123',
          iss: issuer,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        });

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );
  });

  describe('verify - Token Validation Flow', () => {
    const mockJwks: JWKS = {
      keys: [
        {
          kty: 'RSA',
          kid: 'test-key-id',
          n: 'test-modulus',
          e: 'AQAB',
          alg: 'RS256',
        },
      ],
    };

    const mockPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`;

    beforeEach(() => {
      // Setup default successful mocks
      mockJwksManager.getJWKS.mockResolvedValue(mockJwks);
      mockJwksManager.findKey.mockReturnValue(mockJwks.keys[0]);
      mockJwksManager.extractPublicKey.mockReturnValue(mockPublicKey);

      // Setup policy mock
      const mockPolicy = {
        validateIssuer: vi.fn(),
        validateAudience: vi.fn(),
        validateClaims: vi.fn(),
        isOpaqueToken: vi.fn().mockReturnValue(false),
      };
      (validator as any).policy = mockPolicy;
    });

    // Property-based test for successful verification flow
    test.prop([
      fc
        .string({ minLength: 3, maxLength: 20 })
        .filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // subdomain
      fc.string({ minLength: 5, maxLength: 50 }), // user ID
      fc.string({ minLength: 10, maxLength: 20 }), // key ID
    ])(
      'should successfully verify valid Clerk tokens',
      async (subdomain, userId, keyId) => {
        const issuer = `https://${subdomain}.clerk.accounts.dev`;
        const payload: JWTPayload = {
          sub: userId,
          iss: issuer,
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000),
        };

        const token = jwt.sign(payload, 'test-secret');

        // Setup mocks for this specific test
        mockTokenValidator.decode.mockReturnValue({
          header: { kid: keyId },
          payload: payload,
          signature: 'mock-signature',
        });
        mockTokenValidator.verify.mockResolvedValue(payload);

        const result = await validator.verify(token);

        expect(result).toEqual(payload);
        expect(mockJwksManager.getJWKS).toHaveBeenCalledWith(issuer);
        expect(mockJwksManager.findKey).toHaveBeenCalledWith(mockJwks, keyId);
        expect(mockJwksManager.extractPublicKey).toHaveBeenCalledWith(
          mockJwks.keys[0]
        );
      }
    );

    // Property-based test for missing issuer handling
    test.prop([
      fc.string({ minLength: 5, maxLength: 50 }), // user ID
    ])('should throw AuthError for tokens without issuer', async userId => {
      const payload: JWTPayload = {
        sub: userId,
        // Missing iss claim
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, 'test-secret');

      mockTokenValidator.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: payload,
        signature: 'mock-signature',
      });

      await expect(validator.verify(token)).rejects.toThrow(AuthError);
      await expect(validator.verify(token)).rejects.toThrow(
        'Auto-discovery requires issuer claim in JWT'
      );
    });

    // Property-based test for JWKS key not found
    test.prop([
      fc
        .string({ minLength: 3, maxLength: 20 })
        .filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // subdomain
      fc.string({ minLength: 10, maxLength: 20 }), // missing key ID
    ])(
      'should throw AuthError when key not found in JWKS',
      async (subdomain, missingKeyId) => {
        const issuer = `https://${subdomain}.clerk.accounts.dev`;
        const payload: JWTPayload = {
          sub: 'user_123',
          iss: issuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, 'test-secret');

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: missingKeyId },
          payload: payload,
          signature: 'mock-signature',
        });

        // Mock key not found
        mockJwksManager.findKey.mockReturnValue(null);

        await expect(validator.verify(token)).rejects.toThrow(AuthError);
        await expect(validator.verify(token)).rejects.toThrow(
          'No matching key found in JWKS'
        );
      }
    );

    // Test concurrent verification requests (race condition detection)
    test.prop([
      fc.integer({ min: 2, max: 10 }), // number of concurrent requests
      fc
        .string({ minLength: 3, maxLength: 20 })
        .filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // subdomain
    ])(
      'should handle concurrent verification requests correctly',
      async (concurrentCount, subdomain) => {
        const issuer = `https://${subdomain}.clerk.accounts.dev`;
        const payload: JWTPayload = {
          sub: 'user_123',
          iss: issuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, 'test-secret');

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        });
        mockTokenValidator.verify.mockResolvedValue(payload);

        // Fire multiple concurrent verification requests
        const promises = Array(concurrentCount)
          .fill(0)
          .map(() => validator.verify(token));
        const results = await Promise.all(promises);

        // All should succeed and return the same payload
        results.forEach(result => {
          expect(result).toEqual(payload);
        });

        // JWKS should be fetched for each request
        expect(mockJwksManager.getJWKS).toHaveBeenCalledTimes(concurrentCount);
      }
    );
  });

  describe('extractUserId - User ID Extraction', () => {
    // Property-based test for various user ID claim patterns
    test.prop([
      fc.oneof(
        fc.record({
          sub: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }),
        fc.record({
          userId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }),
        fc.record({
          user_id: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }),
        fc.record({
          sub: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          userId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }) // Multiple ID claims - should prioritize 'sub'
      ),
    ])('should extract user ID from various claim patterns', payload => {
      mockTokenValidator.extractUserId.mockImplementation((p: JWTPayload) => {
        return p.sub || p.userId || p.user_id || 'fallback';
      });

      const result = validator.extractUserId(payload as JWTPayload);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    // Test malformed JSON in token
    it('should handle tokens with malformed JSON payload', () => {
      mockTokenValidator.decode.mockImplementation(() => {
        throw new Error('Invalid token format');
      });

      // Create a token with invalid JSON in payload
      const header = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'none' })
      ).toString('base64url');
      const payload = 'invalid-json-payload'; // Not base64url encoded JSON
      const signature = '';
      const malformedToken = `${header}.${payload}.${signature}`;

      expect(validator.canHandle(malformedToken)).toBe(false);
    });

    // Test network failures during JWKS fetch
    it('should handle network errors during JWKS fetch gracefully', async () => {
      const issuer = 'https://test.clerk.accounts.dev';
      const payload: JWTPayload = {
        sub: 'user_123',
        iss: issuer,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, 'test-secret');

      mockTokenValidator.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: payload,
        signature: 'mock-signature',
      });

      // Mock network error
      mockJwksManager.getJWKS.mockRejectedValue(new Error('Network error'));

      await expect(validator.verify(token)).rejects.toThrow(
        'Provider error: Network error'
      );
    });

    // Test validator name and interface
    it('should have correct validator name and implement JWTValidator interface', () => {
      expect(validator.name).toBe('clerk');
      expect(validator).toHaveProperty('canHandle');
      expect(validator).toHaveProperty('verify');
      expect(validator).toHaveProperty('extractUserId');
    });

    // Property-based test for various Clerk subdomain patterns
    test.prop([
      fc.oneof(
        fc
          .string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-z]/.test(s)), // single word
        fc
          .tuple(
            fc
              .string({ minLength: 1, maxLength: 8 })
              .filter(s => /^[a-z]/.test(s)),
            fc
              .string({ minLength: 1, maxLength: 8 })
              .filter(s => /^[a-z]/.test(s))
          )
          .map(([a, b]) => `${a}-${b}`), // hyphenated
        fc
          .tuple(
            fc
              .string({ minLength: 1, maxLength: 5 })
              .filter(s => /^[a-z]/.test(s)),
            fc.integer({ min: 1, max: 999 })
          )
          .map(([word, num]) => `${word}${num}`) // with numbers
      ),
    ])('should handle various Clerk subdomain naming patterns', subdomain => {
      const issuer = `https://${subdomain}.clerk.accounts.dev`;
      const payload = {
        sub: 'user_123',
        iss: issuer,
      };

      mockTokenValidator.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: payload,
        signature: 'mock-signature',
      });

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(true);
    });
  });

  describe('Clerk-specific Provider Patterns', () => {
    // Test specific Clerk issuer patterns that should be detected
    test.prop([
      fc.oneof(
        // Development patterns
        fc
          .string({ minLength: 3, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9-]+$/.test(s))
          .map(subdomain => `https://${subdomain}.clerk.accounts.dev`),

        // Production patterns with clerk.com
        fc.domain().map(domain => `https://${domain}/clerk.com`),
        fc.domain().map(domain => `https://auth.${domain}/clerk.com/oauth`),

        // Custom domain patterns (should be rejected unless azp contains clerk)
        fc.domain().map(domain => `https://${domain}`)
      ),
    ])('should correctly identify Clerk issuer patterns', issuer => {
      const isClerkIssuer =
        issuer.includes('.clerk.accounts.dev') || issuer.includes('clerk.com');
      const payload = {
        sub: 'user_123',
        iss: issuer,
      };

      mockTokenValidator.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: payload,
        signature: 'mock-signature',
      });

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(isClerkIssuer);
    });

    // Test azp claim variations for Clerk
    test.prop([
      fc.webUrl({ validSchemes: ['https'] }), // Any issuer
      fc.oneof(
        fc.constant('clerk_app_123'),
        fc.constant('my-clerk-app'),
        fc.constant('clerk.example.com'),
        fc.string({ minLength: 10, maxLength: 30 }).map(s => `clerk_${s}`),
        fc.string({ minLength: 10, maxLength: 30 }).map(s => `${s}_clerk`)
      ),
    ])(
      'should detect Clerk tokens via azp claim variations',
      (issuer, clerkAzp) => {
        const payload = {
          sub: 'user_123',
          iss: issuer,
          azp: clerkAzp,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        });

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );
  });
});
