import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { AuthModeDetector } from '../src/utils/auth-mode-detector.js';
import { AuthMode } from '../src/types.js';

describe('AuthModeDetector', () => {
  // Keep some original unit tests for specific cases
  describe('Unit Tests - Specific Cases', () => {
    it('should detect ANONYMOUS mode when no config provided', () => {
      const config = {};
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.ANONYMOUS);
    });

    it('should detect AUTO_DISCOVERY mode specifically for development', () => {
      const config = { NODE_ENV: 'development' };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.AUTO_DISCOVERY);
    });
  });

  describe('Property-Based Tests', () => {
    test.prop([
      fc.webUrl().filter(url => url.startsWith('https://')), // Valid HTTPS URL
    ])(
      'should detect CONFIGURED_ISSUER mode for any valid HTTPS issuer',
      issuer => {
        const config = { EXTERNAL_JWT_ISSUER: issuer };
        expect(AuthModeDetector.detect(config)).toBe(
          AuthMode.CONFIGURED_ISSUER
        );
      }
    );

    test.prop([
      fc.string({ minLength: 1, maxLength: 1000 }), // Any non-empty string
    ])('should detect LEGACY_KEY mode for any public key value', publicKey => {
      const config = { EXTERNAL_JWT_PUBLIC_KEY: publicKey };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.LEGACY_KEY);
    });

    test.prop([
      fc.string({ minLength: 1, maxLength: 1000 }), // Any non-empty string
    ])('should detect LEGACY_KEY mode for any secret value', secret => {
      const config = { EXTERNAL_JWT_SECRET: secret };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.LEGACY_KEY);
    });

    test.prop([
      fc.constantFrom(
        'production',
        'prod',
        'test',
        'staging',
        'Production',
        'PRODUCTION',
        'Test',
        'TEST',
        'dev',
        'local',
        'qa',
        '' // Non-development values
      ),
    ])(
      'should detect ANONYMOUS mode for non-development environments',
      nodeEnv => {
        const config = { NODE_ENV: nodeEnv };
        const result = AuthModeDetector.detect(config);

        // All these values should result in ANONYMOUS mode
        expect(result).toBe(AuthMode.ANONYMOUS);
      }
    );

    test.prop([
      fc.webUrl().filter(url => url.startsWith('https://')), // Valid issuer
      fc.string({ minLength: 1, maxLength: 100 }), // Public key
      fc.constantFrom('development', 'production', 'test'), // Node env
    ])(
      'should always prioritize CONFIGURED_ISSUER when issuer is present',
      (issuer, publicKey, nodeEnv) => {
        const config = {
          EXTERNAL_JWT_ISSUER: issuer,
          EXTERNAL_JWT_PUBLIC_KEY: publicKey,
          NODE_ENV: nodeEnv,
        };
        expect(AuthModeDetector.detect(config)).toBe(
          AuthMode.CONFIGURED_ISSUER
        );
      }
    );

    test.prop([
      fc.string({ minLength: 1, maxLength: 100 }), // Public key
      fc.string({ minLength: 1, maxLength: 100 }), // Secret
      fc.constantFrom('development', 'production', 'test'), // Node env
    ])(
      'should prioritize LEGACY_KEY when keys are present but no issuer',
      (publicKey, secret, nodeEnv) => {
        const config = {
          EXTERNAL_JWT_PUBLIC_KEY: publicKey,
          EXTERNAL_JWT_SECRET: secret,
          NODE_ENV: nodeEnv,
        };
        expect(AuthModeDetector.detect(config)).toBe(AuthMode.LEGACY_KEY);
      }
    );

    test.prop([
      fc.record(
        {
          SOME_OTHER_VAR: fc.option(fc.string()),
          DATABASE_URL: fc.option(fc.webUrl()),
          PORT: fc.option(fc.integer({ min: 1, max: 65535 }).map(String)),
          // Deliberately exclude auth-related vars
        },
        { requiredKeys: [] }
      ),
    ])('should default to ANONYMOUS when no auth config is present', config => {
      // Ensure no auth-related keys are present
      const cleanConfig = {
        ...config,
        NODE_ENV: 'production', // Force non-development
      };
      delete (cleanConfig as any).EXTERNAL_JWT_ISSUER;
      delete (cleanConfig as any).EXTERNAL_JWT_PUBLIC_KEY;
      delete (cleanConfig as any).EXTERNAL_JWT_SECRET;

      expect(AuthModeDetector.detect(cleanConfig)).toBe(AuthMode.ANONYMOUS);
    });
  });

  describe('getDescription - Property Tests', () => {
    test.prop([
      fc.constantFrom(
        AuthMode.ANONYMOUS,
        AuthMode.CONFIGURED_ISSUER,
        AuthMode.LEGACY_KEY,
        AuthMode.AUTO_DISCOVERY
      ),
    ])('should return non-empty description for any valid auth mode', mode => {
      const description = AuthModeDetector.getDescription(mode);
      expect(description).toBeTruthy();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);

      // Verify specific content based on mode
      switch (mode) {
        case AuthMode.ANONYMOUS:
          expect(description).toContain('Anonymous mode');
          break;
        case AuthMode.CONFIGURED_ISSUER:
          expect(description).toContain('External auth configured');
          break;
        case AuthMode.LEGACY_KEY:
          expect(description).toContain('Legacy external auth');
          break;
        case AuthMode.AUTO_DISCOVERY:
          expect(description).toContain('Development mode');
          break;
      }
    });
  });
});
