import type { AuthConfig } from '../types.js';
import { AuthMode } from '../types.js';
import { isDevelopment } from '@airbolt/config';

export class AuthModeDetector {
  static detect(config: AuthConfig): AuthMode {
    if (config.EXTERNAL_JWT_ISSUER) {
      return AuthMode.CONFIGURED_ISSUER;
    }

    if (config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET) {
      return AuthMode.LEGACY_KEY;
    }

    // Use centralized environment utility for auth mode detection
    return isDevelopment() ? AuthMode.AUTO_DISCOVERY : AuthMode.ANONYMOUS;
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
    }
  }
}
