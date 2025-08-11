import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createProvider,
  createProviders,
  getProviderMetadata,
  getAllProviderMetadata,
  isProviderTypeSupported,
  getSupportedProviderTypes,
  validateProviderConfig,
  registerProviderFactory,
  unregisterProviderFactory,
  getDefaultPriority,
  sortProviderConfigsByPriority,
  createProviderSummary,
} from './provider-factory.js';
import type {
  AuthProviderConfig,
  ProviderFactory,
  ProviderMetadata,
} from './index.js';
import { ProviderPriority } from '../types/provider.js';
import { clerkProvider } from './clerk-provider.js';
import { auth0Provider } from './auth0-provider.js';
import { supabaseProvider } from './supabase-provider.js';
import { firebaseProvider } from './firebase-provider.js';
import { customOIDCProvider } from './custom-oidc-provider.js';

describe('Provider Factory', () => {
  describe('createProvider', () => {
    it('should create Clerk provider', () => {
      const config: AuthProviderConfig = {
        provider: 'clerk',
        publishableKey: 'pk_test_123',
      };

      const provider = createProvider(config);
      expect(provider).toBe(clerkProvider);
      expect(provider.name).toBe('clerk');
      expect(provider.priority).toBe(ProviderPriority.CLERK);
    });

    it('should create Auth0 provider', () => {
      const config: AuthProviderConfig = {
        provider: 'auth0',
        domain: 'test.auth0.com',
      };

      const provider = createProvider(config);
      expect(provider).toBe(auth0Provider);
      expect(provider.name).toBe('auth0');
      expect(provider.priority).toBe(ProviderPriority.AUTH0);
    });

    it('should create Supabase provider', () => {
      const config: AuthProviderConfig = {
        provider: 'supabase',
        url: 'https://test.supabase.co',
        jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
      };

      const provider = createProvider(config);
      expect(provider).toBe(supabaseProvider);
      expect(provider.name).toBe('supabase');
      expect(provider.priority).toBe(ProviderPriority.SUPABASE);
    });

    it('should create Firebase provider', () => {
      const config: AuthProviderConfig = {
        provider: 'firebase',
        projectId: 'test-project-123',
      };

      const provider = createProvider(config);
      expect(provider).toBe(firebaseProvider);
      expect(provider.name).toBe('firebase');
      expect(provider.priority).toBe(ProviderPriority.FIREBASE);
    });

    it('should create Custom OIDC provider', () => {
      const config: AuthProviderConfig = {
        provider: 'custom',
        issuer: 'https://oidc.example.com',
        publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
      };

      const provider = createProvider(config);
      expect(provider).toBe(customOIDCProvider);
      expect(provider.name).toBe('custom-oidc');
      expect(provider.priority).toBe(ProviderPriority.CUSTOM_OIDC);
    });

    it('should throw error for unsupported provider type', () => {
      const config = {
        provider: 'unsupported',
        someConfig: 'value',
      } as any;

      expect(() => createProvider(config)).toThrow(
        'Unsupported provider type: unsupported'
      );
    });

    it('should throw error for invalid configuration', () => {
      const config = {
        provider: 'auth0',
        // Missing required domain
      } as any;

      expect(() => createProvider(config)).toThrow(
        'Failed to create auth0 provider'
      );
    });

    it('should throw error for missing provider type', () => {
      const config = {
        someConfig: 'value',
      } as any;

      expect(() => createProvider(config)).toThrow(
        'must specify a valid provider type'
      );
    });
  });

  describe('createProviders', () => {
    it('should create multiple providers from configurations', () => {
      const configs: AuthProviderConfig[] = [
        { provider: 'clerk' },
        { provider: 'auth0', domain: 'test.auth0.com' },
        {
          provider: 'firebase',
          projectId: 'test-project',
        },
      ];

      const providers = createProviders(configs);

      expect(providers).toHaveLength(3);
      expect(providers[0]).toBe(clerkProvider);
      expect(providers[1]).toBe(auth0Provider);
      expect(providers[2]).toBe(firebaseProvider);
    });

    it('should throw error if any provider configuration is invalid', () => {
      const configs: AuthProviderConfig[] = [
        { provider: 'clerk' },
        { provider: 'auth0' }, // Missing domain
      ] as any;

      expect(() => createProviders(configs)).toThrow(
        'Failed to create providers'
      );
    });

    it('should handle empty configuration array', () => {
      const providers = createProviders([]);
      expect(providers).toHaveLength(0);
    });

    it('should throw error for non-array input', () => {
      expect(() => createProviders(null as any)).toThrow('must be an array');
    });
  });

  describe('provider metadata', () => {
    it('should get metadata for specific provider type', () => {
      const metadata = getProviderMetadata('clerk');
      expect(metadata).toEqual({
        type: 'clerk',
        factory: expect.any(Function),
        defaultPriority: ProviderPriority.CLERK,
      });
    });

    it('should return undefined for unknown provider type', () => {
      const metadata = getProviderMetadata('unknown');
      expect(metadata).toBeUndefined();
    });

    it('should get all provider metadata', () => {
      const allMetadata = getAllProviderMetadata();
      expect(allMetadata).toHaveLength(5);

      const types = allMetadata.map(m => m.type);
      expect(types).toContain('clerk');
      expect(types).toContain('auth0');
      expect(types).toContain('supabase');
      expect(types).toContain('firebase');
      expect(types).toContain('custom');
    });
  });

  describe('provider type support', () => {
    it('should check if provider type is supported', () => {
      expect(isProviderTypeSupported('clerk')).toBe(true);
      expect(isProviderTypeSupported('auth0')).toBe(true);
      expect(isProviderTypeSupported('unknown')).toBe(false);
    });

    it('should get all supported provider types', () => {
      const supportedTypes = getSupportedProviderTypes();
      expect(supportedTypes).toContain('clerk');
      expect(supportedTypes).toContain('auth0');
      expect(supportedTypes).toContain('supabase');
      expect(supportedTypes).toContain('firebase');
      expect(supportedTypes).toContain('custom');
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configurations', () => {
      const validConfigs: AuthProviderConfig[] = [
        { provider: 'clerk' },
        { provider: 'auth0', domain: 'test.auth0.com' },
        {
          provider: 'supabase',
          url: 'https://test.supabase.co',
          jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
        },
      ];

      for (const config of validConfigs) {
        expect(() => validateProviderConfig(config)).not.toThrow();
        expect(validateProviderConfig(config)).toBe(true);
      }
    });

    it('should throw error for invalid configurations', () => {
      const invalidConfigs = [
        null,
        undefined,
        { provider: 'unknown' },
        { provider: 'auth0' }, // Missing domain
        { provider: 'supabase', url: 'https://test.supabase.co' }, // Missing JWT secret
      ];

      for (const config of invalidConfigs) {
        expect(() => validateProviderConfig(config as any)).toThrow();
      }
    });
  });

  describe('custom provider registration', () => {
    const customProviderType = 'test-custom';
    let mockFactory: ProviderFactory;

    beforeEach(() => {
      mockFactory = vi.fn().mockReturnValue({
        name: 'test-custom',
        priority: 999,
        canHandle: vi.fn().mockReturnValue(true),
        verify: vi.fn().mockResolvedValue({}),
      });
    });

    afterEach(() => {
      // Clean up custom provider
      unregisterProviderFactory(customProviderType);
    });

    it('should register custom provider factory', () => {
      const metadata: Omit<ProviderMetadata, 'type'> = {
        factory: mockFactory,
        defaultPriority: 999,
      };

      expect(() =>
        registerProviderFactory(customProviderType, mockFactory, metadata)
      ).not.toThrow();
      expect(isProviderTypeSupported(customProviderType)).toBe(true);
    });

    it('should create provider using custom factory', () => {
      const metadata: Omit<ProviderMetadata, 'type'> = {
        factory: mockFactory,
        defaultPriority: 999,
      };

      registerProviderFactory(customProviderType, mockFactory, metadata);

      const config = { provider: customProviderType } as any;
      const provider = createProvider(config);

      expect(mockFactory).toHaveBeenCalledWith(config);
      expect(provider.name).toBe('test-custom');
    });

    it('should throw error for duplicate registration', () => {
      const metadata: Omit<ProviderMetadata, 'type'> = {
        factory: mockFactory,
        defaultPriority: 999,
      };

      registerProviderFactory(customProviderType, mockFactory, metadata);

      expect(() =>
        registerProviderFactory(customProviderType, mockFactory, metadata)
      ).toThrow('already registered');
    });

    it('should unregister custom provider factory', () => {
      const metadata: Omit<ProviderMetadata, 'type'> = {
        factory: mockFactory,
        defaultPriority: 999,
      };

      registerProviderFactory(customProviderType, mockFactory, metadata);
      expect(isProviderTypeSupported(customProviderType)).toBe(true);

      const unregistered = unregisterProviderFactory(customProviderType);
      expect(unregistered).toBe(true);
      expect(isProviderTypeSupported(customProviderType)).toBe(false);
    });

    it('should return false when unregistering non-existent provider', () => {
      const unregistered = unregisterProviderFactory('non-existent');
      expect(unregistered).toBe(false);
    });
  });

  describe('priority management', () => {
    it('should get default priority for provider types', () => {
      expect(getDefaultPriority('clerk')).toBe(ProviderPriority.CLERK);
      expect(getDefaultPriority('auth0')).toBe(ProviderPriority.AUTH0);
      expect(getDefaultPriority('supabase')).toBe(ProviderPriority.SUPABASE);
      expect(getDefaultPriority('firebase')).toBe(ProviderPriority.FIREBASE);
      expect(getDefaultPriority('custom')).toBe(ProviderPriority.CUSTOM_OIDC);
      expect(getDefaultPriority('unknown')).toBeUndefined();
    });

    it('should sort provider configurations by priority', () => {
      const configs: AuthProviderConfig[] = [
        {
          provider: 'custom',
          issuer: 'https://oidc.example.com',
          publicKey:
            '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        },
        { provider: 'clerk' },
        { provider: 'firebase', projectId: 'test' },
        { provider: 'auth0', domain: 'test.auth0.com' },
        {
          provider: 'supabase',
          url: 'https://test.supabase.co',
          jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
        },
      ];

      const sorted = sortProviderConfigsByPriority(configs);

      expect(sorted.map(c => c.provider)).toEqual([
        'clerk', // Priority 10
        'auth0', // Priority 20
        'supabase', // Priority 30
        'firebase', // Priority 40
        'custom', // Priority 100
      ]);
    });
  });

  describe('provider summary', () => {
    it('should create comprehensive provider summary', () => {
      const configs: AuthProviderConfig[] = [
        { provider: 'clerk' },
        { provider: 'auth0', domain: 'test.auth0.com' },
        {
          provider: 'supabase',
          url: 'https://test.supabase.co',
          jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
        },
      ];

      const summary = createProviderSummary(configs);

      expect(summary).toEqual({
        totalProviders: 3,
        providerTypes: ['clerk', 'auth0', 'supabase'],
        providersByPriority: [
          { type: 'clerk', priority: 10 },
          { type: 'auth0', priority: 20 },
          { type: 'supabase', priority: 30 },
        ],
        supportedTypes: expect.arrayContaining([
          'clerk',
          'auth0',
          'supabase',
          'firebase',
          'custom',
        ]),
      });
    });

    it('should handle empty configuration', () => {
      const summary = createProviderSummary([]);

      expect(summary).toEqual({
        totalProviders: 0,
        providerTypes: [],
        providersByPriority: [],
        supportedTypes: expect.arrayContaining([
          'clerk',
          'auth0',
          'supabase',
          'firebase',
          'custom',
        ]),
      });
    });
  });
});
