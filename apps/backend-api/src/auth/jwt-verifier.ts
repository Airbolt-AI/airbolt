import * as jwt from 'jsonwebtoken';
import { jwtVerify, type JWTPayload } from 'jose';
import { jwksCache } from './jwks-cache.js';
import { validateIssuerBeforeNetwork } from './issuer-validator.js';
import { type JWTClaims } from '../types/auth.js';
import { jwtSingleFlight, createHashKey } from './single-flight.js';

/**
 * Determines if the application is running in development mode.
 * Development mode is enabled when:
 * - NODE_ENV is not 'production' AND
 * - AUTH_REQUIRED environment variable is not set
 *
 * This allows existing users to continue using the API without auth
 * while providing a clear path to enable authentication when needed.
 */
export function isDevelopmentMode(): boolean {
  return (
    // eslint-disable-next-line runtime-safety/no-direct-env-access -- Development mode detection before config is available
    process.env['NODE_ENV'] !== 'production' &&
    // eslint-disable-next-line runtime-safety/no-direct-env-access -- Development mode detection before config is available
    !process.env['AUTH_REQUIRED']
  );
}

/**
 * Generates a development token for testing and backwards compatibility.
 * Only available in development mode to prevent accidental production usage.
 *
 * @param identifier - Unique identifier (typically request IP) for the dev user
 * @returns Signed JWT token valid for 10 minutes
 * @throws Error if called in production or when AUTH_REQUIRED is set
 */
export function generateDevelopmentToken(identifier: string): string {
  if (!isDevelopmentMode()) {
    throw new Error('Development tokens only available in dev mode');
  }

  if (!identifier || identifier.trim() === '') {
    throw new Error('Identifier is required for development token');
  }

  const claims = {
    sub: `dev-user-${identifier}`,
    email: `dev-${identifier}@localhost`,
    iss: 'airbolt-development',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
  };

  // Use a consistent dev secret - will be overridden by env config if provided
  const secret =
    // eslint-disable-next-line runtime-safety/no-direct-env-access -- Development token generation before config is available
    process.env['JWT_SECRET'] ?? 'dev-secret-do-not-use-in-production';
  return jwt.sign(claims, secret);
}

/**
 * Verifies a JWT token using the jose library with proper JWKS validation.
 * Uses single-flight coalescing to prevent duplicate verification of the same token.
 *
 * This function:
 * 1. Uses single-flight to coalesce concurrent verifications of the same token
 * 2. Validates the issuer before making any network calls
 * 3. Retrieves the appropriate JWKS key set for signature verification
 * 4. Verifies the JWT signature, expiration, and standard claims
 * 5. Returns parsed claims on successful verification
 *
 * @param token - The JWT token string to verify
 * @param externalJwtIssuer - Optional custom issuer URL for validation
 * @returns Promise resolving to parsed JWT claims
 * @throws Error for invalid tokens, expired tokens, or verification failures
 */
export async function verifyJWT(
  token: string,
  externalJwtIssuer?: string
): Promise<JWTClaims> {
  // Use single-flight to coalesce concurrent verifications of the same token
  // Hash the token for privacy - don't store actual tokens in memory
  const tokenKey = createHashKey(token + (externalJwtIssuer ?? ''));

  return jwtSingleFlight.do(tokenKey, async () => {
    return verifyJWTInternal(token, externalJwtIssuer);
  });
}

/**
 * Internal JWT verification implementation without single-flight coalescing.
 * This is the actual verification logic that gets coalesced by verifyJWT.
 */
async function verifyJWTInternal(
  token: string,
  externalJwtIssuer?: string
): Promise<JWTClaims> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Invalid token: must be a non-empty string');
  }

  // Parse token without verification to extract issuer for validation
  let payload: JWTPayload;
  try {
    // Split token to get payload section
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode payload (base64url) - ensure we have a valid part
    const payloadPart = parts[1];
    if (!payloadPart) {
      throw new Error('Invalid token format');
    }

    const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf-8');
    payload = JSON.parse(payloadJson) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid token format: unable to parse JWT structure');
  }

  // Extract and validate issuer
  const issuer = payload.iss;
  if (!issuer || typeof issuer !== 'string') {
    throw new Error('Invalid token: missing or invalid issuer claim');
  }

  // Validate issuer before making any network calls
  try {
    validateIssuerBeforeNetwork(issuer, externalJwtIssuer);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Token verification failed: ${errorMessage}`);
  }

  // Get JWKS key set for this issuer
  let getKey;
  try {
    getKey = jwksCache.getOrCreate(issuer);
  } catch (error) {
    throw new Error('Unable to retrieve signing keys for token verification');
  }

  // Verify the JWT using jose
  try {
    const { payload: verifiedPayload } = await jwtVerify(token, getKey, {
      // Let jose handle issuer validation against the token
      issuer: issuer,
      // Clock tolerance for network delays (5 seconds)
      clockTolerance: 5,
    });

    // Convert jose payload to our JWTClaims type
    const claims: JWTClaims = {
      sub: verifiedPayload.sub!,
      iss: verifiedPayload.iss!,
      exp: verifiedPayload.exp!,
      iat: verifiedPayload.iat!,
      // Include any additional claims
      ...verifiedPayload,
    };

    // Handle optional fields separately to satisfy TypeScript's exactOptionalPropertyTypes
    if (verifiedPayload.aud !== undefined) {
      claims.aud = verifiedPayload.aud;
    }

    if (typeof verifiedPayload['email'] === 'string') {
      claims.email = verifiedPayload['email'];
    }

    return claims;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific jose error types
      if (error.message.includes('expired')) {
        throw new Error('Token has expired');
      }
      if (error.message.includes('signature')) {
        throw new Error('Token signature verification failed');
      }
      if (error.message.includes('audience')) {
        throw new Error('Token audience validation failed');
      }
      if (error.message.includes('issuer')) {
        throw new Error('Token issuer validation failed');
      }
      if (error.message.includes('before')) {
        throw new Error('Token is not yet valid');
      }

      // Generic verification failure
      throw new Error('Token verification failed');
    }

    throw new Error('Token verification failed due to unknown error');
  }
}

export class JwtVerifier {
  // Implementation will be added in subsequent phases
}
