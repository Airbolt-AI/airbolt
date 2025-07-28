// Clean public API - only expose what's needed
export { AuthValidatorFactory } from './factory.js';
export { createAuthMiddleware, type AuthUser } from './middleware.js';
export type { JWTPayload, AuthConfig, AuthMode } from './types.js';
