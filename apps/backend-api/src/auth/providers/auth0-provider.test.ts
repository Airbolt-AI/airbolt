import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAuth0Provider,
  isAuth0Claims,
  extractAuth0Scopes,
  hasAuth0Scope,
} from './auth0-provider.js';
import type {
  Auth0ProviderConfig,
  VerifyContext,
  Auth0JWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { FastifyLoggerInstance } from 'fastify';
import { createHash } from 'node:crypto';

describe('Auth0Provider', () => {
  let provider: AuthProvider;
  let mockContext: VerifyContext;
  let mockLogger: Partial<FastifyLoggerInstance>;

  const defaultConfig: Auth0ProviderConfig = {
    provider: 'auth0' as const,
    domain: 'test-tenant.auth0.com',
  };

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

    provider = createAuth0Provider(defaultConfig);
  });

  describe('constructor and configuration', () => {
    it('should create provider with correct name and priority', () => {
      expect(provider.name).toBe('auth0');
      expect(provider.priority).toBe(20);
    });

    it('should validate configuration on construction', () => {
      expect(() => createAuth0Provider(defaultConfig)).not.toThrow();
    });
  });

  describe('canHandle', () => {
    it('should handle Auth0 domain pattern', () => {
      expect(provider.canHandle('https://test-tenant.auth0.com/')).toBe(true);
      expect(provider.canHandle('https://my-app.us.auth0.com/')).toBe(true);
      expect(provider.canHandle('https://example.eu.auth0.com/')).toBe(true);
    });

    it('should handle configured domain', () => {
      expect(provider.canHandle('https://test-tenant.auth0.com/')).toBe(true);
    });

    it('should handle explicit issuer configuration', () => {
      const configWithIssuer: Auth0ProviderConfig = {
        provider: 'auth0',
        domain: 'test-tenant.auth0.com',
        issuer: 'https://custom-domain.example.com/',
      };
      const customProvider = createAuth0Provider(configWithIssuer);

      expect(
        customProvider.canHandle('https://custom-domain.example.com/')
      ).toBe(true);
    });

    it('should reject non-Auth0 issuers', () => {
      expect(provider.canHandle('https://example.com')).toBe(false);
      expect(provider.canHandle('https://clerk.example.com')).toBe(false);
      expect(provider.canHandle('')).toBe(false);
      expect(provider.canHandle(null as any)).toBe(false);
    });
  });

  describe('verify', () => {
    const validToken = createTestJWT({
      iss: 'https://test-tenant.auth0.com/',
      sub: 'auth0|123456',
      aud: 'https://api.example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      azp: 'abc123',
      scope: 'read:profile write:profile',
      'https://example.com/permissions': ['admin', 'user'],
    });

    beforeEach(() => {
      // Mock the base provider methods
      vi.spyOn(provider as any, 'validateTokenFormat').mockReturnValue({
        header: { alg: 'RS256', kid: 'key1' },
        payload: {
          iss: 'https://test-tenant.auth0.com/',
          sub: 'auth0|123456',
          aud: 'https://api.example.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        signature: 'signature',
      });

      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://test-tenant.auth0.com/'
      );
      vi.spyOn(provider as any, 'getJWKS').mockReturnValue(vi.fn());
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://test-tenant.auth0.com/',
        sub: 'auth0|123456',
        aud: 'https://api.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        azp: 'abc123',
        scope: 'read:profile write:profile',
        'https://example.com/permissions': ['admin', 'user'],
      });
    });

    it('should successfully verify valid Auth0 token', async () => {
      const claims = await provider.verify(validToken, mockContext);

      expect(claims).toMatchObject({
        iss: 'https://test-tenant.auth0.com/',
        sub: 'auth0|123456',
        aud: 'https://api.example.com',
        azp: 'abc123',
        scope: 'read:profile write:profile',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_token_exchange_success',
          provider: 'auth0',
        }),
        expect.stringContaining('successful')
      );
    });

    it('should extract Auth0-specific claims', async () => {
      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as Auth0JWTClaims;

      expect(claims['azp']).toBe('abc123');
      expect(claims.scope).toBe('read:profile write:profile');
      expect(claims.permissions).toEqual(['admin', 'user']);
      expect(claims['https://example.com/permissions']).toEqual([
        'admin',
        'user',
      ]);
    });

    it('should handle tokens without optional claims', async () => {
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://test-tenant.auth0.com/',
        sub: 'auth0|123456',
        aud: 'https://api.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as Auth0JWTClaims;

      expect(claims['azp']).toBeUndefined();
      expect(claims.scope).toBeUndefined();
      expect(claims.permissions).toBeUndefined();
    });

    it('should throw error for non-Auth0 issuer', async () => {
      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://example.com'
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_jwt_verification_failure',
          provider: 'auth0',
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
      expect(() => createAuth0Provider(defaultConfig)).not.toThrow();
    });

    it('should require auth0 provider type', () => {
      const invalidConfig = {
        provider: 'wrong',
        domain: 'test.auth0.com',
      } as any;

      expect(() => createAuth0Provider(invalidConfig)).toThrow(
        'provider set to "auth0"'
      );
    });

    it('should require domain', () => {
      const invalidConfig = {
        provider: 'auth0',
      } as any;

      expect(() => createAuth0Provider(invalidConfig)).toThrow(
        'requires a valid domain'
      );
    });

    it('should validate domain format', () => {
      const invalidConfig1 = {
        provider: 'auth0' as const,
        domain: 'https://test.auth0.com',
      };

      expect(() => createAuth0Provider(invalidConfig1)).toThrow(
        'should not include protocol'
      );

      const invalidConfig2 = {
        provider: 'auth0' as const,
        domain: 'test.auth0.com/',
      };

      expect(() => createAuth0Provider(invalidConfig2)).toThrow(
        'trailing slash'
      );
    });

    it('should validate issuer format if provided', () => {
      const invalidConfig = {
        provider: 'auth0' as const,
        domain: 'test.auth0.com',
        issuer: 'not-a-url',
      };

      expect(() => createAuth0Provider(invalidConfig)).toThrow('valid URL');
    });

    it('should validate audience format if provided', () => {
      const invalidConfig = {
        provider: 'auth0' as const,
        domain: 'test.auth0.com',
        audience: '',
      };

      expect(() => createAuth0Provider(invalidConfig)).toThrow(
        'non-empty string'
      );
    });
  });

  describe('factory function', () => {
    it('should create Auth0Provider instance', () => {
      const provider = createAuth0Provider(defaultConfig);
      expect(provider).toBeDefined();
      expect(typeof provider.verify).toBe('function');
      expect(provider.name).toBe('auth0');
    });
  });

  describe('type guards and helpers', () => {
    const auth0Claims: Auth0JWTClaims = {
      iss: 'https://test.auth0.com/',
      sub: 'auth0|123',
      aud: 'api',
      exp: Date.now() + 3600,
      iat: Date.now(),
      azp: 'client123',
      scope: 'read write admin',
      permissions: ['read:users', 'write:users'],
    };

    describe('isAuth0Claims', () => {
      it('should identify Auth0 claims by azp', () => {
        expect(
          isAuth0Claims({
            ...auth0Claims,
            scope: undefined,
            permissions: undefined,
          })
        ).toBe(true);
      });

      it('should identify Auth0 claims by scope', () => {
        expect(
          isAuth0Claims({
            ...auth0Claims,
            azp: undefined,
            permissions: undefined,
          })
        ).toBe(true);
      });

      it('should identify Auth0 claims by permissions', () => {
        expect(
          isAuth0Claims({ ...auth0Claims, azp: undefined, scope: undefined })
        ).toBe(true);
      });

      it('should identify Auth0 claims by namespace', () => {
        const claimsWithNamespace = {
          ...auth0Claims,
          azp: undefined,
          scope: undefined,
          permissions: undefined,
          'https://example.com/role': 'admin',
        };
        expect(isAuth0Claims(claimsWithNamespace)).toBe(true);
      });

      it('should reject non-Auth0 claims', () => {
        const basicClaims = {
          iss: 'https://example.com',
          sub: '123',
          aud: 'api',
          exp: Date.now() + 3600,
          iat: Date.now(),
        };
        expect(isAuth0Claims(basicClaims)).toBe(false);
      });
    });

    describe('extractAuth0Scopes', () => {
      it('should extract scopes from scope string', () => {
        const scopes = extractAuth0Scopes(auth0Claims);
        expect(scopes).toContain('read');
        expect(scopes).toContain('write');
        expect(scopes).toContain('admin');
      });

      it('should extract scopes from permissions array', () => {
        const scopes = extractAuth0Scopes(auth0Claims);
        expect(scopes).toContain('read:users');
        expect(scopes).toContain('write:users');
      });

      it('should remove duplicates', () => {
        const claimsWithDuplicates: Auth0JWTClaims = {
          ...auth0Claims,
          scope: 'read write read',
          permissions: ['read', 'write', 'read'],
        };
        const scopes = extractAuth0Scopes(claimsWithDuplicates);
        expect(scopes.filter(s => s === 'read')).toHaveLength(1);
      });

      it('should handle empty scope and permissions', () => {
        const emptyClaims: Auth0JWTClaims = {
          ...auth0Claims,
        };
        // Remove scope and permissions properties
        delete (emptyClaims as any).scope;
        delete (emptyClaims as any).permissions;
        const scopes = extractAuth0Scopes(emptyClaims);
        expect(scopes).toHaveLength(0);
      });
    });

    describe('hasAuth0Scope', () => {
      it('should find scope in scope string', () => {
        expect(hasAuth0Scope(auth0Claims, 'read')).toBe(true);
        expect(hasAuth0Scope(auth0Claims, 'delete')).toBe(false);
      });

      it('should find scope in permissions array', () => {
        expect(hasAuth0Scope(auth0Claims, 'read:users')).toBe(true);
        expect(hasAuth0Scope(auth0Claims, 'delete:users')).toBe(false);
      });
    });
  });
});

/**
 * Helper function to create test JWT tokens
 */
function createTestJWT(payload: Record<string, any>): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key' };

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
