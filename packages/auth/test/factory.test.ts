import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { AuthValidatorFactory } from '../src/factory.js';
import { InternalJWTValidator } from '../src/validators/internal.js';
import { ExternalJWTValidator } from '../src/validators/external.js';
import { JWKSValidator } from '../src/validators/jwks.js';
import { AutoDiscoveryValidator } from '../src/validators/auto-discovery.js';
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
    it('should create JWKSValidator for CONFIGURED_ISSUER mode', () => {
      const config = {
        EXTERNAL_JWT_ISSUER: 'https://auth.example.com',
      };

      const validators = AuthValidatorFactory.create(config, mockFastify);

      expect(validators).toHaveLength(1);
      expect(validators[0]).toBeInstanceOf(JWKSValidator);
    });

    it('should create ExternalJWTValidator for LEGACY_KEY mode', () => {
      const config = {
        EXTERNAL_JWT_PUBLIC_KEY: 'some-public-key',
      };

      const validators = AuthValidatorFactory.create(config, mockFastify);

      expect(validators).toHaveLength(1);
      expect(validators[0]).toBeInstanceOf(ExternalJWTValidator);
    });

    it('should create both AutoDiscoveryValidator and InternalJWTValidator for AUTO_DISCOVERY mode', () => {
      const config = {
        NODE_ENV: 'development',
      };

      const validators = AuthValidatorFactory.create(config, mockFastify);

      expect(validators).toHaveLength(3);
      expect(validators[0]).toBeInstanceOf(ClerkValidator);
      expect(validators[1]).toBeInstanceOf(AutoDiscoveryValidator);
      expect(validators[2]).toBeInstanceOf(InternalJWTValidator);
    });

    it('should create InternalJWTValidator for ANONYMOUS mode', () => {
      const config = {
        NODE_ENV: 'production',
      };

      const validators = AuthValidatorFactory.create(config, mockFastify);

      expect(validators).toHaveLength(1);
      expect(validators[0]).toBeInstanceOf(InternalJWTValidator);
    });

    it('should log the detected mode', () => {
      const config = {
        EXTERNAL_JWT_ISSUER: 'https://auth.example.com',
        NODE_ENV: 'production',
      };

      AuthValidatorFactory.create(config, mockFastify);

      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'configured',
          issuer: 'https://auth.example.com',
          nodeEnv: 'production',
        }),
        expect.stringContaining('External auth configured')
      );
    });
  });
});
