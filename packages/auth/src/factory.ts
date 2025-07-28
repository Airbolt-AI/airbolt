import type { FastifyInstance } from 'fastify';
import type { JWTValidator, AuthConfig } from './types.js';
import { AuthMode } from './types.js';
import { AuthModeDetector } from './utils/auth-mode-detector.js';
import { InternalJWTValidator } from './validators/internal.js';
import { ExternalJWTValidator } from './validators/external.js';
import { JWKSValidator } from './validators/jwks.js';
import { AutoDiscoveryValidator } from './validators/auto-discovery.js';

export class AuthValidatorFactory {
  static create(config: AuthConfig, fastify: FastifyInstance): JWTValidator[] {
    const mode = AuthModeDetector.detect(config);

    fastify.log.info(
      { mode, issuer: config.EXTERNAL_JWT_ISSUER, nodeEnv: config.NODE_ENV },
      AuthModeDetector.getDescription(mode)
    );

    switch (mode) {
      case AuthMode.CONFIGURED_ISSUER:
        return [new JWKSValidator(config)];

      case AuthMode.LEGACY_KEY:
        return [new ExternalJWTValidator(config)];

      case AuthMode.AUTO_DISCOVERY:
        return [new AutoDiscoveryValidator(config)];

      case AuthMode.ANONYMOUS:
        // Always provide internal JWT validator for anonymous mode
        return [new InternalJWTValidator(fastify)];

      default: {
        // This should never happen due to exhaustive switch
        throw new Error(`Unknown auth mode: ${mode as string}`);
      }
    }
  }
}
