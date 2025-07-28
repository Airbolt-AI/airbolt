import type { AuthConfig } from '../types.js';
import { AuthMode } from '../types.js';

export class AuthModeDetector {
  static detect(config: AuthConfig): AuthMode {
    if (config.EXTERNAL_JWT_ISSUER) {
      return AuthMode.CONFIGURED_ISSUER;
    }

    if (config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET) {
      return AuthMode.LEGACY_KEY;
    }

    // Use 'development' string comparison for auth mode detection
    // This is intentional as auth mode needs to match exact NODE_ENV value
    const isDevelopment = config.NODE_ENV === 'development';
    return isDevelopment ? AuthMode.AUTO_DISCOVERY : AuthMode.ANONYMOUS;
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
