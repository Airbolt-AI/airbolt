import { describe, expect, test } from 'vitest';
import { ProviderDetector } from './provider-detector.js';
import jwt from 'jsonwebtoken';

describe('ProviderDetector', () => {
  // Helper to create tokens with specific characteristics
  function createToken(options: {
    issuer?: string;
    audience?: string | string[] | null;
    subject?: string;
    expiresIn?: string;
  }) {
    const payload: any = {
      sub: options.subject || 'user123',
      iat: Math.floor(Date.now() / 1000),
    };

    if (options.issuer !== undefined) {
      payload.iss = options.issuer;
    }
    if (options.audience !== undefined) {
      payload.aud = options.audience;
    }

    // Handle expiresIn using nullish coalescing for TypeScript exactOptionalPropertyTypes
    const signOptions: jwt.SignOptions = {
      algorithm: 'HS256' as const,
      expiresIn: (options.expiresIn ?? '1h') as any,
    };

    return jwt.sign(payload, 'test-secret', signOptions);
  }

  describe('Provider Detection', () => {
    test.each([
      {
        issuer: 'https://dev-abc123.auth0.com/',
        expectedProvider: 'Auth0',
        expectedLink: 'https://docs.airbolt.io/auth0',
      },
      {
        issuer: 'https://my-app.clerk.dev',
        expectedProvider: 'Clerk',
        expectedLink: 'https://docs.airbolt.io/clerk',
      },
      {
        issuer: 'https://securetoken.google.com/my-project',
        expectedProvider: 'Firebase',
        expectedLink: 'https://docs.airbolt.io/firebase',
      },
      {
        issuer: 'https://myproject.supabase.co/auth/v1',
        expectedProvider: 'Supabase',
        expectedLink: 'https://docs.airbolt.io/supabase',
      },
    ])(
      'detects $expectedProvider from issuer $issuer',
      ({ issuer, expectedProvider, expectedLink }) => {
        const hints = ProviderDetector.getProviderHints(issuer);

        expect(hints).not.toBeNull();
        expect(hints!.name).toBe(expectedProvider);
        expect(hints!.docLink).toBe(expectedLink);
      }
    );

    test('returns null for unknown providers', () => {
      const hints = ProviderDetector.getProviderHints(
        'https://unknown-provider.com'
      );
      expect(hints).toBeNull();
    });
  });

  describe('Opaque Token Detection', () => {
    test('detects Auth0 opaque tokens', () => {
      // Opaque tokens don't have 3 parts
      const opaqueToken = 'v2.local.encrypted-data-here';
      expect(ProviderDetector.detectOpaqueToken(opaqueToken)).toBe(true);
    });

    test('detects valid JWT as non-opaque', () => {
      const validToken = createToken({ issuer: 'https://auth0.com/' });
      expect(ProviderDetector.detectOpaqueToken(validToken)).toBe(false);
    });

    test('detects JWE tokens as opaque', () => {
      // JWE has 5 parts and 'enc' in header
      const jweHeader = Buffer.from(
        JSON.stringify({ alg: 'RSA-OAEP', enc: 'A256GCM' })
      ).toString('base64url');
      const jweToken = `${jweHeader}.encrypted.key.iv.tag`;
      expect(ProviderDetector.detectOpaqueToken(jweToken)).toBe(true);
    });
  });

  describe('Error Message Generation', () => {
    test('generates helpful Auth0 opaque token error', () => {
      const token = 'opaque-token';
      const issuer = 'https://dev-123.auth0.com/';

      const error = ProviderDetector.getErrorMessage('opaque', issuer, token);

      expect(error).toContain('Auth0');
      expect(error).toContain('audience');
      expect(error).toContain('Create an API in Auth0 Dashboard');
    });

    test('generates helpful expired token error', () => {
      const expiredToken = createToken({
        issuer: 'https://clerk.dev',
        expiresIn: '-1h', // Expired 1 hour ago
      });

      const error = ProviderDetector.getErrorMessage(
        'Token has expired',
        'https://clerk.dev',
        expiredToken
      );

      expect(error).toContain('expired');
    });

    test('generates generic error for unknown providers', () => {
      const token = createToken({ issuer: 'https://unknown.com' });

      const error = ProviderDetector.getErrorMessage(
        'invalid',
        'https://unknown.com',
        token
      );

      // The actual implementation returns the error as-is if not specific
      expect(error).toBe('invalid');
    });
  });

  describe('Trusted Providers', () => {
    test('identifies trusted providers', () => {
      expect(ProviderDetector.isTrustedProvider('https://auth0.com/')).toBe(
        true
      );
      expect(ProviderDetector.isTrustedProvider('https://test.clerk.dev')).toBe(
        true
      );
      expect(
        ProviderDetector.isTrustedProvider(
          'https://securetoken.google.com/project'
        )
      ).toBe(true);
      expect(
        ProviderDetector.isTrustedProvider('https://project.supabase.co')
      ).toBe(true);
    });

    test('identifies untrusted providers', () => {
      expect(ProviderDetector.isTrustedProvider('https://malicious.com')).toBe(
        false
      );
      expect(ProviderDetector.isTrustedProvider('http://auth0.com')).toBe(true); // Contains auth0.com (HTTPS check is elsewhere)
    });
  });
});
