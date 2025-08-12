import type { FastifyInstance } from 'fastify';
import type { JWTValidator, AuthConfig } from './types.js';
import { AuthMode, AuthError } from './types.js';
import { AuthModeDetector } from './utils/auth-mode-detector.js';
import { InternalJWTValidator } from './validators/internal.js';
import { ExternalJWTValidator } from './validators/external.js';
import { ClerkValidator } from './validators/clerk.js';

export class AuthValidatorFactory {
  static create(config: AuthConfig, fastify: FastifyInstance): JWTValidator[] {
    const mode = AuthModeDetector.detect(config);

    fastify.log.info(
      { mode, issuer: config.EXTERNAL_JWT_ISSUER, nodeEnv: config.NODE_ENV },
      AuthModeDetector.getDescription(mode)
    );

    switch (mode) {
      case AuthMode.CONFIGURED_ISSUER:
      case AuthMode.LEGACY_KEY:
        // Both configured issuer and legacy key modes use the unified external validator
        // The ExternalJWTValidator handles both secret-based and JWKS validation
        return [new ExternalJWTValidator(config)];

      case AuthMode.AUTO_DISCOVERY:
        // In auto-discovery mode, support Clerk, other external tokens, and internal tokens
        // ClerkValidator goes first since it's more specific than general external validation
        return [
          new ClerkValidator(config),
          new ExternalJWTValidator(config),
          new InternalJWTValidator(fastify),
        ];

      case AuthMode.ANONYMOUS:
        // Always provide internal JWT validator for anonymous mode
        return [new InternalJWTValidator(fastify)];

      default: {
        // This should never happen due to exhaustive switch
        throw new AuthError(
          `Unknown auth mode: ${mode as string}`,
          undefined,
          'Invalid auth configuration detected',
          'Check environment variables and auth configuration'
        );
      }
    }
  }
}
