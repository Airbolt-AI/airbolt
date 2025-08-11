import { describe, it, expect } from 'vitest';
import {
  detectIssuerType,
  validateIssuerBeforeNetwork,
  isKnownIssuerType,
  getSupportedIssuers,
  IssuerType,
} from './issuer-validator';

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
    it('should accept known issuers', () => {
      const validIssuers = [
        'https://test.clerk.accounts.dev',
        'https://test.auth0.com',
        'https://test.supabase.co',
        'https://securetoken.google.com/test-project',
      ];

      validIssuers.forEach(issuer => {
        expect(() => validateIssuerBeforeNetwork(issuer)).not.toThrow();
      });
    });

    it('should reject unknown issuers', () => {
      const invalidIssuers = [
        'https://evil.example.com',
        'https://fake.clerk.accounts.com',
      ];

      invalidIssuers.forEach(issuer => {
        expect(() => validateIssuerBeforeNetwork(issuer)).toThrow(
          /Unknown issuer/
        );
      });
    });

    it('should reject non-HTTPS URLs', () => {
      const httpIssuers = [
        'http://test.clerk.accounts.dev',
        'ftp://test.clerk.accounts.dev',
      ];

      httpIssuers.forEach(issuer => {
        expect(() => validateIssuerBeforeNetwork(issuer)).toThrow(
          /must use HTTPS/
        );
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'test.clerk.accounts.dev', // Missing protocol
        'https://', // Incomplete URL
      ];

      invalidUrls.forEach(issuer => {
        expect(() => validateIssuerBeforeNetwork(issuer)).toThrow(
          /must be a valid HTTPS URL/
        );
      });
    });

    it('should reject empty strings', () => {
      expect(() => validateIssuerBeforeNetwork('')).toThrow(
        /must be a non-empty string/
      );
    });

    it('should reject null/undefined/non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, {}, []];

      invalidInputs.forEach(issuer => {
        expect(() => validateIssuerBeforeNetwork(issuer as any)).toThrow(
          /must be a non-empty string/
        );
      });
    });

    it('should accept custom issuer when configured', () => {
      const customIssuer = 'https://custom.okta.com';

      expect(() =>
        validateIssuerBeforeNetwork(customIssuer, customIssuer)
      ).not.toThrow();
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
