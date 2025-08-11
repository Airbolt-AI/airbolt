import { verifyJWT } from './jwt-verifier.js';
import { detectIssuerType, IssuerType } from './issuer-validator.js';
import { type JWTClaims } from '../types/auth.js';

/**
 * Clerk-specific JWT claims interface extending the base JWTClaims
 * Includes Clerk-specific fields like authorized parties, organization data, and session info
 */
export interface ClerkJWTClaims extends JWTClaims {
  azp?: string; // Authorized party - used for cross-origin requests
  org_id?: string; // Organization ID
  org_slug?: string; // Organization slug
  org_role?: string; // Organization role
  session_id?: string; // Session ID
  act?: {
    // Actor token for impersonation
    sub: string;
    [key: string]: unknown;
  };
}

/**
 * Options for Clerk token verification
 */
export interface ClerkVerificationOptions {
  /** List of authorized parties that are allowed for this token */
  authorizedParties?: string[];
  /** Clock skew tolerance in seconds (defaults to 5) */
  clockSkewInSeconds?: number;
}

/**
 * Verifies a Clerk JWT token with Clerk-specific validations.
 *
 * This function:
 * 1. Uses the core JWT verifier for standard validation
 * 2. Validates that the issuer is indeed a Clerk issuer
 * 3. Validates authorized parties (azp) if present
 * 4. Returns Clerk-enriched claims
 *
 * @param token - The JWT token string to verify
 * @param options - Clerk-specific verification options
 * @returns Promise resolving to Clerk JWT claims
 * @throws Error for invalid tokens, unauthorized parties, or non-Clerk issuers
 */
export async function verifyClerkToken(
  token: string,
  options?: ClerkVerificationOptions
): Promise<ClerkJWTClaims> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Invalid token: must be a non-empty string');
  }

  // First, perform standard JWT verification
  const baseClaims = await verifyJWT(token);

  // Validate that this is actually a Clerk token
  const issuerType = detectIssuerType(baseClaims.iss);
  if (issuerType !== IssuerType.CLERK) {
    throw new Error(
      `Token is not from Clerk. Issuer: ${baseClaims.iss} (detected type: ${issuerType})`
    );
  }

  // Cast to Clerk claims interface
  const clerkClaims = baseClaims as ClerkJWTClaims;

  // Validate authorized parties if present
  if (clerkClaims.azp && options?.authorizedParties) {
    const isAuthorized = options.authorizedParties.includes(clerkClaims.azp);
    if (!isAuthorized) {
      throw new Error(
        `Unauthorized party: ${clerkClaims.azp}. Allowed parties: ${options.authorizedParties.join(', ')}`
      );
    }
  }

  return clerkClaims;
}

/**
 * Checks if a token is a Clerk session token based on its claims.
 * Clerk session tokens typically have specific claim patterns.
 *
 * @param claims - The JWT claims to check
 * @returns True if this appears to be a Clerk session token
 */
export function isClerkSessionToken(claims: ClerkJWTClaims): boolean {
  // Clerk session tokens typically have a session_id
  return Boolean(claims.session_id);
}

/**
 * Extracts authorized parties from a Clerk publishable key.
 * Clerk publishable keys contain encoded configuration including allowed origins.
 *
 * @param publishableKey - The Clerk publishable key (pk_test_... or pk_live_...)
 * @returns Array of authorized party URLs that should be allowed
 */
export function extractAuthorizedPartiesFromPublishableKey(
  publishableKey: string
): string[] {
  if (!publishableKey || !publishableKey.startsWith('pk_')) {
    return [];
  }

  // For now, we'll implement a basic extraction
  // In a full implementation, you'd decode the publishable key to extract origins
  // This is a placeholder that would need to be enhanced based on Clerk's key format
  try {
    // Clerk publishable keys encode configuration, but the format is not public
    // This is where you'd implement the actual decoding logic
    // For now, return empty array and rely on explicit configuration
    return [];
  } catch {
    return [];
  }
}

/**
 * Gets authorized parties from environment configuration.
 * Checks for explicit configuration or attempts to extract from Clerk keys.
 *
 * @returns Array of authorized party URLs from environment
 */
export function getAuthorizedPartiesFromEnv(): string[] {
  // eslint-disable-next-line runtime-safety/no-direct-env-access -- Clerk configuration detection
  const explicitParties = process.env['CLERK_AUTHORIZED_PARTIES'];
  if (explicitParties) {
    return explicitParties
      .split(',')
      .map(party => party.trim())
      .filter(Boolean);
  }

  // Try to extract from publishable key
  // eslint-disable-next-line runtime-safety/no-direct-env-access -- Clerk configuration detection
  const publishableKey = process.env['CLERK_PUBLISHABLE_KEY'];
  if (publishableKey) {
    return extractAuthorizedPartiesFromPublishableKey(publishableKey);
  }

  return [];
}

/**
 * Convenience function to verify a Clerk token with environment-based configuration.
 * Automatically uses authorized parties from environment variables.
 *
 * @param token - The JWT token string to verify
 * @param additionalOptions - Additional verification options
 * @returns Promise resolving to Clerk JWT claims
 */
export async function verifyClerkTokenWithEnvConfig(
  token: string,
  additionalOptions?: Omit<ClerkVerificationOptions, 'authorizedParties'>
): Promise<ClerkJWTClaims> {
  const envAuthorizedParties = getAuthorizedPartiesFromEnv();

  const options: ClerkVerificationOptions = {
    ...additionalOptions,
  };

  // Only set authorizedParties if we have values (exactOptionalPropertyTypes compatibility)
  if (envAuthorizedParties.length > 0) {
    options.authorizedParties = envAuthorizedParties;
  }

  return verifyClerkToken(token, options);
}
