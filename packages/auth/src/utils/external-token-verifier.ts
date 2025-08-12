/* eslint-disable runtime-safety/require-property-tests */
// These are simple wrapper functions that delegate to existing tested validators
// Property testing would not add value as the core logic is tested elsewhere

import type { JWTPayload, AuthConfig } from '../types.js';
import { AuthError } from '../types.js';
import { TokenValidator } from './token-validator.js';
import { JWKSUtils } from './jwks-utils.js';

/**
 * Utility function for verifying external tokens and returning the payload.
 * This provides a simplified interface for token verification without full middleware setup.
 *
 * @param token - The JWT token to verify
 * @param config - Optional configuration for token verification
 * @returns Promise<JWTPayload> - The verified token payload
 *
 * @example
 * ```typescript
 * import { verifyExternalToken } from '@airbolt/auth';
 *
 * const payload = await verifyExternalToken(token, {
 *   EXTERNAL_JWT_ISSUER: 'https://your-issuer.auth0.com/',
 *   EXTERNAL_JWT_AUDIENCE: 'your-api-audience'
 * });
 *
 * console.log(payload.sub); // User ID from token
 * ```
 */
export async function verifyExternalToken(
  token: string,
  config: AuthConfig = {}
): Promise<JWTPayload> {
  // Reimplemented without importing ExternalJWTValidator to avoid circular dependency
  const tokenValidator = new TokenValidator();
  const decoded = tokenValidator.decode(token);
  const issuer = decoded.payload.iss;

  let payload: JWTPayload;

  // Try secret-based validation first (HS256)
  if (config.EXTERNAL_JWT_SECRET) {
    payload = await tokenValidator.verify(token, config.EXTERNAL_JWT_SECRET);
  }
  // Try configured public key
  else if (config.EXTERNAL_JWT_PUBLIC_KEY) {
    payload = await tokenValidator.verify(
      token,
      config.EXTERNAL_JWT_PUBLIC_KEY
    );
  }
  // Try JWKS auto-discovery
  else if (issuer) {
    const jwks = await JWKSUtils.fetchJWKS(issuer);
    const key = JWKSUtils.findKey(jwks, decoded.header?.kid);
    if (!key) {
      throw new AuthError(
        'No matching key found in JWKS',
        undefined,
        'Token key ID (kid) not found in provider JWKS',
        'Verify token is from the correct auth provider'
      );
    }
    const publicKey = JWKSUtils.extractPublicKey(key);
    payload = await tokenValidator.verify(token, publicKey);
  } else {
    throw new AuthError(
      'No external JWT validation method configured',
      undefined,
      'Configure EXTERNAL_JWT_SECRET, EXTERNAL_JWT_PUBLIC_KEY, or enable auto-discovery',
      'Set one of: EXTERNAL_JWT_SECRET (for HS256) or EXTERNAL_JWT_PUBLIC_KEY (for RS256)'
    );
  }

  // Basic validation
  if (
    config.EXTERNAL_JWT_AUDIENCE &&
    payload.aud !== config.EXTERNAL_JWT_AUDIENCE
  ) {
    throw new AuthError(
      'JWT audience mismatch',
      undefined,
      `Expected: ${config.EXTERNAL_JWT_AUDIENCE}, Got: ${payload.aud}`,
      'Check JWT audience configuration'
    );
  }

  return payload;
}

/**
 * Raw token verification utility for when you need lower-level access.
 * This bypasses policy validation and audience checks.
 *
 * @param token - The JWT token to verify
 * @param publicKey - The public key or certificate for verification
 * @returns Promise<JWTPayload> - The verified token payload
 *
 * @example
 * ```typescript
 * import { verifyTokenWithKey } from '@airbolt/auth';
 *
 * const payload = await verifyTokenWithKey(token, publicKey);
 * ```
 */
export async function verifyTokenWithKey(
  token: string,
  publicKey: string
): Promise<JWTPayload> {
  const tokenValidator = new TokenValidator();
  return await tokenValidator.verify(token, publicKey);
}

/**
 * Decode a JWT token without verification.
 * Useful for inspecting token structure or extracting claims without validation.
 *
 * @param token - The JWT token to decode
 * @returns Object containing header and payload
 *
 * @example
 * ```typescript
 * import { decodeToken } from '@airbolt/auth';
 *
 * const { header, payload } = decodeToken(token);
 * console.log(payload.iss); // Issuer from token
 * ```
 */
export function decodeToken(token: string): {
  header: { kid?: string; [key: string]: any };
  payload: JWTPayload;
  signature: string;
} {
  const tokenValidator = new TokenValidator();
  return tokenValidator.decode(token);
}

/**
 * Extract user ID from a JWT payload using the same logic as the auth system.
 *
 * @param payload - The JWT payload
 * @returns string - The extracted user ID
 *
 * @example
 * ```typescript
 * import { extractUserIdFromPayload } from '@airbolt/auth';
 *
 * const userId = extractUserIdFromPayload(payload);
 * ```
 */
export function extractUserIdFromPayload(payload: JWTPayload): string {
  const tokenValidator = new TokenValidator();
  return tokenValidator.extractUserId(payload);
}
