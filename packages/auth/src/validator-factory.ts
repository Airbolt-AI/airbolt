import type { FastifyInstance } from 'fastify';
import type { Algorithm } from 'jsonwebtoken';
import {
  InternalJWTValidator,
  ExternalJWTValidator,
  type JWTValidator,
} from './jwt-validators.js';
import { JWKSValidator } from './jwks-validator.js';
import { AutoDiscoveryValidator } from './auto-discovery-validator.js';

export enum AuthMode {
  ANONYMOUS = 'anonymous', // No external auth configured
  CONFIGURED_ISSUER = 'configured', // EXTERNAL_JWT_ISSUER set
  LEGACY_KEY = 'legacy', // PUBLIC_KEY/SECRET set
  AUTO_DISCOVERY = 'auto', // Development mode catch-all
}

export interface AuthConfig {
  NODE_ENV?: string | undefined;
  EXTERNAL_JWT_ISSUER?: string | undefined;
  EXTERNAL_JWT_PUBLIC_KEY?: string | undefined;
  EXTERNAL_JWT_SECRET?: string | undefined;
  EXTERNAL_JWT_AUDIENCE?: string | undefined;
}

export class AuthModeDetector {
  static detect(config: AuthConfig): AuthMode {
    if (config.EXTERNAL_JWT_ISSUER) {
      return AuthMode.CONFIGURED_ISSUER;
    }

    if (config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET) {
      return AuthMode.LEGACY_KEY;
    }

    if (config.NODE_ENV !== 'production') {
      return AuthMode.AUTO_DISCOVERY;
    }

    return AuthMode.ANONYMOUS;
  }

  static getDescription(mode: AuthMode): string {
    switch (mode) {
      case AuthMode.ANONYMOUS:
        return '🔓 Anonymous mode - using internal JWT tokens';
      case AuthMode.CONFIGURED_ISSUER:
        return '🔐 External auth configured with issuer validation';
      case AuthMode.LEGACY_KEY:
        return '🔑 Legacy external auth with manual key configuration';
      case AuthMode.AUTO_DISCOVERY:
        return '🔧 Development mode - auto-discovering external JWTs';
      default:
        return `Unknown auth mode: ${mode}`;
    }
  }
}

export class AuthValidatorFactory {
  static create(config: AuthConfig, fastify: FastifyInstance): JWTValidator[] {
    const mode = AuthModeDetector.detect(config);
    const isProd = config.NODE_ENV === 'production';

    fastify.log.info(
      { mode, issuer: config.EXTERNAL_JWT_ISSUER },
      AuthModeDetector.getDescription(mode)
    );

    switch (mode) {
      case AuthMode.ANONYMOUS:
        return [new InternalJWTValidator(fastify)];

      case AuthMode.CONFIGURED_ISSUER: {
        const validators: JWTValidator[] = [];

        // JWKS validator for the configured issuer
        validators.push(
          new JWKSValidator(
            config.EXTERNAL_JWT_ISSUER!,
            config.EXTERNAL_JWT_PUBLIC_KEY // Optional fallback key
          )
        );

        // Auto-discovery with strict issuer validation
        validators.push(
          new AutoDiscoveryValidator({
            issuer: config.EXTERNAL_JWT_ISSUER,
            audience: config.EXTERNAL_JWT_AUDIENCE,
            isProduction: isProd,
          })
        );

        return validators;
      }

      case AuthMode.LEGACY_KEY: {
        const key =
          config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET!;
        const algorithms: Algorithm[] = config.EXTERNAL_JWT_PUBLIC_KEY
          ? ['RS256']
          : ['HS256'];

        return [new ExternalJWTValidator(key, algorithms)];
      }

      case AuthMode.AUTO_DISCOVERY:
        return [
          new InternalJWTValidator(fastify),
          new AutoDiscoveryValidator({
            issuer: config.EXTERNAL_JWT_ISSUER,
            audience: config.EXTERNAL_JWT_AUDIENCE,
            isProduction: false,
          }),
        ];

      default: {
        // This should never happen due to exhaustive switch
        throw new Error(`Unknown auth mode: ${mode as string}`);
      }
    }
  }
}
