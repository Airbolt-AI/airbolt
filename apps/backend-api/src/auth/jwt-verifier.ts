import { jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';

/**
 * JWT verification options
 */
export interface JWTVerificationOptions {
  /** The JWT token to verify */
  token: string;
  /** The JWKS URL to fetch public keys from */
  jwksUrl: string;
  /** Expected issuer */
  issuer: string;
  /** Expected audience */
  audience: string;
  /** Clock skew tolerance in seconds (default: 60) */
  clockSkew?: number;
}

/**
 * JWT verification result with typed payload
 */
export interface JWTVerificationResult {
  /** The verified JWT payload */
  payload: JWTPayload;
  /** The JWT header */
  header: Record<string, unknown>;
  /** Subject from the token */
  sub?: string | undefined;
  /** Token expiration timestamp */
  exp?: number | undefined;
  /** Token issued at timestamp */
  iat?: number | undefined;
}

/**
 * JWT verification error types
 */
export class JWTVerificationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EXPIRED'
      | 'INVALID_SIGNATURE'
      | 'INVALID_FORMAT'
      | 'FETCH_ERROR'
      | 'UNKNOWN',
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'JWTVerificationError';
  }
}

/**
 * JWKS fetch function type
 */
export type JWKSFetcher = (url: string) => Promise<{ keys: unknown[] }>;

/**
 * Default JWKS fetcher implementation
 */
const defaultJWKSFetcher: JWKSFetcher = async (url: string) => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Airbolt/1.0 JWT-Verifier',
        Accept: 'application/json',
      },
      // 10 second timeout for JWKS fetch
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(
        `JWKS fetch failed: ${response.status} ${response.statusText}`
      );
    }

    const jwks = await response.json();

    // Basic JWKS validation
    const JWKSSchema = z.object({
      keys: z.array(z.unknown()),
    });

    return JWKSSchema.parse(jwks);
  } catch (error) {
    throw new JWTVerificationError(
      `Failed to fetch JWKS from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'FETCH_ERROR',
      error
    );
  }
};

/**
 * Verifies a JWT token using JWKS endpoint
 *
 * @param options - JWT verification options
 * @param jwksFetcher - Optional custom JWKS fetcher (mainly for testing)
 * @returns Promise resolving to verification result
 * @throws JWTVerificationError for any verification failures
 */
export async function verifyToken(
  options: JWTVerificationOptions,
  jwksFetcher: JWKSFetcher = defaultJWKSFetcher
): Promise<JWTVerificationResult> {
  const { token, jwksUrl, issuer, audience, clockSkew = 60 } = options;

  try {
    // Fetch JWKS
    const jwks = await jwksFetcher(jwksUrl);

    // jose will use the JWKS directly in the callback

    // Verify the JWT
    const result = await jwtVerify(
      token,
      protectedHeader => {
        // Extract the key ID from the JWT header
        const { kid } = protectedHeader;

        if (!kid) {
          throw new Error('JWT header missing kid (key ID)');
        }

        // Find the matching key in the JWKS
        const key = jwks.keys.find((k: unknown) => {
          return (
            typeof k === 'object' &&
            k !== null &&
            'kid' in k &&
            (k as { kid: unknown }).kid === kid
          );
        });

        if (!key) {
          throw new Error(`No key found for kid: ${kid}`);
        }

        return key;
      },
      {
        issuer,
        audience,
        clockTolerance: clockSkew,
      }
    );

    return {
      payload: result.payload,
      header: result.protectedHeader,
      sub: result.payload.sub,
      exp: result.payload.exp,
      iat: result.payload.iat,
    };
  } catch (error) {
    // Map jose errors to our error types
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('expired') || message.includes('exp')) {
        throw new JWTVerificationError(
          'JWT token has expired',
          'EXPIRED',
          error
        );
      }

      if (message.includes('signature') || message.includes('invalid')) {
        throw new JWTVerificationError(
          'JWT signature verification failed',
          'INVALID_SIGNATURE',
          error
        );
      }

      if (message.includes('malformed') || message.includes('format')) {
        throw new JWTVerificationError(
          'JWT token has invalid format',
          'INVALID_FORMAT',
          error
        );
      }

      // Re-throw fetch errors as-is
      if (error instanceof JWTVerificationError) {
        throw error;
      }
    }

    // Unknown error
    throw new JWTVerificationError(
      `JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN',
      error
    );
  }
}
