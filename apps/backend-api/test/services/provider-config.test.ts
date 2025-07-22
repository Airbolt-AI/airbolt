import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getProviderConfig,
  getDefaultModel,
  getProviderFeatures,
  isProviderName,
  UnknownProviderError,
  PROVIDER_CONFIG,
} from '../../src/services/provider-config.js';

describe('Provider Config Property Tests', () => {
  describe('isProviderName', () => {
    it('should return true for valid providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          expect(isProviderName(provider)).toBe(true);
        })
      );
    });

    it('should return false for invalid providers', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'openai' && s !== 'anthropic'),
          provider => {
            expect(isProviderName(provider)).toBe(false);
          }
        )
      );
    });

    it('should be deterministic', () => {
      fc.assert(
        fc.property(fc.string(), provider => {
          const result1 = isProviderName(provider);
          const result2 = isProviderName(provider);
          expect(result1).toBe(result2);
        })
      );
    });
  });

  describe('getProviderConfig', () => {
    it('should return config for valid providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const config = getProviderConfig(provider);
          expect(config).toBeDefined();
          expect(config).toBe(PROVIDER_CONFIG[provider]);
        })
      );
    });

    it('should return undefined for invalid providers', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              s =>
                s !== 'openai' && s !== 'anthropic' && !(s in PROVIDER_CONFIG)
            ),
          provider => {
            const config = getProviderConfig(provider);
            expect(config).toBeUndefined();
          }
        )
      );
    });

    it('should always return the same result for the same input', () => {
      fc.assert(
        fc.property(fc.string(), provider => {
          const result1 = getProviderConfig(provider);
          const result2 = getProviderConfig(provider);
          expect(result1).toBe(result2);
        })
      );
    });
  });

  describe('getDefaultModel', () => {
    it('should return correct default model for valid providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const model = getDefaultModel(provider);
          expect(model).toBeDefined();
          expect(model).toBe(PROVIDER_CONFIG[provider].defaultModel);
        })
      );
    });

    it('should throw UnknownProviderError for invalid providers', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'openai' && s !== 'anthropic'),
          provider => {
            expect(() => getDefaultModel(provider)).toThrow(
              UnknownProviderError
            );
            try {
              getDefaultModel(provider);
            } catch (error) {
              expect(error).toBeInstanceOf(UnknownProviderError);
              expect((error as UnknownProviderError).provider).toBe(provider);
              expect((error as UnknownProviderError).suggestedFallback).toBe(
                'gpt-4o-mini'
              );
            }
          }
        )
      );
    });

    it('should never return empty string for valid providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const model = getDefaultModel(provider);
          expect(model).toBeTruthy();
          expect(model.length).toBeGreaterThan(0);
        })
      );
    });
  });

  describe('getProviderFeatures', () => {
    it('should return features for valid providers', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const features = getProviderFeatures(provider);
          expect(features).toBeDefined();
          expect(features).toBe(PROVIDER_CONFIG[provider].features);
          expect(features).toHaveProperty('streaming');
          expect(features).toHaveProperty('functionCalling');
          expect(features).toHaveProperty('vision');
        })
      );
    });

    it('should return undefined for invalid providers', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              s =>
                s !== 'openai' && s !== 'anthropic' && !(s in PROVIDER_CONFIG)
            ),
          provider => {
            const features = getProviderFeatures(provider);
            expect(features).toBeUndefined();
          }
        )
      );
    });

    it('should maintain feature type consistency', () => {
      fc.assert(
        fc.property(fc.constantFrom('openai', 'anthropic'), provider => {
          const features = getProviderFeatures(provider);
          if (features) {
            expect(typeof features.streaming).toBe('boolean');
            expect(typeof features.functionCalling).toBe('boolean');
            expect(typeof features.vision).toBe('boolean');
          }
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

    it('should have consistent feature structure', () => {
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
});
