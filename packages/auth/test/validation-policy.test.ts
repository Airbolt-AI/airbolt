import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { ValidationPolicy } from '../src/utils/validation-policy.js';
import { AuthError } from '../src/types.js';

describe('ValidationPolicy', () => {
  describe('validateIssuer', () => {
    it('should reject non-HTTPS issuers', () => {
      const policy = new ValidationPolicy({ isProduction: false });

      expect(() => policy.validateIssuer('http://auth.example.com')).toThrow(
        AuthError
      );
      expect(() => policy.validateIssuer('auth.example.com')).toThrow(
        AuthError
      );
      expect(() => policy.validateIssuer(undefined)).toThrow(AuthError);
    });

    it('should accept HTTPS issuers', () => {
      const policy = new ValidationPolicy({ isProduction: false });

      expect(() =>
        policy.validateIssuer('https://auth.example.com')
      ).not.toThrow();
    });

    it('should enforce configured issuer when set', () => {
      const policy = new ValidationPolicy({
        issuer: 'https://auth.example.com',
        isProduction: true,
      });

      expect(() =>
        policy.validateIssuer('https://auth.example.com')
      ).not.toThrow();
      expect(() => policy.validateIssuer('https://other.example.com')).toThrow(
        AuthError
      );
    });
  });

  describe('canHandleIssuer', () => {
    test.prop([
      fc.boolean(), // isProduction
      fc.option(fc.webUrl().filter(url => url.startsWith('https://'))), // configured issuer
      fc.option(fc.webUrl()), // token issuer
    ])(
      'should correctly determine if issuer can be handled',
      (isProduction, configuredIssuer, tokenIssuer) => {
        const validationConfig: {
          issuer?: string;
          audience?: string;
          isProduction: boolean;
        } = { isProduction };
        if (configuredIssuer) validationConfig.issuer = configuredIssuer;
        const policy = new ValidationPolicy(validationConfig);

        const canHandle = policy.canHandleIssuer(tokenIssuer || undefined);

        if (isProduction && configuredIssuer) {
          // In production with configured issuer, only handle matching tokens
          expect(canHandle).toBe(tokenIssuer === configuredIssuer);
        } else if (isProduction && !configuredIssuer) {
          // In production without configured issuer, don't handle any tokens
          expect(canHandle).toBe(false);
        } else {
          // In development, accept any HTTPS issuer
          expect(canHandle).toBe(
            !!tokenIssuer && tokenIssuer.startsWith('https://')
          );
        }
      }
    );
  });

  describe('validateAudience', () => {
    it('should skip validation when no audience configured', () => {
      const policy = new ValidationPolicy({ isProduction: false });
      const payload = { aud: 'any-audience' };

      expect(() => policy.validateAudience(payload as any)).not.toThrow();
    });

    it('should validate string audience', () => {
      const policy = new ValidationPolicy({
        audience: 'my-api',
        isProduction: false,
      });

      expect(() =>
        policy.validateAudience({ aud: 'my-api' } as any)
      ).not.toThrow();
      expect(() =>
        policy.validateAudience({ aud: 'other-api' } as any)
      ).toThrow(AuthError);
    });

    it('should validate array audience', () => {
      const policy = new ValidationPolicy({
        audience: 'my-api',
        isProduction: false,
      });

      expect(() =>
        policy.validateAudience({ aud: ['my-api', 'other'] } as any)
      ).not.toThrow();
      expect(() =>
        policy.validateAudience({ aud: ['other', 'another'] } as any)
      ).toThrow(AuthError);
    });
  });

  describe('isOpaqueToken', () => {
    it('should detect Auth0 opaque tokens', () => {
      const policy = new ValidationPolicy({ isProduction: false });

      // Opaque token: Auth0 issuer with no audience
      expect(
        policy.isOpaqueToken({
          iss: 'https://tenant.auth0.com/',
          azp: 'client-id',
        } as any)
      ).toBe(true);

      // Opaque token: Auth0 issuer with audience matching azp
      expect(
        policy.isOpaqueToken({
          iss: 'https://tenant.auth0.com/',
          aud: 'client-id',
          azp: 'client-id',
        } as any)
      ).toBe(true);

      // Valid token: Auth0 issuer with different audience
      expect(
        policy.isOpaqueToken({
          iss: 'https://tenant.auth0.com/',
          aud: 'https://api.example.com',
          azp: 'client-id',
        } as any)
      ).toBe(false);

      // Non-Auth0 token
      expect(
        policy.isOpaqueToken({
          iss: 'https://accounts.google.com',
          aud: 'client-id',
          azp: 'client-id',
        } as any)
      ).toBe(false);
    });
  });

  describe('validateClaims', () => {
    it('should require user identification claims', () => {
      const policy = new ValidationPolicy({ isProduction: false });

      // Valid: has sub
      expect(() =>
        policy.validateClaims({ sub: 'user-123' } as any)
      ).not.toThrow();

      // Valid: has email
      expect(() =>
        policy.validateClaims({ email: 'user@example.com' } as any)
      ).not.toThrow();

      // Valid: has user_id
      expect(() =>
        policy.validateClaims({ user_id: 'user-123' } as any)
      ).not.toThrow();

      // Invalid: no user identification
      expect(() => policy.validateClaims({} as any)).toThrow(AuthError);
    });

    it('should validate token expiry', () => {
      const policy = new ValidationPolicy({ isProduction: false });
      const now = Math.floor(Date.now() / 1000);

      // Valid: future expiry
      expect(() =>
        policy.validateClaims({
          sub: 'user-123',
          exp: now + 3600,
        } as any)
      ).not.toThrow();

      // Invalid: past expiry
      expect(() =>
        policy.validateClaims({
          sub: 'user-123',
          exp: now - 3600,
        } as any)
      ).toThrow(AuthError);
    });
  });
});
