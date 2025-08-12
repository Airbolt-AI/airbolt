import { describe, it, expect, vi, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import type { FastifyInstance } from 'fastify';
import { AuthValidatorFactory } from '../src/factory.js';
import { InternalJWTValidator } from '../src/validators/internal.js';
import { ExternalJWTValidator } from '../src/validators/external.js';
import { ClerkValidator } from '../src/validators/clerk.js';

describe('AuthValidatorFactory', () => {
  let mockFastify: FastifyInstance;

  beforeEach(() => {
    mockFastify = {
      log: {
        info: vi.fn(),
      },
    } as any;
  });

  describe('create', () => {
    test.prop([
      fc.webUrl().filter(url => url.startsWith('https://')),
      fc.option(fc.constantFrom('development', 'production', 'test')),
    ])(
      'should create ExternalJWTValidator for any CONFIGURED_ISSUER mode',
      (issuer, nodeEnv) => {
        const config: any = {
          EXTERNAL_JWT_ISSUER: issuer,
        };
        if (nodeEnv !== null) config.NODE_ENV = nodeEnv;

        const validators = AuthValidatorFactory.create(config, mockFastify);

        expect(validators).toHaveLength(1);
        expect(validators[0]).toBeInstanceOf(ExternalJWTValidator);
      }
    );

    test.prop([
      fc.string({ minLength: 20, maxLength: 500 }), // public key
      fc.option(fc.constantFrom('development', 'production', 'test')),
    ])(
      'should create ExternalJWTValidator for any LEGACY_KEY mode',
      (publicKey, nodeEnv) => {
        const config: any = {
          EXTERNAL_JWT_PUBLIC_KEY: publicKey,
        };
        if (nodeEnv !== null) config.NODE_ENV = nodeEnv;

        const validators = AuthValidatorFactory.create(config, mockFastify);

        expect(validators).toHaveLength(1);
        expect(validators[0]).toBeInstanceOf(ExternalJWTValidator);
      }
    );

    it('should create multiple validators for AUTO_DISCOVERY mode in development', () => {
      const config = {
        NODE_ENV: 'development', // Only 'development' triggers auto-discovery
      };

      const validators = AuthValidatorFactory.create(config, mockFastify);

      expect(validators).toHaveLength(3);
      expect(validators[0]).toBeInstanceOf(ClerkValidator);
      expect(validators[1]).toBeInstanceOf(ExternalJWTValidator);
      expect(validators[2]).toBeInstanceOf(InternalJWTValidator);
    });

    test.prop([
      fc.constantFrom('production', 'prod', 'test'), // non-development environments
    ])(
      'should create only InternalJWTValidator for ANONYMOUS mode in production',
      nodeEnv => {
        const config = {
          NODE_ENV: nodeEnv,
        };

        const validators = AuthValidatorFactory.create(config, mockFastify);

        expect(validators).toHaveLength(1);
        expect(validators[0]).toBeInstanceOf(InternalJWTValidator);
      }
    );

    test.prop([
      fc.record({
        EXTERNAL_JWT_ISSUER: fc.option(
          fc.webUrl().filter(url => url.startsWith('https://'))
        ),
        EXTERNAL_JWT_PUBLIC_KEY: fc.option(
          fc.string({ minLength: 20, maxLength: 500 })
        ),
        EXTERNAL_JWT_AUDIENCE: fc.option(fc.string()),
        NODE_ENV: fc.option(
          fc.constantFrom('development', 'production', 'test')
        ),
      }),
    ])('should prioritize configuration modes correctly', config => {
      // Remove null values to simulate missing env vars
      const cleanConfig = Object.fromEntries(
        Object.entries(config).filter(([, value]) => value !== null)
      ) as any;

      const validators = AuthValidatorFactory.create(cleanConfig, mockFastify);

      // Verify correct priority: ISSUER > PUBLIC_KEY > AUTO_DISCOVERY > ANONYMOUS
      if (
        cleanConfig.EXTERNAL_JWT_ISSUER ||
        cleanConfig.EXTERNAL_JWT_PUBLIC_KEY
      ) {
        expect(validators[0]).toBeInstanceOf(ExternalJWTValidator);
      } else if (cleanConfig.NODE_ENV === 'development') {
        expect(validators).toHaveLength(3);
        expect(validators[0]).toBeInstanceOf(ClerkValidator);
      } else {
        expect(validators[0]).toBeInstanceOf(InternalJWTValidator);
      }
    });

    test.prop([
      fc.record({
        EXTERNAL_JWT_ISSUER: fc.option(
          fc.webUrl().filter(url => url.startsWith('https://'))
        ),
        EXTERNAL_JWT_PUBLIC_KEY: fc.option(fc.string({ minLength: 20 })),
        NODE_ENV: fc.constantFrom('development', 'production', 'test'),
      }),
    ])('should always log the detected mode', config => {
      const cleanConfig = Object.fromEntries(
        Object.entries(config).filter(([, value]) => value !== null)
      ) as any;

      vi.clearAllMocks();
      AuthValidatorFactory.create(cleanConfig, mockFastify);

      expect(mockFastify.log.info).toHaveBeenCalledOnce();
      const [logData, logMessage] = (mockFastify.log.info as any).mock.calls[0];

      // Verify correct mode is logged
      if (cleanConfig.EXTERNAL_JWT_ISSUER) {
        expect(logData.mode).toBe('configured');
        expect(logMessage).toContain('External auth configured');
      } else if (cleanConfig.EXTERNAL_JWT_PUBLIC_KEY) {
        expect(logData.mode).toBe('legacy');
        expect(logMessage).toContain('Legacy external auth with manual key');
      } else if (cleanConfig.NODE_ENV === 'development') {
        expect(logData.mode).toBe('auto');
        expect(logMessage).toContain('Development mode - auto-discovering');
      } else {
        expect(logData.mode).toBe('anonymous');
        expect(logMessage).toContain('Anonymous mode - using internal JWT');
      }
    });
  });
});
