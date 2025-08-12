import { describe, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { ValidationPolicy } from '../src/utils/validation-policy.js';
import { AuthError } from '../src/types.js';

describe('ValidationPolicy', () => {
  describe('validateIssuer', () => {
    test.prop([
      fc.oneof(
        fc.webUrl().filter(url => !url.startsWith('https://')),
        fc.string().filter(s => !s.startsWith('https://')),
        fc.constantFrom(
          'http://auth.example.com',
          'auth.example.com',
          'ftp://auth.com'
        ),
        fc.constant(undefined),
        fc.constant(null)
      ),
    ])('should reject any non-HTTPS issuer', nonHttpsIssuer => {
      const policy = new ValidationPolicy({ isProduction: false });
      expect(() => policy.validateIssuer(nonHttpsIssuer as any)).toThrow(
        AuthError
      );
    });

    test.prop([fc.webUrl().filter(url => url.startsWith('https://'))])(
      'should accept any HTTPS issuer in development',
      httpsIssuer => {
        const policy = new ValidationPolicy({ isProduction: false });
        expect(() => policy.validateIssuer(httpsIssuer)).not.toThrow();
      }
    );

    test.prop([
      fc.webUrl().filter(url => url.startsWith('https://')), // configured issuer
      fc.webUrl().filter(url => url.startsWith('https://')), // token issuer
    ])(
      'should enforce exact issuer match when configured',
      (configuredIssuer, tokenIssuer) => {
        const policy = new ValidationPolicy({
          issuer: configuredIssuer,
          isProduction: true,
        });

        if (configuredIssuer === tokenIssuer) {
          expect(() => policy.validateIssuer(tokenIssuer)).not.toThrow();
        } else {
          expect(() => policy.validateIssuer(tokenIssuer)).toThrow(AuthError);
        }
      }
    );
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
    test.prop([
      fc.oneof(
        fc.string(),
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
        fc.constant(undefined)
      ),
    ])('should skip validation when no audience configured', tokenAudience => {
      const policy = new ValidationPolicy({ isProduction: false });
      const payload = tokenAudience !== undefined ? { aud: tokenAudience } : {};
      expect(() => policy.validateAudience(payload as any)).not.toThrow();
    });

    test.prop([
      fc.string({ minLength: 1, maxLength: 50 }), // configured audience
      fc.oneof(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 1,
          maxLength: 5,
        })
      ), // token audience
    ])(
      'should validate audience match correctly',
      (configuredAudience, tokenAudience) => {
        const policy = new ValidationPolicy({
          audience: configuredAudience,
          isProduction: false,
        });

        const payload = { aud: tokenAudience };
        const shouldPass =
          typeof tokenAudience === 'string'
            ? tokenAudience === configuredAudience
            : Array.isArray(tokenAudience) &&
              tokenAudience.includes(configuredAudience);

        if (shouldPass) {
          expect(() => policy.validateAudience(payload as any)).not.toThrow();
        } else {
          expect(() => policy.validateAudience(payload as any)).toThrow(
            AuthError
          );
        }
      }
    );
  });

  describe('isOpaqueToken', () => {
    test.prop([
      fc.string({ minLength: 1, maxLength: 50 }), // tenant name
      fc.option(fc.string({ minLength: 1, maxLength: 50 })), // audience
      fc.string({ minLength: 1, maxLength: 50 }), // azp/client id
    ])(
      'should detect Auth0 opaque tokens correctly',
      (tenant, audience, clientId) => {
        const policy = new ValidationPolicy({ isProduction: false });
        const auth0Issuer = `https://${tenant}.auth0.com/`;

        const payload: any = {
          iss: auth0Issuer,
          azp: clientId,
        };
        if (audience !== null) {
          payload.aud = audience;
        }

        const isOpaque = policy.isOpaqueToken(payload);
        const expectedOpaque = !audience || audience === clientId;
        expect(isOpaque).toBe(expectedOpaque);
      }
    );

    test.prop([
      fc.webUrl().filter(url => !url.includes('auth0.com')), // non-Auth0 issuer
      fc.option(fc.string()), // audience
      fc.option(fc.string()), // azp
    ])(
      'should never detect non-Auth0 tokens as opaque',
      (issuer, audience, azp) => {
        const policy = new ValidationPolicy({ isProduction: false });
        const payload: any = { iss: issuer };
        if (audience !== null) payload.aud = audience;
        if (azp !== null) payload.azp = azp;

        expect(policy.isOpaqueToken(payload)).toBe(false);
      }
    );
  });

  describe('validateClaims', () => {
    test.prop([
      fc.record({
        sub: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        email: fc.option(fc.string().filter(s => s.includes('@'))),
        user_id: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        exp: fc.option(fc.integer()),
        iat: fc.option(fc.integer()),
        // Additional arbitrary claims
        other: fc.option(fc.string()),
      }),
    ])('should validate user identification and expiry correctly', claims => {
      const policy = new ValidationPolicy({ isProduction: false });
      const now = Math.floor(Date.now() / 1000);

      const hasUserClaim = !!(claims.sub || claims.email || claims.user_id);
      const isExpired =
        claims.exp !== null && claims.exp !== undefined && claims.exp < now;

      if (!hasUserClaim || isExpired) {
        expect(() => policy.validateClaims(claims as any)).toThrow(AuthError);
      } else {
        expect(() => policy.validateClaims(claims as any)).not.toThrow();
      }
    });

    test.prop([
      fc.constantFrom('sub', 'email', 'user_id'),
      fc
        .string({ minLength: 1, maxLength: 100 })
        .filter(s => s.trim().length > 0),
      fc.integer({ min: -86400, max: 86400 }), // +/- 1 day from now
    ])(
      'should accept any token with valid user identification and future expiry',
      (userClaimType, userClaimValue, expiryOffset) => {
        const policy = new ValidationPolicy({ isProduction: false });
        const now = Math.floor(Date.now() / 1000);
        const exp = now + expiryOffset;

        const claims: any = { exp };
        claims[userClaimType] = userClaimValue;

        // Tokens expired in the past (offset < 0) should be rejected
        // Tokens expiring exactly now (offset == 0) are still valid
        if (expiryOffset >= 0) {
          expect(() => policy.validateClaims(claims)).not.toThrow();
        } else {
          expect(() => policy.validateClaims(claims)).toThrow(AuthError);
        }
      }
    );
  });
});
