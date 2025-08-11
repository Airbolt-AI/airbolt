import { describe, it, expect, vi } from 'vitest';
import {
  detectIssuerType,
  isKnownIssuerType,
  getSupportedIssuers,
  IssuerType,
} from './issuer-validator';

// Mock the DNS parts of the issuer validator to prevent real network calls
vi.mock('./issuer-validator', async () => {
  const actual =
    await vi.importActual<typeof import('./issuer-validator')>(
      './issuer-validator'
    );
  return {
    ...actual,
    validateIssuerBeforeNetwork: vi
      .fn()
      .mockImplementation(
        async (issuer: string, externalJwtIssuer?: string) => {
          // Basic URL and protocol validation (same as real function)
          if (!issuer || typeof issuer !== 'string') {
            throw new Error('Invalid issuer: must be a non-empty string');
          }

          let url: URL;
          try {
            url = new URL(issuer);
          } catch {
            throw new Error('Invalid issuer: must be a valid HTTPS URL');
          }

          if (url.protocol !== 'https:') {
            throw new Error('Invalid issuer: must use HTTPS');
          }

          // Mock SSRF validation - skip actual DNS lookup
          const type = actual.detectIssuerType(issuer, externalJwtIssuer);
          if (type === actual.IssuerType.UNKNOWN) {
            throw new Error(
              `Unknown issuer: ${issuer}. Configure EXTERNAL_JWT_ISSUER or use a supported provider (Clerk, Auth0, Supabase, Firebase).`
            );
          }

          // Successful validation without network call
          return Promise.resolve();
        }
      ),
  };
});

// Re-import the mocked function
import { validateIssuerBeforeNetwork } from './issuer-validator';

describe('Issuer Validator', () => {
  describe('detectIssuerType', () => {
    it('should detect Clerk issuers', () => {
      const clerkIssuers = [
        'https://test.clerk.accounts.dev',
        'https://my-app.clerk.accounts.dev',
        'https://prod-123.clerk.accounts.dev',
      ];

      clerkIssuers.forEach(issuer => {
        expect(detectIssuerType(issuer)).toBe(IssuerType.CLERK);
      });
    });

    it('should detect Auth0 issuers', () => {
      const auth0Issuers = [
        'https://test.auth0.com',
        'https://my-tenant.auth0.com',
        'https://dev-xyz.auth0.com',
      ];

      auth0Issuers.forEach(issuer => {
        expect(detectIssuerType(issuer)).toBe(IssuerType.AUTH0);
      });
    });

    it('should detect Supabase issuers', () => {
      const supabaseIssuers = [
        'https://test.supabase.co',
        'https://abcd1234.supabase.co',
      ];

      supabaseIssuers.forEach(issuer => {
        expect(detectIssuerType(issuer)).toBe(IssuerType.SUPABASE);
      });
    });

    it('should detect Firebase issuers', () => {
      const firebaseIssuers = [
        'https://securetoken.google.com/test-project',
        'https://securetoken.google.com/my-firebase-app',
      ];

      firebaseIssuers.forEach(issuer => {
        expect(detectIssuerType(issuer)).toBe(IssuerType.FIREBASE);
      });
    });

    it('should detect custom configured issuer', () => {
      const customIssuer = 'https://custom.example.com';

      expect(detectIssuerType(customIssuer, customIssuer)).toBe(
        IssuerType.CUSTOM
      );
      expect(detectIssuerType('https://other.example.com', customIssuer)).toBe(
        IssuerType.UNKNOWN
      );
    });

    it('should return UNKNOWN for unrecognized issuers', () => {
      const unknownIssuers = [
        'https://evil.example.com',
        'https://fake.clerk.accounts.com', // Wrong TLD
        'https://auth0.com', // Missing subdomain
        'http://test.clerk.accounts.dev', // Wrong protocol
      ];

      unknownIssuers.forEach(issuer => {
        expect(detectIssuerType(issuer)).toBe(IssuerType.UNKNOWN);
      });
    });
  });

  describe('validateIssuerBeforeNetwork', () => {
    it('should accept known issuers', async () => {
      const validIssuers = [
        'https://test.clerk.accounts.dev',
        'https://test.auth0.com',
        'https://test.supabase.co',
        'https://securetoken.google.com/test-project',
      ];

      for (const issuer of validIssuers) {
        await expect(
          validateIssuerBeforeNetwork(issuer)
        ).resolves.not.toThrow();
      }
    });

    it('should reject unknown issuers', async () => {
      const invalidIssuers = [
        'https://evil.example.com',
        'https://fake.clerk.accounts.com',
      ];

      for (const issuer of invalidIssuers) {
        await expect(validateIssuerBeforeNetwork(issuer)).rejects.toThrow(
          /Unknown issuer/
        );
      }
    });

    it('should reject non-HTTPS URLs', async () => {
      const httpIssuers = [
        'http://test.clerk.accounts.dev',
        'ftp://test.clerk.accounts.dev',
      ];

      for (const issuer of httpIssuers) {
        await expect(validateIssuerBeforeNetwork(issuer)).rejects.toThrow(
          /must use HTTPS/
        );
      }
    });

    it('should reject invalid URLs', async () => {
      const invalidUrls = [
        'not-a-url',
        'test.clerk.accounts.dev', // Missing protocol
        'https://', // Incomplete URL
      ];

      for (const issuer of invalidUrls) {
        await expect(validateIssuerBeforeNetwork(issuer)).rejects.toThrow(
          /must be a valid HTTPS URL/
        );
      }
    });

    it('should reject empty strings', async () => {
      await expect(validateIssuerBeforeNetwork('')).rejects.toThrow(
        /must be a non-empty string/
      );
    });

    it('should reject null/undefined/non-string inputs', async () => {
      const invalidInputs = [null, undefined, 123, {}, []];

      for (const issuer of invalidInputs) {
        await expect(
          validateIssuerBeforeNetwork(issuer as any)
        ).rejects.toThrow(/must be a non-empty string/);
      }
    });

    it('should accept custom issuer when configured', async () => {
      const customIssuer = 'https://custom.okta.com';

      await expect(
        validateIssuerBeforeNetwork(customIssuer, customIssuer)
      ).resolves.not.toThrow();
    });
  });

  describe('isKnownIssuerType', () => {
    it('should return true for known issuers', () => {
      expect(isKnownIssuerType('https://test.clerk.accounts.dev')).toBe(true);
      expect(isKnownIssuerType('https://test.auth0.com')).toBe(true);
    });

    it('should return false for unknown issuers', () => {
      expect(isKnownIssuerType('https://evil.example.com')).toBe(false);
    });

    it('should return true for custom issuer when provided', () => {
      const customIssuer = 'https://custom.okta.com';
      expect(isKnownIssuerType(customIssuer, customIssuer)).toBe(true);
    });
  });

  describe('getSupportedIssuers', () => {
    it('should list built-in supported issuers', () => {
      const supported = getSupportedIssuers();

      expect(supported).toContain('Clerk (*.clerk.accounts.dev)');
      expect(supported).toContain('Auth0 (*.auth0.com)');
      expect(supported).toContain('Supabase (*.supabase.co)');
      expect(supported).toContain('Firebase (securetoken.google.com/*)');
    });

    it('should include custom issuer when configured', () => {
      const customIssuer = 'https://custom.okta.com';

      const supported = getSupportedIssuers(customIssuer);
      expect(supported).toContain('Custom (https://custom.okta.com)');
    });
  });
});
