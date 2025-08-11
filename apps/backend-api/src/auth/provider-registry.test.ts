import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyLoggerInstance } from 'fastify';
import { AuthProviderRegistry } from './provider-registry.js';
import { extractIssuer, createHashKey } from './utils/auth-utils.js';
import type { AuthProvider, VerifyContext } from './types/provider.js';
import type { JWTClaims } from '../types/auth.js';
import type { AuthConfig } from './auth-config.js';

// Mock provider for testing
class MockAuthProvider implements AuthProvider {
  readonly name = 'mock-provider';
  priority = 100;

  private readonly mockIssuer: string;

  constructor(issuer: string) {
    this.mockIssuer = issuer;
  }

  canHandle(issuer: string): boolean {
    return issuer === this.mockIssuer;
  }

  async verify(token: string, _context: VerifyContext): Promise<JWTClaims> {
    if (!token.includes('valid')) {
      throw new Error('Invalid token');
    }

    return {
      sub: 'test-user',
      iss: this.mockIssuer,
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      email: 'test@example.com',
    };
  }
}

// Mock logger
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as FastifyLoggerInstance;

// Mock config
const mockConfig: AuthConfig = {
  mode: 'development',
  validateJWT: true,
  providers: [],
};

describe('AuthProviderRegistry', () => {
  let registry: AuthProviderRegistry;

  beforeEach(() => {
    registry = new AuthProviderRegistry(mockConfig, mockLogger);
  });

  describe('provider management', () => {
    it('should register and retrieve providers', () => {
      const provider = new MockAuthProvider('https://example.com');

      expect(registry.size()).toBe(0);

      registry.register(provider);

      expect(registry.size()).toBe(1);
      expect(registry.getProviders()).toHaveLength(1);
      expect(registry.getProviders()[0]).toBe(provider);
    });

    it('should sort providers by priority', () => {
      const highPriority = new MockAuthProvider('https://high.com');
      highPriority.priority = 10;

      const lowPriority = new MockAuthProvider('https://low.com');
      lowPriority.priority = 50;

      registry.register(lowPriority);
      registry.register(highPriority);

      const providers = registry.getProviders();
      expect(providers[0]!).toBe(highPriority);
      expect(providers[1]!).toBe(lowPriority);
    });

    it('should find provider by issuer', () => {
      const provider = new MockAuthProvider('https://example.com');
      registry.register(provider);

      expect(registry.findProvider('https://example.com')).toBe(provider);
      expect(registry.findProvider('https://other.com')).toBeUndefined();
    });

    it('should clear all providers', () => {
      registry.register(new MockAuthProvider('https://example.com'));
      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });

  describe('token verification', () => {
    it('should reject invalid token formats', async () => {
      await expect(registry.verifyToken('')).rejects.toThrow('Invalid token');
      await expect(registry.verifyToken('invalid')).rejects.toThrow();
    });

    it('should reject tokens with no matching provider', async () => {
      // Valid JWT structure but no provider can handle it
      const validJWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Vua25vd24uY29tIiwic3ViIjoidGVzdCJ9.signature';

      await expect(registry.verifyToken(validJWT)).rejects.toThrow(
        'No authentication provider'
      );
    });

    it('should successfully verify tokens with matching provider', async () => {
      const provider = new MockAuthProvider('https://example.com');
      registry.register(provider);

      // Create a valid JWT with the expected issuer
      const header = JSON.stringify({ typ: 'JWT', alg: 'RS256' });
      const payload = JSON.stringify({
        iss: 'https://example.com',
        sub: 'test',
      });
      const validJWT = `${Buffer.from(header).toString('base64url')}.${Buffer.from(payload).toString('base64url')}.signature-valid`;

      const result = await registry.verifyToken(validJWT);

      expect(result.claims.sub).toBe('test-user');
      expect(result.claims.iss).toBe('https://example.com');
      expect(result.provider).toBe('mock-provider');
      expect(result.issuer).toBe('https://example.com');
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });
  });

  describe('provider management', () => {
    it('should track provider count', () => {
      const provider = new MockAuthProvider('https://example.com');
      registry.register(provider);

      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });
});

describe('utility functions', () => {
  describe('extractIssuer', () => {
    it('should extract issuer from valid JWT', () => {
      const header = JSON.stringify({ typ: 'JWT', alg: 'RS256' });
      const payload = JSON.stringify({
        iss: 'https://example.com',
        sub: 'test',
      });
      const token = `${Buffer.from(header).toString('base64url')}.${Buffer.from(payload).toString('base64url')}.signature`;

      expect(extractIssuer(token)).toBe('https://example.com');
    });

    it('should reject invalid token formats', () => {
      expect(() => extractIssuer('')).toThrow('Invalid JWT format');
      expect(() => extractIssuer('invalid')).toThrow('Invalid JWT format');
      expect(() => extractIssuer('a.b')).toThrow('Invalid JWT format');
    });

    it('should reject tokens without issuer', () => {
      const header = JSON.stringify({ typ: 'JWT', alg: 'RS256' });
      const payload = JSON.stringify({ sub: 'test' }); // No issuer
      const token = `${Buffer.from(header).toString('base64url')}.${Buffer.from(payload).toString('base64url')}.signature`;

      expect(() => extractIssuer(token)).toThrow('missing or invalid issuer');
    });
  });

  describe('createHashKey', () => {
    it('should create consistent hash for same input', () => {
      const token = 'test-token';
      const hash1 = createHashKey(token);
      const hash2 = createHashKey(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
    });

    it('should create different hashes for different contexts', () => {
      const token = 'test-token';
      const hash1 = createHashKey(token);
      const hash2 = createHashKey(token, 'context');

      expect(hash1).not.toBe(hash2);
    });
  });
});
