import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import type {
  VerifyContext,
  SupabaseProviderConfig,
  SupabaseJWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { JWTClaims } from '../../types/auth.js';
import { ProviderPriority } from '../types/provider.js';
import { createHash } from 'node:crypto';

/**
 * Supabase authentication provider
 * Simple object-based implementation with HMAC-based verification
 */
const supabaseProvider: AuthProvider = {
  name: 'supabase',
  priority: ProviderPriority.SUPABASE,

  canHandle(issuer: string): boolean {
    if (!issuer || typeof issuer !== 'string') {
      return false;
    }

    // Supabase issuer pattern: https://{project-id}.supabase.co/auth/v1
    const supabasePattern = /^https:\/\/[a-z0-9]+\.supabase\.co\/auth\/v1$/;
    return supabasePattern.test(issuer);
  },

  async verify(token: string, context: VerifyContext): Promise<JWTClaims> {
    const supabaseConfig = context.config.providers.find(
      (p): p is SupabaseProviderConfig => p.provider === 'supabase'
    );

    if (!supabaseConfig) {
      throw new Error('Supabase provider not configured');
    }

    try {
      const issuer = extractIssuer(token);

      if (!this.canHandle(issuer)) {
        throw new Error(`Token issuer ${issuer} is not a Supabase issuer`);
      }

      // Prepare HMAC key
      const secret = supabaseConfig.jwtSecret;
      let keyData: Uint8Array;
      try {
        keyData = Buffer.from(secret, 'base64');
        if (Buffer.from(keyData).toString('base64') !== secret) {
          throw new Error('Not base64');
        }
      } catch {
        keyData = new TextEncoder().encode(secret);
      }

      const getKey: JWTVerifyGetKey = () => keyData;

      // Verify JWT
      const { payload } = await jwtVerify(token, getKey, {
        issuer,
        clockTolerance: 5,
      });

      // Convert to claims
      const claims: SupabaseJWTClaims = {
        iss: payload.iss!,
        sub: payload.sub!,
        aud: payload.aud!,
        exp: payload.exp!,
        iat: payload.iat!,
        email: payload['email'] as string,
      };

      // Add Supabase-specific claims
      if (typeof payload['role'] === 'string') {
        claims.role = payload['role'];
      }
      if (
        payload['app_metadata'] &&
        typeof payload['app_metadata'] === 'object'
      ) {
        claims.app_metadata = payload['app_metadata'] as Record<
          string,
          unknown
        >;
      }
      if (
        payload['user_metadata'] &&
        typeof payload['user_metadata'] === 'object'
      ) {
        claims.user_metadata = payload['user_metadata'] as Record<
          string,
          unknown
        >;
      }
      if (Array.isArray(payload['amr'])) {
        claims.amr = payload['amr'] as string[];
      }

      // Log success
      context.logger.info(
        {
          provider: 'supabase',
          userId: createHash('sha256')
            .update(claims.sub)
            .digest('hex')
            .substring(0, 16),
          role: claims.role,
        },
        'Supabase token verified successfully'
      );

      return claims;
    } catch (error) {
      context.logger.error(
        {
          provider: 'supabase',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Supabase token verification failed'
      );
      throw error;
    }
  },
};

/**
 * Extract issuer from JWT token without full verification
 */
function extractIssuer(token: string): string {
  const [, payloadBase64] = token.split('.');
  if (!payloadBase64) {
    throw new Error('Invalid JWT format');
  }

  const payload = JSON.parse(
    Buffer.from(payloadBase64, 'base64url').toString()
  ) as Record<string, unknown>;
  if (!payload['iss'] || typeof payload['iss'] !== 'string') {
    throw new Error('Token missing issuer claim');
  }

  return payload['iss'];
}

export { supabaseProvider };
export default supabaseProvider;

/**
 * Factory function to create a Supabase provider instance
 */
export function createSupabaseProvider(): AuthProvider {
  return supabaseProvider;
}

/**
 * Type guard to check if claims are Supabase-specific claims
 */
export function isSupabaseClaims(
  claims: JWTClaims
): claims is SupabaseJWTClaims {
  return (
    'role' in claims ||
    'app_metadata' in claims ||
    'user_metadata' in claims ||
    'amr' in claims
  );
}

/**
 * Helper to check if Supabase token has specific role
 */
export function hasSupabaseRole(
  claims: SupabaseJWTClaims,
  requiredRole: string
): boolean {
  return claims.role === requiredRole;
}

/**
 * Helper to check if user was authenticated via specific method
 */
export function wasSupabaseAuthenticatedVia(
  claims: SupabaseJWTClaims,
  method: string
): boolean {
  return claims.amr?.includes(method) ?? false;
}
