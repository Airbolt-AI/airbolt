// Clean public API - only expose what's needed
export { AuthValidatorFactory } from './factory.js';
export { createAuthMiddleware, type AuthUser } from './middleware.js';
export type {
  JWTPayload,
  JWTValidator,
  AuthConfig,
  AuthMode,
} from './types.js';
export { AuthError } from './types.js';

// Export utilities for external token verification
export { TokenValidator } from './utils/token-validator.js';
export { JWKSUtils } from './utils/jwks-utils.js';
// Note: ExternalJWTValidator removed to break circular dependency
// Users should use AuthValidatorFactory.create() instead

// Utility functions for external token verification
export {
  verifyExternalToken,
  verifyTokenWithKey,
  decodeToken,
  extractUserIdFromPayload,
} from './utils/external-token-verifier.js';
