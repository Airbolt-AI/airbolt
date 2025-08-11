import { jwtVerify, importSPKI } from 'jose';
import type {
  VerifyContext,
  CustomOIDCProviderConfig,
  CustomOIDCJWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { JWTClaims } from '../../types/auth.js';
import { ProviderPriority } from '../types/provider.js';
import { createHash } from 'node:crypto';

/**
 * Custom OIDC authentication provider
 * Simple object-based implementation with environment-based fallback
 */
const customOIDCProvider: AuthProvider = {
  name: 'custom-oidc',
  priority: ProviderPriority.CUSTOM_OIDC,

  canHandle(issuer: string): boolean {
    if (!issuer || typeof issuer !== 'string') {
      return false;
    }

    // Always return false for now - configuration handled through auth-config.ts
    return false;
  },

  async verify(token: string, context: VerifyContext): Promise<JWTClaims> {
    const customConfig = context.config.providers.find(
      (p): p is CustomOIDCProviderConfig => p.provider === 'custom'
    );

    try {
      const issuer = extractIssuer(token);

      if (!this.canHandle(issuer)) {
        throw new Error(
          `Token issuer ${issuer} is not configured for custom OIDC verification`
        );
      }

      // Get verification key
      let getKey;
      if (customConfig?.publicKey) {
        const publicKey = await importSPKI(customConfig.publicKey, 'RS256');
        getKey = () => publicKey;
      } else if (customConfig?.secret) {
        const secret = new TextEncoder().encode(customConfig.secret);
        getKey = () => secret;
      } else {
        // Use JWKS from issuer or custom URI
        const jwksUri =
          customConfig?.jwksUri || `${issuer}/.well-known/jwks.json`;
        getKey = context.jwksCache.getOrCreate(jwksUri);
      }

      // Build verification options
      const verificationOptions: Parameters<typeof jwtVerify>[2] = {
        issuer,
        clockTolerance: 5,
      };

      if (customConfig?.audience) {
        verificationOptions.audience = customConfig.audience;
      }

      // Verify JWT
      const { payload } = await jwtVerify(token, getKey, verificationOptions);

      // Convert to claims with OIDC profile fields
      const claims: CustomOIDCJWTClaims = {
        iss: payload.iss!,
        sub: payload.sub!,
        aud: payload.aud!,
        exp: payload.exp!,
        iat: payload.iat!,
        email: payload['email'] as string,
      };

      // Add OIDC profile claims if present
      if (typeof payload['name'] === 'string') claims.name = payload['name'];
      if (typeof payload['preferred_username'] === 'string')
        claims.preferred_username = payload['preferred_username'];
      if (typeof payload['picture'] === 'string')
        claims.picture = payload['picture'];
      if (typeof payload['given_name'] === 'string')
        claims.given_name = payload['given_name'];
      if (typeof payload['family_name'] === 'string')
        claims.family_name = payload['family_name'];

      // Log success
      context.logger.info(
        {
          provider: 'custom-oidc',
          userId: createHash('sha256')
            .update(claims.sub)
            .digest('hex')
            .substring(0, 16),
          issuer,
        },
        'Custom OIDC token verified successfully'
      );

      return claims;
    } catch (error) {
      context.logger.error(
        {
          provider: 'custom-oidc',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Custom OIDC token verification failed'
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

/**
 * Factory function to create a Custom OIDC provider instance
 */
export function createCustomOIDCProvider(): AuthProvider {
  return customOIDCProvider;
}

/**
 * Type guard to check if claims are Custom OIDC-specific claims
 */
export function isCustomOIDCClaims(
  claims: JWTClaims
): claims is CustomOIDCJWTClaims {
  const oidcFields = [
    'name',
    'given_name',
    'family_name',
    'preferred_username',
    'profile',
    'picture',
  ];
  return oidcFields.some(field => field in claims);
}

/**
 * Helper to extract preferred identifier from OIDC claims
 */
export function getOIDCPreferredIdentifier(
  claims: CustomOIDCJWTClaims
): string {
  return claims.preferred_username || claims.email || claims.name || claims.sub;
}

/**
 * Helper to check if OIDC token has profile information
 */
export function hasOIDCProfile(claims: CustomOIDCJWTClaims): boolean {
  return Boolean(
    claims.name ||
      claims.given_name ||
      claims.family_name ||
      claims.preferred_username ||
      claims.picture ||
      claims.profile
  );
}

export { customOIDCProvider };
export default customOIDCProvider;
