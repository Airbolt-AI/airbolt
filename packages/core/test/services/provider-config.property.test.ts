import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getProviderConfig,
  getProviderFeatures,
  PROVIDER_CONFIG,
} from '../../src/services/provider-config.js';

describe('provider-config property tests', () => {
  describe('getProviderConfig', () => {
    it('should return valid config for all supported providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const config = getProviderConfig(provider);
          expect(config).toBeDefined();
          expect(config).toHaveProperty('defaultModel');
          expect(config).toHaveProperty('envKey');
          expect(typeof config.defaultModel).toBe('string');
          expect(typeof config.envKey).toBe('string');
          expect(config.defaultModel.length).toBeGreaterThan(0);
          expect(config.envKey.length).toBeGreaterThan(0);
        })
      );
    });

    it('should throw for unsupported providers', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'openai' && s !== 'anthropic'),
          unsupportedProvider => {
            expect(() => getProviderConfig(unsupportedProvider as any)).toThrow(
              'Unsupported AI provider'
            );
          }
        )
      );
    });
  });

  describe('getProviderFeatures', () => {
    it('should return feature set for supported providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const features = getProviderFeatures(provider);
          expect(features).toBeDefined();
          expect(typeof features.streaming).toBe('boolean');
          expect(typeof features.functionCalling).toBe('boolean');
          expect(typeof features.vision).toBe('boolean');
        })
      );
    });

    it('should return undefined for unsupported providers', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'openai' && s !== 'anthropic'),
          unsupportedProvider => {
            const features = getProviderFeatures(unsupportedProvider as any);
            expect(features).toBeUndefined();
          }
        )
      );
    });
  });

  describe('PROVIDER_CONFIG export', () => {
    it('should have required structure for all providers', () => {
      Object.entries(PROVIDER_CONFIG).forEach(([provider, config]) => {
        expect(typeof provider).toBe('string');
        expect(provider.length).toBeGreaterThan(0);
        expect(config).toHaveProperty('defaultModel');
        expect(config).toHaveProperty('envKey');
        expect(config).toHaveProperty('features');
        expect(typeof config.defaultModel).toBe('string');
        expect(typeof config.envKey).toBe('string');
      });
    });

    it('should have unique env keys', () => {
      const envKeys = Object.values(PROVIDER_CONFIG).map(c => c.envKey);
      const uniqueEnvKeys = new Set(envKeys);
      expect(envKeys.length).toBe(uniqueEnvKeys.size);
    });

    it('should have consistent feature structure for all providers', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), () => {
          Object.values(PROVIDER_CONFIG).forEach(config => {
            expect(config.features).toBeDefined();
            expect(Object.keys(config.features).sort()).toEqual(
              ['functionCalling', 'streaming', 'vision'].sort()
            );
          });
          return true;
        })
      );
    });
  });

  describe('Provider config invariants', () => {
    it('should have non-empty env keys', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), () => {
          Object.values(PROVIDER_CONFIG).forEach(config => {
            expect(config.envKey).toBeTruthy();
            expect(config.envKey.length).toBeGreaterThan(0);
          });
          return true;
        })
      );
    });

    it('should have valid model names', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), () => {
          Object.values(PROVIDER_CONFIG).forEach(config => {
            expect(config.defaultModel).toBeTruthy();
            expect(config.defaultModel.length).toBeGreaterThan(0);
          });
          return true;
        })
      );
    });
  });
});