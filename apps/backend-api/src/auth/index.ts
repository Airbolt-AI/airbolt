/**
 * JWT verification and authentication module
 *
 * This module provides secure JWT verification with JWKS caching,
 * automatic provider detection (Clerk and manual OIDC), and
 * comprehensive error handling.
 *
 * @example
 * ```typescript
 * import { verifyToken, detectProvider, extractIssuerFromToken, createCachedJWKSFetcher } from './auth';
 *
 * // Extract issuer from token for provider detection
 * const issuer = extractIssuerFromToken(jwtToken);
 *
 * // Detect provider configuration
 * const provider = await detectProvider(issuer);
 *
 * // Verify token with caching
 * const cachedFetcher = createCachedJWKSFetcher();
 * const result = await verifyToken({
 *   token: jwtToken,
 *   jwksUrl: provider.jwksUrl,
 *   issuer: provider.issuer,
 *   audience: provider.audience,
 * }, cachedFetcher);
 * ```
 */

// JWT Verification
export {
  verifyToken,
  JWTVerificationError,
  type JWTVerificationOptions,
  type JWTVerificationResult,
  type JWKSFetcher,
} from './jwt-verifier.js';

// JWKS Caching
export {
  JWKSCache,
  globalJWKSCache,
  createCachedJWKSFetcher,
  type JWKSCacheConfig,
} from './jwks-cache.js';

// Provider Detection
export {
  detectProvider,
  validateProvider,
  getConfiguredProviders,
  extractIssuerFromToken,
  ProviderDetectionError,
  type JWTProvider,
} from './providers.js';
