import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import '@fastify/jwt';

export interface JWTPayload {
  userId?: string;
  sub?: string;
  user_id?: string;
  email?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface JWTValidator {
  name: string;
  canHandle(token: string): boolean;
  verify(token: string): Promise<JWTPayload>;
  extractUserId(payload: JWTPayload): string;
}

export class InternalJWTValidator implements JWTValidator {
  name = 'internal';

  constructor(private fastify: FastifyInstance) {}

  canHandle(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      return (
        decoded !== null &&
        typeof decoded.payload === 'object' &&
        decoded.payload.iss === 'airbolt-api'
      );
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    return this.fastify.jwt.verify(token);
  }

  extractUserId(payload: JWTPayload): string {
    return payload.userId || 'anonymous';
  }
}

export class ExternalJWTValidator implements JWTValidator {
  name = 'external';

  constructor(
    private secret: string | Buffer,
    private algorithms: jwt.Algorithm[] = ['RS256']
  ) {}

  canHandle(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      return (
        decoded !== null &&
        typeof decoded.payload === 'object' &&
        decoded.payload.iss !== 'airbolt-api'
      );
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.secret,
        { algorithms: this.algorithms },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            const payload = decoded as JWTPayload;

            // Validate essential claims exist
            if (
              !payload.sub &&
              !payload.user_id &&
              !payload.userId &&
              !payload.email
            ) {
              reject(new Error('JWT missing user identification claims'));
              return;
            }

            // Validate token is not expired (additional safety check)
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
              reject(new Error('JWT expired'));
              return;
            }

            resolve(payload);
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

    // Clean provider prefixes (Auth0, Google, Facebook)
    // This ensures consistent user IDs across providers
    return userId.replace(/^(auth0\||google-oauth2\||facebook\|)/, '');
  }
}
