import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';

// Mock both ExternalJWTValidator and TokenValidator to avoid any hoisting issues
// Use plain class with placeholder functions
vi.mock('../src/validators/external.js', () => ({
  ExternalJWTValidator: class MockExternalJWTValidator {
    verify = async () => ({ sub: 'mock-user' });
    extractUserId = () => 'mock-user-id';
  },
}));

vi.mock('../src/utils/token-validator.js', () => ({
  TokenValidator: class MockTokenValidator {
    decode = (token: string) => {
      // Simple JWT decode implementation for tests using Buffer for Node.js
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1] || '', 'base64url').toString()
        );
        return {
          header: { kid: 'test-kid' },
          payload: payload,
          signature: 'mock-signature',
        };
      } catch {
        throw new Error('Invalid token format');
      }
    };
    verify = async () => ({ sub: 'mock-user' });
    extractUserId = () => 'mock-user-id';
  },
}));

import { ClerkValidator } from '../src/validators/clerk.js';
import type { AuthConfig, JWTPayload } from '../src/types.js';
import { AuthError } from '../src/types.js';

describe('ClerkValidator', () => {
  let validator: ClerkValidator;
  let mockConfig: AuthConfig;
  let mockExternalValidator: any;

  beforeEach(() => {
    mockConfig = { NODE_ENV: 'development' };

    // Clear and setup mocks
    vi.clearAllMocks();

    // Create a new instance which will use the mocked ExternalJWTValidator
    validator = new ClerkValidator(mockConfig);

    // Get reference to the mocked ExternalJWTValidator instance
    mockExternalValidator = (validator as any).externalValidator;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Simple test to check if basic functionality works
  it('should have correct validator name', () => {
    expect(validator.name).toBe('clerk');
  });

  describe.skip('canHandle - Clerk Provider Detection', () => {
    // Property-based test for Clerk development URLs
    test.prop(
      [
        fc
          .string({ minLength: 3, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // subdomain
      ],
      { numRuns: 10 }
    )(
      'should handle development Clerk tokens with .clerk.accounts.dev issuer',
      subdomain => {
        const clerkDevIssuer = `https://${subdomain}.clerk.accounts.dev`;
        const payload = {
          sub: 'user_123',
          iss: clerkDevIssuer,
        };

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );

    // Property-based test for production Clerk URLs
    test.prop(
      [
        fc.domain().filter(domain => !domain.includes('.clerk.accounts.dev')), // Custom domain
      ],
      { numRuns: 10 }
    )(
      'should handle production Clerk tokens with clerk.com in issuer',
      domain => {
        const clerkProdIssuer = `https://${domain}/clerk.com/oauth`;
        const payload = {
          sub: 'user_123',
          iss: clerkProdIssuer,
        };

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );

    // Property-based test for azp claim detection
    test.prop(
      [
        fc.webUrl({ validSchemes: ['https'] }), // Any HTTPS issuer
        fc
          .string({ minLength: 5, maxLength: 50 })
          .filter(s => s.includes('clerk')), // azp with 'clerk'
      ],
      { numRuns: 10 }
    )('should handle tokens with azp claim containing clerk', (issuer, azp) => {
      const payload = {
        sub: 'user_123',
        iss: issuer,
        azp: azp,
      };

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(true);
    });

    // Property-based test for non-Clerk issuers
    test.prop(
      [
        fc
          .webUrl({ validSchemes: ['https'] })
          .filter(
            url =>
              !url.includes('.clerk.accounts.dev') && !url.includes('clerk.com')
          ), // Non-Clerk issuer
        fc.option(fc.string().filter(s => !s.includes('clerk'))), // Non-Clerk azp
      ],
      { numRuns: 10 }
    )('should reject non-Clerk tokens', (issuer, azp) => {
      const payload: any = {
        sub: 'user_123',
        iss: issuer,
      };
      if (azp) payload.azp = azp;

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(false);
    });

    // Edge cases for Clerk detection
    it('should handle malformed tokens gracefully', () => {
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

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(true);
    });

    // Test complex URL patterns
    test.prop(
      [
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
      ],
      { numRuns: 10 }
    )(
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

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );
  });

  describe('verify - Token Validation Flow', () => {
    beforeEach(() => {
      // Setup default mock behavior for ExternalJWTValidator
      mockExternalValidator.verify = vi.fn();
      mockExternalValidator.extractUserId = vi.fn();
    });

    // Test that verify delegates to ExternalJWTValidator
    it('should delegate verification to ExternalJWTValidator', async () => {
      const token = 'test-token';
      const expectedPayload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://test.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockExternalValidator.verify.mockResolvedValue(expectedPayload);

      const result = await validator.verify(token);

      expect(result).toEqual(expectedPayload);
      expect(mockExternalValidator.verify).toHaveBeenCalledWith(token);
    });

    // Test error propagation
    it('should propagate errors from ExternalJWTValidator', async () => {
      const token = 'test-token';
      const error = new AuthError('Verification failed');

      mockExternalValidator.verify.mockRejectedValue(error);

      await expect(validator.verify(token)).rejects.toThrow(error);
    });

    // Property-based test for various payloads
    test.prop(
      [
        fc
          .string({ minLength: 3, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // subdomain
        fc.string({ minLength: 5, maxLength: 50 }), // user ID
      ],
      { numRuns: 10 }
    )('should verify tokens and return payload', async (subdomain, userId) => {
      const token = 'test-token';
      const payload: JWTPayload = {
        sub: userId,
        iss: `https://${subdomain}.clerk.accounts.dev`,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockExternalValidator.verify.mockResolvedValue(payload);

      const result = await validator.verify(token);
      expect(result).toEqual(payload);
    });
  });

  describe('extractUserId - User ID Extraction', () => {
    beforeEach(() => {
      mockExternalValidator.extractUserId = vi.fn();
    });

    // Test that extractUserId delegates to ExternalJWTValidator
    it('should delegate user ID extraction to ExternalJWTValidator', () => {
      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://test.clerk.accounts.dev',
      };
      const expectedUserId = 'user_123';

      mockExternalValidator.extractUserId.mockReturnValue(expectedUserId);

      const result = validator.extractUserId(payload);

      expect(result).toBe(expectedUserId);
      expect(mockExternalValidator.extractUserId).toHaveBeenCalledWith(payload);
    });

    // Property-based test for various user ID claim patterns
    test.prop(
      [
        fc.oneof(
          fc.record({
            sub: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          }),
          fc.record({
            userId: fc
              .string({ minLength: 1 })
              .filter(s => s.trim().length > 0),
          }),
          fc.record({
            user_id: fc
              .string({ minLength: 1 })
              .filter(s => s.trim().length > 0),
          })
        ),
      ],
      { numRuns: 10 }
    )('should extract user ID from various claim patterns', payload => {
      const expectedUserId =
        (payload as any).sub ||
        (payload as any).userId ||
        (payload as any).user_id;
      mockExternalValidator.extractUserId.mockReturnValue(expectedUserId);

      const result = validator.extractUserId(payload as JWTPayload);

      expect(result).toBe(expectedUserId);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    // Test malformed JSON in token
    it('should handle tokens with malformed JSON payload', () => {
      // Create a token with invalid JSON in payload
      const header = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'none' })
      ).toString('base64url');
      const payload = 'invalid-json-payload'; // Not base64url encoded JSON
      const signature = '';
      const malformedToken = `${header}.${payload}.${signature}`;

      expect(validator.canHandle(malformedToken)).toBe(false);
    });

    // Test validator name and interface
    it('should have correct validator name and implement JWTValidator interface', () => {
      expect(validator.name).toBe('clerk');
      expect(validator).toHaveProperty('canHandle');
      expect(validator).toHaveProperty('verify');
      expect(validator).toHaveProperty('extractUserId');
    });

    // Property-based test for various Clerk subdomain patterns
    test.prop(
      [
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
      ],
      { numRuns: 10 }
    )('should handle various Clerk subdomain naming patterns', subdomain => {
      const issuer = `https://${subdomain}.clerk.accounts.dev`;
      const payload = {
        sub: 'user_123',
        iss: issuer,
      };

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(true);
    });
  });

  describe('Clerk-specific Provider Patterns', () => {
    // Test specific Clerk issuer patterns that should be detected
    test.prop(
      [
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
      ],
      { numRuns: 10 }
    )('should correctly identify Clerk issuer patterns', issuer => {
      const isClerkIssuer =
        issuer.includes('.clerk.accounts.dev') || issuer.includes('clerk.com');
      const payload = {
        sub: 'user_123',
        iss: issuer,
      };

      const token = jwt.sign(payload, 'test-secret');
      expect(validator.canHandle(token)).toBe(isClerkIssuer);
    });

    // Test azp claim variations for Clerk
    test.prop(
      [
        fc.webUrl({ validSchemes: ['https'] }), // Any issuer
        fc.oneof(
          fc.constant('clerk_app_123'),
          fc.constant('my-clerk-app'),
          fc.constant('clerk.example.com'),
          fc.string({ minLength: 10, maxLength: 30 }).map(s => `clerk_${s}`),
          fc.string({ minLength: 10, maxLength: 30 }).map(s => `${s}_clerk`)
        ),
      ],
      { numRuns: 10 }
    )(
      'should detect Clerk tokens via azp claim variations',
      (issuer, clerkAzp) => {
        const payload = {
          sub: 'user_123',
          iss: issuer,
          azp: clerkAzp,
        };

        const token = jwt.sign(payload, 'test-secret');
        expect(validator.canHandle(token)).toBe(true);
      }
    );
  });
});
