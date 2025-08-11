import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createCustomOIDCProvider,
  isCustomOIDCClaims,
  getOIDCPreferredIdentifier,
  hasOIDCProfile,
} from './custom-oidc-provider.js';
import type {
  VerifyContext,
  CustomOIDCJWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { FastifyLoggerInstance } from 'fastify';
import { createHash } from 'node:crypto';

describe('CustomOIDCProvider', () => {
  let provider: AuthProvider;
  let mockContext: VerifyContext;
  let mockLogger: Partial<FastifyLoggerInstance>;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockContext = {
      jwksCache: {
        getOrCreate: vi.fn().mockReturnValue(vi.fn()),
        clear: vi.fn(),
        size: vi.fn().mockReturnValue(0),
        has: vi.fn().mockReturnValue(false),
      },
      logger: mockLogger as FastifyLoggerInstance,
      config: {} as any,
    };

    // Clear environment variables
    delete process.env['EXTERNAL_JWT_ISSUER'];
    delete process.env['EXTERNAL_JWT_AUDIENCE'];

    provider = createCustomOIDCProvider();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env['EXTERNAL_JWT_ISSUER'];
    delete process.env['EXTERNAL_JWT_AUDIENCE'];
  });

  describe('constructor and configuration', () => {
    it('should create provider with correct name and priority', () => {
      expect(provider.name).toBe('custom-oidc');
      expect(provider.priority).toBe(100);
    });

    it('should validate configuration on construction', () => {
      expect(() => createCustomOIDCProvider()).not.toThrow();
    });
  });

  describe('canHandle', () => {
    it('should handle configured issuer', () => {
      expect(provider.canHandle('https://oidc.example.com')).toBe(true);
    });

    it('should handle environment variable issuer', () => {
      process.env['EXTERNAL_JWT_ISSUER'] = 'https://env.example.com';

      expect(provider.canHandle('https://env.example.com')).toBe(true);
    });

    it('should prioritize config over environment', () => {
      process.env['EXTERNAL_JWT_ISSUER'] = 'https://env.example.com';

      expect(provider.canHandle('https://oidc.example.com')).toBe(true);
      expect(provider.canHandle('https://env.example.com')).toBe(true);
    });

    it('should reject unmatched issuers', () => {
      expect(provider.canHandle('https://other.example.com')).toBe(false);
      expect(provider.canHandle('')).toBe(false);
      expect(provider.canHandle(null as any)).toBe(false);
    });
  });

  describe('verify', () => {
    const validToken = createTestJWT({
      iss: 'https://oidc.example.com',
      sub: 'oidc-user-123',
      aud: 'my-app',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      preferred_username: 'johndoe',
      email: 'john@example.com',
      picture: 'https://example.com/avatar.jpg',
      custom_claim: 'custom_value',
      'https://example.com/role': 'admin',
    });

    beforeEach(() => {
      // Mock the base provider methods
      vi.spyOn(provider as any, 'validateTokenFormat').mockReturnValue({
        header: { alg: 'RS256', typ: 'JWT', kid: 'oidc-key' },
        payload: {
          iss: 'https://oidc.example.com',
          sub: 'oidc-user-123',
          aud: 'my-app',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        signature: 'signature',
      });

      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://oidc.example.com'
      );
      vi.spyOn(provider as any, 'getVerificationKey').mockResolvedValue(
        'mock-key' as any
      );
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://oidc.example.com',
        sub: 'oidc-user-123',
        aud: 'my-app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        preferred_username: 'johndoe',
        email: 'john@example.com',
        picture: 'https://example.com/avatar.jpg',
        custom_claim: 'custom_value',
        'https://example.com/role': 'admin',
      });
    });

    it('should successfully verify valid OIDC token', async () => {
      const claims = await provider.verify(validToken, mockContext);

      expect(claims).toMatchObject({
        iss: 'https://oidc.example.com',
        sub: 'oidc-user-123',
        aud: 'my-app',
        name: 'John Doe',
        preferred_username: 'johndoe',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_token_exchange_success',
          provider: 'custom-oidc',
        }),
        expect.stringContaining('successful')
      );
    });

    it('should extract OIDC-specific claims', async () => {
      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as CustomOIDCJWTClaims;

      expect(claims.name).toBe('John Doe');
      expect(claims.given_name).toBe('John');
      expect(claims.family_name).toBe('Doe');
      expect(claims.preferred_username).toBe('johndoe');
      expect(claims.email).toBe('john@example.com');
      expect(claims.picture).toBe('https://example.com/avatar.jpg');
      expect(claims['custom_claim']).toBe('custom_value');
      expect(claims['https://example.com/role']).toBe('admin');
    });

    it('should handle tokens without optional claims', async () => {
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://oidc.example.com',
        sub: 'oidc-user-123',
        aud: 'my-app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as CustomOIDCJWTClaims;

      expect(claims.name).toBeUndefined();
      expect(claims.given_name).toBeUndefined();
      expect(claims.preferred_username).toBeUndefined();
    });

    it('should throw error for unmatched issuer', async () => {
      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://other.example.com'
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_jwt_verification_failure',
          provider: 'custom-oidc',
        }),
        expect.stringContaining('failed')
      );
    });

    it('should handle verification errors', async () => {
      vi.spyOn(provider as any, 'performJWTVerification').mockRejectedValue(
        new Error('Token verification failed')
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      expect(() => createCustomOIDCProvider()).not.toThrow();
    });

    it('should require custom provider type', () => {
      expect(() => createCustomOIDCProvider()).toThrow(
        'provider set to "custom"'
      );
    });

    it('should require issuer or environment variable', () => {
      expect(() => createCustomOIDCProvider()).toThrow(
        'config.issuer or EXTERNAL_JWT_ISSUER'
      );
    });

    it('should accept environment variable issuer', () => {
      process.env['EXTERNAL_JWT_ISSUER'] = 'https://env.example.com';

      expect(() => createCustomOIDCProvider()).not.toThrow();
    });

    it('should validate issuer URL format', () => {
      expect(() => createCustomOIDCProvider()).toThrow('valid URL');
    });

    it('should validate environment issuer URL format', () => {
      process.env['EXTERNAL_JWT_ISSUER'] = 'not-a-url';

      expect(() => createCustomOIDCProvider()).toThrow('valid URL');
    });

    it('should validate JWKS URI format', () => {
      expect(() => createCustomOIDCProvider()).toThrow('valid URL');
    });

    it('should validate audience format', () => {
      expect(() => createCustomOIDCProvider()).toThrow('non-empty string');
    });

    it('should require verification method', () => {
      expect(() => createCustomOIDCProvider()).toThrow(
        'jwksUri, publicKey, or secret'
      );
    });

    it('should validate public key format', () => {
      expect(() => createCustomOIDCProvider()).toThrow('PEM format');
    });

    it('should validate secret length', () => {
      expect(() => createCustomOIDCProvider()).toThrow(
        'at least 32 characters'
      );
    });
  });

  describe('environment variable configuration', () => {
    it('should use environment issuer when config issuer not provided', () => {
      process.env['EXTERNAL_JWT_ISSUER'] = 'https://env.example.com';

      const envProvider = createCustomOIDCProvider();
      expect(envProvider.canHandle('https://env.example.com')).toBe(true);
    });

    it('should use environment variables for configuration', () => {
      process.env['EXTERNAL_JWT_AUDIENCE'] = 'env-audience';

      const envProvider = createCustomOIDCProvider();
      expect(envProvider).toBeDefined();
      expect(envProvider.name).toBe('custom-oidc');
    });
  });

  describe('factory function', () => {
    it('should create CustomOIDCProvider instance', () => {
      const provider = createCustomOIDCProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.verify).toBe('function');
      expect(provider.name).toBe('custom-oidc');
    });
  });

  describe('type guards and helpers', () => {
    const oidcClaims: CustomOIDCJWTClaims = {
      iss: 'https://oidc.example.com',
      sub: 'user-123',
      aud: 'my-app',
      exp: Date.now() + 3600,
      iat: Date.now(),
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      preferred_username: 'johndoe',
      email: 'john@example.com',
      picture: 'https://example.com/avatar.jpg',
      custom_field: 'custom_value',
    };

    describe('isCustomOIDCClaims', () => {
      it('should identify OIDC claims by profile fields', () => {
        expect(isCustomOIDCClaims(oidcClaims)).toBe(true);
      });

      it('should identify claims by individual profile fields', () => {
        const claimsWithGivenName = { ...oidcClaims, given_name: 'John' };
        delete (claimsWithGivenName as any).name;
        expect(isCustomOIDCClaims(claimsWithGivenName)).toBe(true);

        const claimsWithPreferredUsername = {
          ...oidcClaims,
          preferred_username: 'johndoe',
        };
        delete (claimsWithPreferredUsername as any).name;
        delete (claimsWithPreferredUsername as any).given_name;
        expect(isCustomOIDCClaims(claimsWithPreferredUsername)).toBe(true);
      });

      it('should reject non-OIDC claims', () => {
        const basicClaims = {
          iss: 'https://example.com',
          sub: '123',
          aud: 'api',
          exp: Date.now() + 3600,
          iat: Date.now(),
        };
        expect(isCustomOIDCClaims(basicClaims)).toBe(false);
      });
    });

    describe('getOIDCPreferredIdentifier', () => {
      it('should prioritize preferred_username', () => {
        expect(getOIDCPreferredIdentifier(oidcClaims)).toBe('johndoe');
      });

      it('should fall back to email', () => {
        const claimsWithoutUsername = { ...oidcClaims };
        delete (claimsWithoutUsername as any).preferred_username;
        expect(getOIDCPreferredIdentifier(claimsWithoutUsername)).toBe(
          'john@example.com'
        );
      });

      it('should fall back to name', () => {
        const claimsWithoutUsernameOrEmail = { ...oidcClaims };
        delete (claimsWithoutUsernameOrEmail as any).preferred_username;
        delete (claimsWithoutUsernameOrEmail as any).email;
        expect(getOIDCPreferredIdentifier(claimsWithoutUsernameOrEmail)).toBe(
          'John Doe'
        );
      });

      it('should fall back to sub', () => {
        const claimsWithMinimalInfo = { ...oidcClaims };
        delete (claimsWithMinimalInfo as any).preferred_username;
        delete (claimsWithMinimalInfo as any).email;
        delete (claimsWithMinimalInfo as any).name;
        expect(getOIDCPreferredIdentifier(claimsWithMinimalInfo)).toBe(
          'user-123'
        );
      });
    });

    describe('hasOIDCProfile', () => {
      it('should detect profile information', () => {
        expect(hasOIDCProfile(oidcClaims)).toBe(true);
      });

      it('should handle minimal profile information', () => {
        const minimalProfile = { ...oidcClaims };
        delete (minimalProfile as any).name;
        delete (minimalProfile as any).given_name;
        delete (minimalProfile as any).family_name;
        delete (minimalProfile as any).picture;
        delete (minimalProfile as any).profile;
        expect(hasOIDCProfile(minimalProfile)).toBe(true); // Still has preferred_username
      });

      it('should detect lack of profile information', () => {
        const noProfile = {
          iss: 'https://oidc.example.com',
          sub: 'user-123',
          aud: 'my-app',
          exp: Date.now() + 3600,
          iat: Date.now(),
        };
        expect(hasOIDCProfile(noProfile)).toBe(false);
      });
    });
  });
});

/**
 * Helper function to create test JWT tokens
 */
function createTestJWT(payload: Record<string, any>): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'oidc-key' };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url'
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );

  // Create a simple signature hash for testing
  const signature = createHash('sha256')
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
