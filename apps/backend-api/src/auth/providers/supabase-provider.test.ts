import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSupabaseProvider,
  isSupabaseClaims,
  hasSupabaseRole,
  wasSupabaseAuthenticatedVia,
} from './supabase-provider.js';
import type {
  VerifyContext,
  SupabaseJWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { FastifyLoggerInstance } from 'fastify';
import { createHash } from 'node:crypto';

describe('SupabaseProvider', () => {
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

    provider = createSupabaseProvider();
  });

  describe('constructor and configuration', () => {
    it('should create provider with correct name and priority', () => {
      expect(provider.name).toBe('supabase');
      expect(provider.priority).toBe(30);
    });

    it('should validate configuration on construction', () => {
      expect(() => createSupabaseProvider()).not.toThrow();
    });
  });

  describe('canHandle', () => {
    it('should handle Supabase domain pattern', () => {
      expect(provider.canHandle('https://abcdefgh.supabase.co/auth/v1')).toBe(
        true
      );
      expect(provider.canHandle('https://myproject.supabase.co/auth/v1')).toBe(
        true
      );
      expect(provider.canHandle('https://test123.supabase.co/auth/v1')).toBe(
        true
      );
    });

    it('should handle configured URL', () => {
      expect(provider.canHandle('https://abcdefgh.supabase.co/auth/v1')).toBe(
        true
      );
    });

    it('should reject non-Supabase issuers', () => {
      expect(provider.canHandle('https://example.com')).toBe(false);
      expect(provider.canHandle('https://auth0.example.com')).toBe(false);
      expect(provider.canHandle('https://abcdefgh.supabase.co')).toBe(false); // Missing /auth/v1
      expect(provider.canHandle('')).toBe(false);
      expect(provider.canHandle(null as any)).toBe(false);
    });
  });

  describe('verify', () => {
    const validToken = createTestJWT({
      iss: 'https://abcdefgh.supabase.co/auth/v1',
      sub: 'user-123-456-789',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      role: 'authenticated',
      app_metadata: { plan: 'premium', admin: true },
      user_metadata: { name: 'John Doe', preferences: { theme: 'dark' } },
      amr: ['password', 'email'],
    });

    beforeEach(() => {
      // Mock the base provider methods
      vi.spyOn(provider as any, 'validateTokenFormat').mockReturnValue({
        header: { alg: 'HS256', typ: 'JWT' },
        payload: {
          iss: 'https://abcdefgh.supabase.co/auth/v1',
          sub: 'user-123-456-789',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        signature: 'signature',
      });

      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://abcdefgh.supabase.co/auth/v1'
      );
      vi.spyOn(provider as any, 'getSupabaseVerificationKey').mockResolvedValue(
        new Uint8Array([1, 2, 3])
      );
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://abcdefgh.supabase.co/auth/v1',
        sub: 'user-123-456-789',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        role: 'authenticated',
        app_metadata: { plan: 'premium', admin: true },
        user_metadata: { name: 'John Doe', preferences: { theme: 'dark' } },
        amr: ['password', 'email'],
      });
    });

    it('should successfully verify valid Supabase token', async () => {
      const claims = await provider.verify(validToken, mockContext);

      expect(claims).toMatchObject({
        iss: 'https://abcdefgh.supabase.co/auth/v1',
        sub: 'user-123-456-789',
        aud: 'authenticated',
        role: 'authenticated',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'AUTH_TOKEN_EXCHANGE_SUCCESS',
          provider: 'supabase',
        }),
        expect.stringContaining('successful')
      );
    });

    it('should extract Supabase-specific claims', async () => {
      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as SupabaseJWTClaims;

      expect(claims.role).toBe('authenticated');
      expect(claims.app_metadata).toEqual({ plan: 'premium', admin: true });
      expect(claims.user_metadata).toEqual({
        name: 'John Doe',
        preferences: { theme: 'dark' },
      });
      expect(claims.amr).toEqual(['password', 'email']);
    });

    it('should handle tokens without optional claims', async () => {
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://abcdefgh.supabase.co/auth/v1',
        sub: 'user-123-456-789',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        role: 'anon',
      });

      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as SupabaseJWTClaims;

      expect(claims.role).toBe('anon');
      expect(claims.app_metadata).toBeUndefined();
      expect(claims.user_metadata).toBeUndefined();
      expect(claims.amr).toBeUndefined();
    });

    it('should throw error for non-Supabase issuer', async () => {
      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://example.com'
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'AUTH_JWT_VERIFICATION_FAILURE',
          provider: 'supabase',
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
      expect(() => createSupabaseProvider()).not.toThrow();
    });

    it('should require supabase provider type', () => {
      expect(() => createSupabaseProvider()).toThrow(
        'provider set to "supabase"'
      );
    });

    it('should require URL', () => {
      expect(() => createSupabaseProvider()).toThrow('requires a valid URL');
    });

    it('should validate URL format', () => {
      expect(() => createSupabaseProvider()).toThrow('valid URL');
    });

    it('should require JWT secret', () => {
      expect(() => createSupabaseProvider()).toThrow(
        'requires a valid JWT secret'
      );
    });

    it('should validate JWT secret length', () => {
      expect(() => createSupabaseProvider()).toThrow('at least 32 characters');
    });

    it('should accept localhost URLs for development', () => {
      expect(() => createSupabaseProvider()).not.toThrow();
    });
  });

  describe('factory function', () => {
    it('should create SupabaseProvider instance', () => {
      const provider = createSupabaseProvider();
      expect(provider.name).toBe('supabase');
    });
  });

  describe('type guards and helpers', () => {
    const supabaseClaims: SupabaseJWTClaims = {
      iss: 'https://test.supabase.co/auth/v1',
      sub: 'user-123',
      aud: 'authenticated',
      exp: Date.now() + 3600,
      iat: Date.now(),
      role: 'authenticated',
      app_metadata: { plan: 'free' },
      user_metadata: { name: 'Test User' },
      amr: ['password'],
    };

    describe('isSupabaseClaims', () => {
      it('should identify Supabase claims by role', () => {
        const claimsWithoutOptionals = { ...supabaseClaims };
        delete (claimsWithoutOptionals as any).app_metadata;
        delete (claimsWithoutOptionals as any).user_metadata;
        delete (claimsWithoutOptionals as any).amr;
        expect(isSupabaseClaims(claimsWithoutOptionals)).toBe(true);
      });

      it('should identify Supabase claims by app_metadata', () => {
        const claimsWithAppMetadata = { ...supabaseClaims };
        delete (claimsWithAppMetadata as any).role;
        delete (claimsWithAppMetadata as any).user_metadata;
        delete (claimsWithAppMetadata as any).amr;
        expect(isSupabaseClaims(claimsWithAppMetadata)).toBe(true);
      });

      it('should identify Supabase claims by user_metadata', () => {
        const claimsWithUserMetadata = { ...supabaseClaims };
        delete (claimsWithUserMetadata as any).role;
        delete (claimsWithUserMetadata as any).app_metadata;
        delete (claimsWithUserMetadata as any).amr;
        expect(isSupabaseClaims(claimsWithUserMetadata)).toBe(true);
      });

      it('should identify Supabase claims by amr', () => {
        const claimsWithAmr = { ...supabaseClaims };
        delete (claimsWithAmr as any).role;
        delete (claimsWithAmr as any).app_metadata;
        delete (claimsWithAmr as any).user_metadata;
        expect(isSupabaseClaims(claimsWithAmr)).toBe(true);
      });

      it('should reject non-Supabase claims', () => {
        const basicClaims = {
          iss: 'https://example.com',
          sub: '123',
          aud: 'api',
          exp: Date.now() + 3600,
          iat: Date.now(),
        };
        expect(isSupabaseClaims(basicClaims)).toBe(false);
      });
    });

    describe('hasSupabaseRole', () => {
      it('should check for specific role', () => {
        expect(hasSupabaseRole(supabaseClaims, 'authenticated')).toBe(true);
        expect(hasSupabaseRole(supabaseClaims, 'anon')).toBe(false);
      });
    });

    describe('wasSupabaseAuthenticatedVia', () => {
      it('should check authentication method', () => {
        expect(wasSupabaseAuthenticatedVia(supabaseClaims, 'password')).toBe(
          true
        );
        expect(wasSupabaseAuthenticatedVia(supabaseClaims, 'oauth')).toBe(
          false
        );
      });

      it('should handle missing amr', () => {
        const claimsWithoutAmr = { ...supabaseClaims };
        delete (claimsWithoutAmr as any).amr;
        expect(wasSupabaseAuthenticatedVia(claimsWithoutAmr, 'password')).toBe(
          false
        );
      });
    });
  });
});

/**
 * Helper function to create test JWT tokens
 */
function createTestJWT(payload: Record<string, any>): string {
  const header = { alg: 'HS256', typ: 'JWT' };

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
