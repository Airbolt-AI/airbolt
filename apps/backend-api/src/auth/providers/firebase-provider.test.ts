import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFirebaseProvider,
  isFirebaseClaims,
  getFirebaseUserId,
  wasFirebaseAuthenticatedVia,
} from './firebase-provider.js';
import type {
  VerifyContext,
  FirebaseJWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { FastifyLoggerInstance } from 'fastify';
import { createHash } from 'node:crypto';

describe('FirebaseProvider', () => {
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

    provider = createFirebaseProvider();
  });

  describe('constructor and configuration', () => {
    it('should create provider with correct name and priority', () => {
      expect(provider.name).toBe('firebase');
      expect(provider.priority).toBe(40);
    });

    it('should validate configuration on construction', () => {
      expect(() => createFirebaseProvider()).not.toThrow();
    });
  });

  describe('canHandle', () => {
    it('should handle Firebase issuer pattern', () => {
      expect(
        provider.canHandle('https://securetoken.google.com/my-firebase-project')
      ).toBe(true);
      expect(
        provider.canHandle('https://securetoken.google.com/another-project')
      ).toBe(true);
      expect(
        provider.canHandle('https://securetoken.google.com/test-123')
      ).toBe(true);
    });

    it('should handle configured project ID', () => {
      expect(
        provider.canHandle('https://securetoken.google.com/my-firebase-project')
      ).toBe(true);
    });

    it('should reject non-Firebase issuers', () => {
      expect(provider.canHandle('https://example.com')).toBe(false);
      expect(provider.canHandle('https://auth0.example.com')).toBe(false);
      expect(provider.canHandle('https://google.com/my-project')).toBe(false);
      expect(provider.canHandle('')).toBe(false);
      expect(provider.canHandle(null as any)).toBe(false);
    });

    it('should reject issuers with invalid project IDs', () => {
      expect(provider.canHandle('https://securetoken.google.com/')).toBe(false);
      expect(provider.canHandle('https://securetoken.google.com')).toBe(false);
    });
  });

  describe('verify', () => {
    const validToken = createTestJWT({
      iss: 'https://securetoken.google.com/my-firebase-project',
      sub: 'firebase-user-123',
      aud: 'my-firebase-project',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      user_id: 'firebase-user-123',
      firebase: {
        identities: {
          'google.com': ['google-user-456'],
          email: ['user@example.com'],
        },
        sign_in_provider: 'google.com',
        tenant: 'tenant-abc-123',
      },
    });

    beforeEach(() => {
      // Mock the base provider methods
      vi.spyOn(provider as any, 'validateTokenFormat').mockReturnValue({
        header: { alg: 'RS256', typ: 'JWT', kid: 'firebase-key' },
        payload: {
          iss: 'https://securetoken.google.com/my-firebase-project',
          sub: 'firebase-user-123',
          aud: 'my-firebase-project',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        signature: 'signature',
      });

      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://securetoken.google.com/my-firebase-project'
      );
      vi.spyOn(provider as any, 'extractProjectIdFromIssuer').mockReturnValue(
        'my-firebase-project'
      );
      vi.spyOn(provider as any, 'getJWKS').mockReturnValue(vi.fn());
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://securetoken.google.com/my-firebase-project',
        sub: 'firebase-user-123',
        aud: 'my-firebase-project',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        user_id: 'firebase-user-123',
        firebase: {
          identities: {
            'google.com': ['google-user-456'],
            email: ['user@example.com'],
          },
          sign_in_provider: 'google.com',
          tenant: 'tenant-abc-123',
        },
      });
    });

    it('should successfully verify valid Firebase token', async () => {
      const claims = await provider.verify(validToken, mockContext);

      expect(claims).toMatchObject({
        iss: 'https://securetoken.google.com/my-firebase-project',
        sub: 'firebase-user-123',
        aud: 'my-firebase-project',
        uid: 'firebase-user-123',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_token_exchange_success',
          provider: 'firebase',
        }),
        expect.stringContaining('successful')
      );
    });

    it('should extract Firebase-specific claims', async () => {
      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as FirebaseJWTClaims;

      expect(claims.firebase).toEqual({
        identities: {
          'google.com': ['google-user-456'],
          email: ['user@example.com'],
        },
        sign_in_provider: 'google.com',
        tenant: 'tenant-abc-123',
      });
      expect(claims.uid).toBe('firebase-user-123');
    });

    it('should handle tokens without Firebase context', async () => {
      vi.spyOn(provider as any, 'performJWTVerification').mockResolvedValue({
        iss: 'https://securetoken.google.com/my-firebase-project',
        sub: 'firebase-user-123',
        aud: 'my-firebase-project',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const claims = (await provider.verify(
        validToken,
        mockContext
      )) as FirebaseJWTClaims;

      expect(claims.firebase).toBeUndefined();
      expect(claims.uid).toBe('firebase-user-123'); // Falls back to sub
    });

    it('should validate project ID matches configuration', async () => {
      vi.spyOn(provider as any, 'extractProjectIdFromIssuer').mockReturnValue(
        'wrong-project'
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow(
        'does not match configured project ID'
      );
    });

    it('should throw error for non-Firebase issuer', async () => {
      vi.spyOn(provider as any, 'extractIssuer').mockReturnValue(
        'https://example.com'
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_jwt_verification_failure',
          provider: 'firebase',
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
      expect(() => createFirebaseProvider()).not.toThrow();
    });

    it('should require firebase provider type', () => {
      expect(() => createFirebaseProvider()).toThrow(
        'provider set to "firebase"'
      );
    });

    it('should require project ID', () => {
      expect(() => createFirebaseProvider()).toThrow(
        'requires a valid project ID'
      );
    });

    it('should validate project ID format', () => {
      expect(() => createFirebaseProvider()).toThrow(
        'lowercase letters, numbers, and hyphens'
      );
      expect(() => createFirebaseProvider()).toThrow(
        'between 6 and 30 characters'
      );
      expect(() => createFirebaseProvider()).toThrow(
        'between 6 and 30 characters'
      );
    });
  });

  describe('factory function', () => {
    it('should create FirebaseProvider instance', () => {
      const provider = createFirebaseProvider();
      expect(provider.name).toBe('firebase');
    });
  });

  describe('type guards and helpers', () => {
    const firebaseClaims: FirebaseJWTClaims = {
      iss: 'https://securetoken.google.com/my-project',
      sub: 'user-123',
      aud: 'my-project',
      exp: Date.now() + 3600,
      iat: Date.now(),
      uid: 'user-123',
      firebase: {
        identities: {
          'google.com': ['google-123'],
          email: ['user@example.com'],
        },
        sign_in_provider: 'google.com',
        tenant: 'tenant-123',
      },
    };

    describe('isFirebaseClaims', () => {
      it('should identify Firebase claims by firebase object', () => {
        expect(isFirebaseClaims(firebaseClaims)).toBe(true);
      });

      it('should identify Firebase claims by uid', () => {
        const claimsWithUid = { ...firebaseClaims, firebase: undefined };
        expect(isFirebaseClaims(claimsWithUid)).toBe(true);
      });

      it('should identify Firebase claims by issuer', () => {
        const { firebase, uid, ...baseClaims } = firebaseClaims;
        const claimsWithFirebaseIssuer = {
          ...baseClaims,
          iss: 'https://securetoken.google.com/my-project',
        };
        expect(isFirebaseClaims(claimsWithFirebaseIssuer)).toBe(true);
      });

      it('should reject non-Firebase claims', () => {
        const basicClaims = {
          iss: 'https://example.com',
          sub: '123',
          aud: 'api',
          exp: Date.now() + 3600,
          iat: Date.now(),
        };
        expect(isFirebaseClaims(basicClaims)).toBe(false);
      });
    });

    describe('getFirebaseUserId', () => {
      it('should return uid when available', () => {
        expect(getFirebaseUserId(firebaseClaims)).toBe('user-123');
      });

      it('should fall back to sub when uid is not available', () => {
        const { uid, ...claimsWithoutUid } = firebaseClaims;
        expect(getFirebaseUserId(claimsWithoutUid as FirebaseJWTClaims)).toBe(
          'user-123'
        );
      });
    });

    describe('wasFirebaseAuthenticatedVia', () => {
      it('should check authentication provider', () => {
        expect(wasFirebaseAuthenticatedVia(firebaseClaims, 'google.com')).toBe(
          true
        );
        expect(wasFirebaseAuthenticatedVia(firebaseClaims, 'password')).toBe(
          false
        );
      });

      it('should handle missing firebase context', () => {
        const { firebase, ...claimsWithoutFirebase } = firebaseClaims;
        expect(
          wasFirebaseAuthenticatedVia(claimsWithoutFirebase, 'google.com')
        ).toBe(false);
      });
    });
  });
});

/**
 * Helper function to create test JWT tokens
 */
function createTestJWT(payload: Record<string, any>): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'firebase-key' };

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
