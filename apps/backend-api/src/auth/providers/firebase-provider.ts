import { jwtVerify } from 'jose';
import type {
  VerifyContext,
  FirebaseProviderConfig,
  FirebaseJWTClaims,
  AuthProvider,
} from '../types/provider.js';
import type { JWTClaims } from '../../types/auth.js';
import { ProviderPriority } from '../types/provider.js';
import { createHash } from 'node:crypto';

/**
 * Firebase authentication provider
 * Simple object-based implementation with Google auth integration
 */
const firebaseProvider: AuthProvider = {
  name: 'firebase',
  priority: ProviderPriority.FIREBASE,

  canHandle(issuer: string): boolean {
    if (!issuer || typeof issuer !== 'string') {
      return false;
    }

    // Firebase issuer pattern: https://securetoken.google.com/{project-id}
    const firebasePattern = /^https:\/\/securetoken\.google\.com\/[a-z0-9-]+$/;
    return firebasePattern.test(issuer);
  },

  async verify(token: string, context: VerifyContext): Promise<JWTClaims> {
    const firebaseConfig = context.config.providers.find(
      (p): p is FirebaseProviderConfig => p.provider === 'firebase'
    );

    if (!firebaseConfig) {
      throw new Error('Firebase provider not configured');
    }

    try {
      const issuer = extractIssuer(token);

      if (!this.canHandle(issuer)) {
        throw new Error(`Token issuer ${issuer} is not a Firebase issuer`);
      }

      // Extract project ID from issuer
      const projectId = extractProjectIdFromIssuer(issuer);

      // Use Google's public keys for verification
      const getKey = context.jwksCache.getOrCreate(
        `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
      );

      // Verify JWT
      const { payload } = await jwtVerify(token, getKey, {
        issuer,
        audience: projectId,
        clockTolerance: 5,
      });

      // Convert to claims
      const claims: FirebaseJWTClaims = {
        iss: payload.iss!,
        sub: payload.sub!,
        aud: payload.aud!,
        exp: payload.exp!,
        iat: payload.iat!,
        email: payload['email'] as string,
        uid: (payload['user_id'] as string) || payload.sub!,
      };

      // Add Firebase-specific context if present
      const firebaseContext = payload['firebase'];
      if (firebaseContext && typeof firebaseContext === 'object') {
        const firebase = firebaseContext as Record<string, unknown>;
        claims.firebase = {
          sign_in_provider: firebase['sign_in_provider'] as string,
          identities: firebase['identities'] as Record<string, string[]>,
        };
      }

      // Log success
      context.logger.info(
        {
          provider: 'firebase',
          userId: createHash('sha256')
            .update(claims.sub)
            .digest('hex')
            .substring(0, 16),
          projectId,
        },
        'Firebase token verified successfully'
      );

      return claims;
    } catch (error) {
      context.logger.error(
        {
          provider: 'firebase',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Firebase token verification failed'
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
 * Extract project ID from Firebase issuer URL
 */
function extractProjectIdFromIssuer(issuer: string): string {
  const match = issuer.match(
    /^https:\/\/securetoken\.google\.com\/([a-z0-9-]+)$/
  );
  if (!match || !match[1]) {
    throw new Error(`Invalid Firebase issuer format: ${issuer}`);
  }
  return match[1];
}

/**
 * Factory function to create a Firebase provider instance
 */
export function createFirebaseProvider(): AuthProvider {
  return firebaseProvider;
}

/**
 * Type guard to check if claims are Firebase-specific claims
 */
export function isFirebaseClaims(
  claims: JWTClaims
): claims is FirebaseJWTClaims {
  return (
    'firebase' in claims ||
    'uid' in claims ||
    claims.iss?.startsWith('https://securetoken.google.com/') === true
  );
}

/**
 * Helper to extract Firebase user ID
 */
export function getFirebaseUserId(claims: FirebaseJWTClaims): string {
  return claims.uid || claims.sub;
}

/**
 * Helper to check if user was authenticated via specific provider
 */
export function wasFirebaseAuthenticatedVia(
  claims: FirebaseJWTClaims,
  provider: string
): boolean {
  return claims.firebase?.sign_in_provider === provider;
}

export { firebaseProvider };
export default firebaseProvider;
