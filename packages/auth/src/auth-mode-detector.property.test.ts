import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { test } from '@fast-check/vitest';
import { AuthMode, AuthModeDetector } from './validator-factory.js';

describe('Auth Mode Detection Properties', () => {
  test.prop([
    fc.record({
      NODE_ENV: fc.option(
        fc.constantFrom(
          'development',
          'production',
          'test',
          'staging',
          'dev',
          'prod'
        ),
        { nil: undefined }
      ),
      EXTERNAL_JWT_ISSUER: fc.option(
        fc.oneof(
          fc.webUrl(),
          fc.constant(''), // Empty string
          fc.constant('not-a-url') // Invalid URL
        ),
        { nil: undefined }
      ),
      EXTERNAL_JWT_PUBLIC_KEY: fc.option(
        fc.string({ minLength: 1, maxLength: 1000 }),
        { nil: undefined }
      ),
      EXTERNAL_JWT_SECRET: fc.option(
        fc.string({ minLength: 1, maxLength: 100 }),
        { nil: undefined }
      ),
    }),
  ])('always selects exactly one deterministic auth mode', (config: any) => {
    // Property 1: Always returns a valid mode
    const mode = AuthModeDetector.detect(config);
    expect(Object.values(AuthMode)).toContain(mode);

    // Property 2: Mode selection is deterministic
    const mode2 = AuthModeDetector.detect(config);
    expect(mode2).toBe(mode);

    // Property 3: Mode has a valid description
    const description = AuthModeDetector.getDescription(mode);
    expect(description).toBeTruthy();
    expect(description.length).toBeGreaterThan(0);
  });

  test.prop([
    fc.record({
      NODE_ENV: fc.option(
        fc.constantFrom(
          'development',
          'production',
          'test',
          'staging',
          'dev',
          'prod'
        ),
        { nil: undefined }
      ),
      EXTERNAL_JWT_ISSUER: fc.option(fc.webUrl(), { nil: undefined }),
      EXTERNAL_JWT_PUBLIC_KEY: fc.option(fc.string(), { nil: undefined }),
      EXTERNAL_JWT_SECRET: fc.option(fc.string(), { nil: undefined }),
    }),
  ])('follows documented mode priority rules', (config: any) => {
    const mode = AuthModeDetector.detect(config);

    // Rule 1: EXTERNAL_JWT_ISSUER takes highest priority
    if (config.EXTERNAL_JWT_ISSUER) {
      expect(mode).toBe(AuthMode.CONFIGURED_ISSUER);
    }
    // Rule 2: Legacy keys take next priority
    else if (config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET) {
      expect(mode).toBe(AuthMode.LEGACY_KEY);
    }
    // Rule 3: Non-production defaults to auto-discovery
    else if (config.NODE_ENV !== 'production' && config.NODE_ENV !== 'prod') {
      expect(mode).toBe(AuthMode.AUTO_DISCOVERY);
    }
    // Rule 4: Production with no config means anonymous
    else {
      expect(mode).toBe(AuthMode.ANONYMOUS);
    }
  });

  test.prop([
    fc.record({
      issuer1: fc.webUrl(),
      issuer2: fc.webUrl(),
      key1: fc.string({ minLength: 10 }),
      key2: fc.string({ minLength: 10 }),
    }),
  ])(
    'configuration changes produce different modes',
    ({
      issuer1,
      issuer2,
      key1,
      key2,
    }: {
      issuer1: string;
      issuer2: string;
      key1: string;
      key2: string;
    }) => {
      // Test that different configurations produce expected different modes
      const anonymousMode = AuthModeDetector.detect({ NODE_ENV: 'production' });
      const issuerMode = AuthModeDetector.detect({
        EXTERNAL_JWT_ISSUER: issuer1,
      });
      const keyMode = AuthModeDetector.detect({
        EXTERNAL_JWT_PUBLIC_KEY: key1,
      });
      const autoMode = AuthModeDetector.detect({ NODE_ENV: 'development' });

      expect(anonymousMode).toBe(AuthMode.ANONYMOUS);
      expect(issuerMode).toBe(AuthMode.CONFIGURED_ISSUER);
      expect(keyMode).toBe(AuthMode.LEGACY_KEY);
      expect(autoMode).toBe(AuthMode.AUTO_DISCOVERY);

      // Changing issuer should not change mode type
      const issuerMode2 = AuthModeDetector.detect({
        EXTERNAL_JWT_ISSUER: issuer2,
      });
      expect(issuerMode2).toBe(AuthMode.CONFIGURED_ISSUER);

      // Changing key should not change mode type
      const keyMode2 = AuthModeDetector.detect({ EXTERNAL_JWT_SECRET: key2 });
      expect(keyMode2).toBe(AuthMode.LEGACY_KEY);
    }
  );

  it('exhaustive mode descriptions', () => {
    // Ensure all modes have descriptions
    Object.values(AuthMode).forEach(mode => {
      const description = AuthModeDetector.getDescription(mode);
      expect(description).toBeTruthy();
      expect(description).not.toContain('Unknown auth mode');
    });

    // Test the exhaustive check works
    const invalidMode = 'invalid-mode' as any;
    const description = AuthModeDetector.getDescription(invalidMode);
    expect(description).toContain('Unknown auth mode');
  });
});
