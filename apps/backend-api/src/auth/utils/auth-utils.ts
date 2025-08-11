/* eslint-disable runtime-safety/require-property-tests -- Property tests exist in auth-utils.property.test.ts */
import { createHash } from 'node:crypto';
import { jwtVerify, type JWTPayload } from 'jose';
import type { FastifyLoggerInstance } from 'fastify';
import type { JWTClaims } from '../../types/auth.js';
import type { ProviderError, VerifyContext } from '../types/provider.js';
import { AuditEventType } from '../audit-logger.js';

/**
 * Utility functions for auth providers to use instead of base class methods
 */

/**
 * Parses JWT token into header, payload, and signature components
 * Does not perform cryptographic verification
 */
export function parseJWTToken(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: token must have 3 parts');
  }

  try {
    const header = JSON.parse(
      Buffer.from(parts[0]!, 'base64url').toString('utf-8')
    ) as Record<string, unknown>;

    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf-8')
    ) as Record<string, unknown>;

    const signature = parts[2]!;

    return { header, payload, signature };
  } catch (error) {
    throw new Error('Invalid JWT format: unable to decode token parts');
  }
}

/**
 * Extracts issuer from JWT token without full verification
 */
export function extractIssuer(token: string): string {
  const { payload } = parseJWTToken(token);

  if (!payload['iss'] || typeof payload['iss'] !== 'string') {
    throw createProviderError(
      'Invalid token: missing or invalid issuer claim',
      'INVALID_ISSUER'
    );
  }

  return payload['iss'];
}

/**
 * Safely extracts issuer without throwing errors
 */
export function extractIssuerSafely(token: string): string {
  try {
    return extractIssuer(token);
  } catch {
    return 'unknown';
  }
}

/**
 * Validates basic JWT token format without cryptographic verification
 * Returns true if valid, false otherwise (for testing purposes)
 */
export function validateTokenFormat(token: string): boolean {
  try {
    validateTokenFormatStrict(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates basic JWT token format without cryptographic verification (strict version)
 * Throws on invalid format
 */
export function validateTokenFormatStrict(token: string): void {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw createProviderError(
      'Invalid token: must be a non-empty string',
      'INVALID_TOKEN_FORMAT'
    );
  }

  const { payload } = parseJWTToken(token);

  // Validate required claims
  if (!payload['sub']) {
    throw createProviderError(
      'Invalid token: missing subject claim',
      'MISSING_SUBJECT'
    );
  }

  if (!payload['exp'] || typeof payload['exp'] !== 'number') {
    throw createProviderError(
      'Invalid token: missing or invalid expiration claim',
      'MISSING_EXPIRATION'
    );
  }

  if (!payload['iat'] || typeof payload['iat'] !== 'number') {
    throw createProviderError(
      'Invalid token: missing or invalid issued-at claim',
      'MISSING_ISSUED_AT'
    );
  }

  // Check if token is expired (with 5 second tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (payload['exp'] <= now - 5) {
    throw createProviderError('Token has expired', 'TOKEN_EXPIRED');
  }

  // Check if token is issued in the future (with 5 second tolerance)
  if (payload['iat'] > now + 5) {
    throw createProviderError('Token is not yet valid', 'TOKEN_NOT_YET_VALID');
  }
}

/**
 * Creates a standardized ProviderError
 */
export function createProviderError(
  message: string,
  code: string,
  providerName?: string,
  cause?: Error,
  context?: { issuer?: string; tokenHash?: string }
): ProviderError {
  const error = new Error(message) as ProviderError;
  error.provider = providerName || 'unknown';
  error.code = code;
  if (cause !== undefined) {
    error.cause = cause;
  }

  // Add context information for debugging
  if (context) {
    Object.assign(error, context);
  }

  return error;
}

/**
 * Enhanced error handling with provider context
 */
export function handleVerificationError(
  error: unknown,
  providerName: string,
  context?: { issuer?: string; tokenHash?: string }
): ProviderError {
  // Already a provider error - just update provider name
  if (isProviderError(error)) {
    error.provider = providerName;
    return error;
  }

  // Handle jose library errors with specific codes
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('expired')) {
      return createProviderError(
        'Token has expired',
        'TOKEN_EXPIRED',
        providerName,
        error,
        context
      );
    }

    if (message.includes('signature')) {
      return createProviderError(
        'Token signature verification failed',
        'SIGNATURE_INVALID',
        providerName,
        error,
        context
      );
    }

    if (message.includes('audience')) {
      return createProviderError(
        'Token audience validation failed',
        'AUDIENCE_INVALID',
        providerName,
        error,
        context
      );
    }

    if (message.includes('issuer')) {
      return createProviderError(
        'Token issuer validation failed',
        'ISSUER_INVALID',
        providerName,
        error,
        context
      );
    }

    if (message.includes('not yet valid') || message.includes('before')) {
      return createProviderError(
        'Token is not yet valid',
        'TOKEN_NOT_YET_VALID',
        providerName,
        error,
        context
      );
    }

    if (message.includes('key') || message.includes('jwks')) {
      return createProviderError(
        'Key retrieval or validation failed',
        'KEY_RETRIEVAL_FAILED',
        providerName,
        error,
        context
      );
    }

    // Generic error with original message
    return createProviderError(
      `Token verification failed: ${error.message}`,
      'VERIFICATION_FAILED',
      providerName,
      error,
      context
    );
  }

  // Fallback for non-Error objects
  return createProviderError(
    'Token verification failed due to unknown error',
    'UNKNOWN_ERROR',
    providerName,
    undefined,
    context
  );
}

/**
 * Type guard to check if error is a ProviderError
 */
function isProviderError(error: unknown): error is ProviderError {
  return error instanceof Error && 'provider' in error && 'code' in error;
}

/**
 * Helper to get JWKS key retrieval function from cache
 */
export function getJWKS(
  issuer: string,
  context: VerifyContext,
  providerName: string
): ReturnType<VerifyContext['jwksCache']['getOrCreate']> {
  if (!issuer) {
    throw createProviderError(
      'Cannot retrieve JWKS: issuer is required',
      'MISSING_ISSUER',
      providerName
    );
  }

  try {
    return context.jwksCache.getOrCreate(issuer);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw createProviderError(
      `Failed to retrieve JWKS for issuer ${issuer}: ${errorMessage}`,
      'JWKS_RETRIEVAL_FAILED',
      providerName,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Performs JWT verification using jose
 */
export async function performJWTVerification(
  token: string,
  getKey: Parameters<typeof jwtVerify>[1],
  options: Parameters<typeof jwtVerify>[2] = {}
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getKey, {
    clockTolerance: 5, // Default 5 second tolerance
    ...options,
  });

  return payload;
}

/**
 * Converts jose payload to our JWTClaims interface
 */
export function convertToJWTClaims(payload: JWTPayload): JWTClaims {
  const claims: JWTClaims = {
    sub: payload['sub'] as string,
    iss: payload['iss'] as string,
    exp: payload['exp'] as number,
    iat: payload['iat'] as number,
    // Include any additional claims
    ...payload,
  };

  // Handle optional fields separately to satisfy TypeScript's exactOptionalPropertyTypes
  if (payload['aud'] !== undefined) {
    claims.aud = payload['aud'];
  }

  if (typeof payload['email'] === 'string') {
    claims.email = payload['email'];
  }

  return claims;
}

/**
 * Security event logging helper
 */
export function logSecurityEvent(
  event: AuditEventType,
  eventContext: Record<string, unknown>,
  logger: FastifyLoggerInstance,
  providerName: string
): void {
  const logContext = {
    timestamp: new Date().toISOString(),
    event,
    ...eventContext,
    provider: providerName,
  };

  switch (event) {
    case AuditEventType.AUTH_JWT_VERIFICATION_FAILURE:
      logger.error(
        logContext,
        `JWT verification failed for ${providerName} provider`
      );
      break;

    case AuditEventType.AUTH_PROVIDER_MISMATCH:
      logger.warn(
        logContext,
        `Provider mismatch detected for ${providerName} provider`
      );
      break;

    case AuditEventType.AUTH_TOKEN_EXCHANGE_FAILURE:
      logger.warn(
        logContext,
        `Token exchange failed for ${providerName} provider`
      );
      break;

    case AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS:
      logger.info(
        logContext,
        `Token exchange successful for ${providerName} provider`
      );
      break;

    default:
      logger.info(logContext, `Security event for ${providerName} provider`);
      break;
  }
}

/**
 * Creates a hash key for caching or deduplication
 */
export function createHashKey(input: string, prefix?: string): string {
  const data = prefix ? `${prefix}:${input}` : input;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Sanitizes user ID for logging (truncates for privacy)
 * Preserves valid user IDs up to 20 characters
 */
export function sanitizeUserId(userId: string): string {
  // Keep valid user IDs up to 20 chars unchanged
  if (userId.length <= 20 && /^[a-zA-Z0-9._-]+$/.test(userId)) {
    return userId;
  }
  // Truncate long or invalid IDs for privacy
  if (userId.length <= 8) return userId;
  return userId.substring(0, 8) + '...';
}

/**
 * Sanitizes session ID for logging (truncates for privacy)
 */
export function sanitizeSessionId(sessionId: string): string {
  if (sessionId.length <= 12) return sessionId;
  return sessionId.substring(0, 12) + '...';
}
