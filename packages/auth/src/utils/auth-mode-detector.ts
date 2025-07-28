import type { AuthConfig, AuthMode } from '../types.js';
import { AuthMode as AuthModeEnum } from '../types.js';

export class AuthModeDetector {
  static detect(config: AuthConfig): AuthMode {
    if (config.EXTERNAL_JWT_ISSUER) {
      return AuthModeEnum.CONFIGURED_ISSUER;
    }

    if (config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET) {
      return AuthModeEnum.LEGACY_KEY;
    }

    // Auto-discovery for development environments only (not test)
    const env = config.NODE_ENV?.toLowerCase();
    if (env === 'development' || env === 'dev') {
      return AuthModeEnum.AUTO_DISCOVERY;
    }

    return AuthModeEnum.ANONYMOUS;
  }

  static getDescription(mode: AuthMode): string {
    switch (mode) {
      case AuthModeEnum.ANONYMOUS:
        return '🔓 Anonymous mode - using internal JWT tokens';
      case AuthModeEnum.CONFIGURED_ISSUER:
        return '🔐 External auth configured with issuer validation';
      case AuthModeEnum.LEGACY_KEY:
        return '🔑 Legacy external auth with manual key configuration';
      case AuthModeEnum.AUTO_DISCOVERY:
        return '🔧 Development mode - auto-discovering external JWTs';
      default: {
        const exhaustiveCheck: never = mode;
        return `Unknown auth mode: ${exhaustiveCheck as string}`;
      }
    }
  }
}
