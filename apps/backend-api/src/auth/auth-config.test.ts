import { describe, it, expect } from 'vitest';
import {
  loadAuthConfig,
  getProviderByIssuer,
  isProviderConfigured,
  getJWKSUri,
  usesJWKS,
  getExpectedAlgorithm,
  validateAuthConfig,
  createConfigSummary,
} from './auth-config.js';

describe('Auth Configuration', () => {
  describe('loadAuthConfig', () => {
    it('should create development config with no providers', () => {
      const config = loadAuthConfig({});

      expect(config.mode).toBe('development');
      expect(config.validateJWT).toBe(true);
      expect(config.providers).toEqual([]);
    });

    it('should detect Clerk provider from environment', () => {
      const env = {
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
        CLERK_SECRET_KEY: 'sk_test_456',
      };

      const config = loadAuthConfig(env);

      expect(config.mode).toBe('managed');
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0]).toEqual({
        provider: 'clerk',
        publishableKey: 'pk_test_123',
        secretKey: 'sk_test_456',
      });
    });

    it('should detect Auth0 provider from environment', () => {
      const env = {
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_AUDIENCE: 'test-api',
      };

      const config = loadAuthConfig(env);

      expect(config.mode).toBe('managed');
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0]).toEqual({
        provider: 'auth0',
        domain: 'test.auth0.com',
        audience: 'test-api',
        issuer: 'https://test.auth0.com/',
      });
    });

    it('should detect Supabase provider from environment', () => {
      const env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_JWT_SECRET:
          'super-secret-jwt-token-with-at-least-32-characters',
      };

      const config = loadAuthConfig(env);

      expect(config.mode).toBe('managed');
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0]).toEqual({
        provider: 'supabase',
        url: 'https://test.supabase.co',
        jwtSecret: 'super-secret-jwt-token-with-at-least-32-characters',
      });
    });

    it('should detect Firebase provider from environment', () => {
      const env = {
        FIREBASE_PROJECT_ID: 'test-project',
      };

      const config = loadAuthConfig(env);

      expect(config.mode).toBe('managed');
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0]).toEqual({
        provider: 'firebase',
        projectId: 'test-project',
      });
    });

    it('should detect custom OIDC provider from environment', () => {
      const env = {
        EXTERNAL_JWT_ISSUER: 'https://custom.example.com',
        EXTERNAL_JWT_AUDIENCE: 'custom-api',
      };

      const config = loadAuthConfig(env);

      expect(config.mode).toBe('custom');
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0]).toEqual({
        provider: 'custom',
        issuer: 'https://custom.example.com',
        audience: 'custom-api',
      });
    });

    it('should detect multiple providers from environment', () => {
      const env = {
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
        AUTH0_DOMAIN: 'test.auth0.com',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_JWT_SECRET:
          'super-secret-jwt-token-with-at-least-32-characters',
      };

      const config = loadAuthConfig(env);

      expect(config.mode).toBe('managed');
      expect(config.providers).toHaveLength(3);
      expect(config.providers.map(p => p.provider)).toEqual([
        'clerk',
        'auth0',
        'supabase',
      ]);
    });

    it('should parse session token configuration', () => {
      const env = {
        JWT_EXPIRES_IN: '30m',
        JWT_ALGORITHM: 'RS256',
        JWT_SECRET: 'test-secret',
      };

      const config = loadAuthConfig(env);

      expect(config.sessionToken).toEqual({
        expiresIn: '30m',
        algorithm: 'RS256',
        secret: 'test-secret',
      });
    });

    it('should parse rate limit configuration', () => {
      const env = {
        AUTH_RATE_LIMIT_MAX: '20',
        AUTH_RATE_LIMIT_WINDOW_MS: '600000',
      };

      const config = loadAuthConfig(env);

      expect(config.rateLimits).toEqual({
        exchange: {
          max: 20,
          windowMs: 600000,
        },
      });
    });
  });

  describe('getProviderByIssuer', () => {
    it('should find Clerk provider by issuer', () => {
      const config = loadAuthConfig({
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
      });

      const provider = getProviderByIssuer(
        config,
        'https://test.clerk.accounts.dev'
      );
      expect(provider?.provider).toBe('clerk');
    });

    it('should find Auth0 provider by issuer', () => {
      const config = loadAuthConfig({
        AUTH0_DOMAIN: 'test.auth0.com',
      });

      const provider = getProviderByIssuer(config, 'https://test.auth0.com/');
      expect(provider?.provider).toBe('auth0');
    });

    it('should return undefined for unknown issuer', () => {
      const config = loadAuthConfig({});

      const provider = getProviderByIssuer(
        config,
        'https://unknown.example.com'
      );
      expect(provider).toBeUndefined();
    });
  });

  describe('isProviderConfigured', () => {
    it('should return true for configured provider', () => {
      const config = loadAuthConfig({
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
      });

      expect(isProviderConfigured(config, 'clerk')).toBe(true);
    });

    it('should return false for unconfigured provider', () => {
      const config = loadAuthConfig({});

      expect(isProviderConfigured(config, 'clerk')).toBe(false);
    });
  });

  describe('getJWKSUri', () => {
    it('should return Auth0 JWKS URI', () => {
      const provider = {
        provider: 'auth0' as const,
        domain: 'test.auth0.com',
      };

      expect(getJWKSUri(provider)).toBe(
        'https://test.auth0.com/.well-known/jwks.json'
      );
    });

    it('should return Firebase JWKS URI', () => {
      const provider = {
        provider: 'firebase' as const,
        projectId: 'test-project',
      };

      expect(getJWKSUri(provider)).toBe(
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
      );
    });

    it('should return custom JWKS URI', () => {
      const provider = {
        provider: 'custom' as const,
        issuer: 'https://custom.example.com',
        jwksUri: 'https://custom.example.com/jwks',
      };

      expect(getJWKSUri(provider)).toBe('https://custom.example.com/jwks');
    });

    it('should return default JWKS URI for custom provider', () => {
      const provider = {
        provider: 'custom' as const,
        issuer: 'https://custom.example.com',
      };

      expect(getJWKSUri(provider)).toBe(
        'https://custom.example.com/.well-known/jwks.json'
      );
    });

    it('should return undefined for Supabase (HS256)', () => {
      const provider = {
        provider: 'supabase' as const,
        url: 'https://test.supabase.co',
        jwtSecret: 'secret',
      };

      expect(getJWKSUri(provider)).toBeUndefined();
    });
  });

  describe('usesJWKS', () => {
    it('should return true for providers that use JWKS', () => {
      const auth0Provider = {
        provider: 'auth0' as const,
        domain: 'test.auth0.com',
      };
      const firebaseProvider = {
        provider: 'firebase' as const,
        projectId: 'test',
      };
      const customProvider = {
        provider: 'custom' as const,
        issuer: 'https://example.com',
      };

      expect(usesJWKS(auth0Provider)).toBe(true);
      expect(usesJWKS(firebaseProvider)).toBe(true);
      expect(usesJWKS(customProvider)).toBe(true);
    });

    it('should return false for providers that use shared secrets', () => {
      const supabaseProvider = {
        provider: 'supabase' as const,
        url: 'https://test.supabase.co',
        jwtSecret: 'secret',
      };
      const customWithSecret = {
        provider: 'custom' as const,
        issuer: 'https://example.com',
        secret: 'secret',
      };

      expect(usesJWKS(supabaseProvider)).toBe(false);
      expect(usesJWKS(customWithSecret)).toBe(false);
    });
  });

  describe('getExpectedAlgorithm', () => {
    it('should return RS256 for RSA-based providers', () => {
      const auth0Provider = {
        provider: 'auth0' as const,
        domain: 'test.auth0.com',
      };
      const firebaseProvider = {
        provider: 'firebase' as const,
        projectId: 'test',
      };

      expect(getExpectedAlgorithm(auth0Provider)).toEqual(['RS256']);
      expect(getExpectedAlgorithm(firebaseProvider)).toEqual(['RS256']);
    });

    it('should return HS256 for HMAC-based providers', () => {
      const supabaseProvider = {
        provider: 'supabase' as const,
        url: 'https://test.supabase.co',
        jwtSecret: 'secret',
      };

      expect(getExpectedAlgorithm(supabaseProvider)).toEqual(['HS256']);
    });

    it('should return appropriate algorithm for custom providers', () => {
      const customWithSecret = {
        provider: 'custom' as const,
        issuer: 'https://example.com',
        secret: 'secret',
      };
      const customWithJWKS = {
        provider: 'custom' as const,
        issuer: 'https://example.com',
      };

      expect(getExpectedAlgorithm(customWithSecret)).toEqual(['HS256']);
      expect(getExpectedAlgorithm(customWithJWKS)).toEqual(['RS256', 'ES256']);
    });
  });

  describe('validateAuthConfig', () => {
    it('should validate valid configuration', () => {
      const config = loadAuthConfig({
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
        JWT_SECRET: 'test-secret',
      });

      expect(() => validateAuthConfig(config)).not.toThrow();
    });

    it('should throw for HS256 without secret', () => {
      const config = loadAuthConfig({
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
        JWT_ALGORITHM: 'HS256',
      });

      expect(() => validateAuthConfig(config)).toThrow(
        'JWT secret is required when using HS256 algorithm'
      );
    });

    it('should throw for custom provider without verification method', () => {
      const config = loadAuthConfig({
        EXTERNAL_JWT_ISSUER: 'https://example.com',
      });

      // Ensure session token config is valid to avoid session validation error
      config.sessionToken = {
        algorithm: 'RS256', // Use RS256 to avoid secret requirement
        publicKey: 'dummy-public-key',
        expiresIn: '1h',
      };

      // Remove the auto-computed jwksUri to test validation
      config.providers[0] = {
        provider: 'custom',
        issuer: 'https://example.com',
      };

      expect(() => validateAuthConfig(config)).toThrow(
        'Custom OIDC provider must specify jwksUri, publicKey, or secret'
      );
    });
  });

  describe('createConfigSummary', () => {
    it('should create safe configuration summary', () => {
      const config = loadAuthConfig({
        CLERK_PUBLISHABLE_KEY: 'pk_test_123',
        CLERK_SECRET_KEY: 'sk_test_456',
        JWT_SECRET: 'test-secret',
      });

      const summary = createConfigSummary(config);

      expect(summary).toEqual({
        mode: 'managed',
        validateJWT: true,
        providerCount: 1,
        providers: [
          {
            type: 'clerk',
            hasSecret: true,
          },
        ],
        sessionToken: {
          algorithm: 'HS256',
          expiresIn: '10m',
          hasSecret: true,
        },
        rateLimits: {
          exchange: {
            max: 10,
            windowMs: 900000,
          },
        },
      });

      // Ensure no actual secrets are in the summary
      expect(JSON.stringify(summary)).not.toContain('pk_test_123');
      expect(JSON.stringify(summary)).not.toContain('sk_test_456');
      expect(JSON.stringify(summary)).not.toContain('test-secret');
    });
  });
});
