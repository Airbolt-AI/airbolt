import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types.js';
import { AuthError } from '../types.js';

interface DecodedToken {
  header: { kid?: string; [key: string]: any };
  payload: JWTPayload;
  signature: string;
}

export class TokenValidator {
  decode(token: string): DecodedToken {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.payload !== 'object') {
      throw new AuthError(
        'Invalid JWT format',
        undefined,
        'Token must be a valid JWT with proper structure',
        'Check if token was properly encoded by auth provider'
      );
    }
    return decoded as DecodedToken;
  }

  async verify(token: string, publicKey: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        publicKey,
        { algorithms: ['RS256'] },
        (err, decoded) => {
          if (err) {
            const errorMessage = err.message || 'Token verification failed';
            reject(
              new AuthError(
                `JWT verification failed: ${errorMessage}`,
                undefined,
                'Check token validity and public key configuration',
                'Verify auth provider configuration and token expiry'
              )
            );
          } else {
            resolve(decoded as JWTPayload);
          }
        }
      );
    });
  }

  extractUserId(payload: JWTPayload): string {
    // Try standard claims in order of preference
    const claims = [payload.sub, payload.user_id, payload.userId];

    // Find first valid claim
    let userId: unknown = claims.find(claim => {
      if (Array.isArray(claim) && claim.length > 0) {
        return typeof claim[0] === 'string' && claim[0].trim();
      }
      return typeof claim === 'string' && claim.trim();
    });

    // Extract from array if needed
    if (Array.isArray(userId)) userId = userId[0];

    // Fall back to email if no valid userId found
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      userId = payload.email;
    }

    // Ensure we have a string
    if (typeof userId !== 'string' || !userId.trim()) {
      return 'anonymous';
    }

    // Clean provider prefixes (Auth0, Google, Facebook)
    return userId.replace(/^(auth0\||google-oauth2\||facebook\|)/, '');
  }
}
