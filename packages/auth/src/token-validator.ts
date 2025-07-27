import jwt from 'jsonwebtoken';
import type { JWTPayload } from './jwt-validators.js';

interface DecodedToken {
  header: {
    kid?: string;
    [key: string]: any;
  };
  payload: JWTPayload;
  signature: string;
}

export class TokenValidator {
  /**
   * Decodes a JWT without verification
   */
  decode(token: string): DecodedToken {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.payload !== 'object') {
      throw new Error('Invalid JWT format');
    }

    return decoded as DecodedToken;
  }

  /**
   * Verifies a JWT with the provided public key
   */
  async verify(token: string, publicKey: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        publicKey,
        { algorithms: ['RS256', 'RS384', 'RS512', 'HS256'] },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as JWTPayload);
          }
        }
      );
    });
  }

  /**
   * Extracts the kid (key ID) from token header
   */
  extractKid(token: string): string | undefined {
    try {
      const decoded = this.decode(token);
      return decoded.header.kid;
    } catch {
      return undefined;
    }
  }

  /**
   * Extracts user ID from various possible claims
   */
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
    if (Array.isArray(userId)) {
      userId = userId[0];
    }

    // Fall back to email if no valid userId found
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      userId = payload.email;
    }

    // Ensure we have a string
    if (typeof userId !== 'string' || !userId.trim()) {
      return 'anonymous';
    }

    // Return the user ID as-is (provider prefixes can be useful)
    return userId;
  }
}
