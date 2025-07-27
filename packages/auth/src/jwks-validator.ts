import jwt from 'jsonwebtoken';
import type { JWTPayload, JWTValidator } from './jwt-validators.js';

interface JWKS {
  keys: Array<{
    kty: string;
    use?: string;
    kid?: string;
    n?: string;
    e?: string;
    x5c?: string[];
    pem?: string;
    [key: string]: any;
  }>;
}

export class JWKSValidator implements JWTValidator {
  name = 'jwks';
  private jwksCache: JWKS | null = null;
  private cacheExpiry = 0;
  private readonly cacheTTL = 3600000; // 1 hour

  constructor(
    private issuer: string,
    private fallbackKey?: string
  ) {}

  canHandle(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded.payload !== 'object') {
        return false;
      }

      // Check if token issuer matches our configured issuer
      const payload = decoded.payload as JWTPayload;
      const tokenIssuer = payload.iss;

      // Handle various issuer formats
      if (!tokenIssuer) return false;

      // Normalize issuer URLs for comparison
      const normalizedTokenIssuer = tokenIssuer.replace(/\/$/, '');
      const normalizedConfigIssuer = this.issuer.replace(/\/$/, '');

      return (
        normalizedTokenIssuer === normalizedConfigIssuer ||
        normalizedTokenIssuer.startsWith(normalizedConfigIssuer)
      );
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    // Get the key ID from token header
    const decoded = jwt.decode(token, { complete: true });
    const kid =
      decoded && typeof decoded === 'object' && 'header' in decoded
        ? ((decoded.header as unknown as Record<string, unknown>)['kid'] as
            | string
            | undefined)
        : undefined;

    // Get JWKS
    const jwks = await this.getJWKS();

    // Find the right key
    const key = this.findKey(jwks, kid);
    if (!key) {
      throw new Error('No matching key found in JWKS');
    }

    // Get the actual key material
    const publicKey = this.extractPublicKey(key);

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        publicKey,
        { algorithms: ['RS256', 'RS384', 'RS512'] },
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

    // Return the user ID as-is (provider prefixes can be useful)
    return userId;
  }

  private async getJWKS(): Promise<JWKS> {
    // Check cache
    if (this.jwksCache && Date.now() < this.cacheExpiry) {
      return this.jwksCache;
    }

    try {
      // Fetch JWKS directly here to avoid circular dependencies
      const jwksUrl = this.issuer.endsWith('/')
        ? `${this.issuer}.well-known/jwks.json`
        : `${this.issuer}/.well-known/jwks.json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(jwksUrl, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch JWKS: HTTP ${response.status}`);
        }

        const jwks = (await response.json()) as JWKS;

        // Cache the result
        this.jwksCache = jwks;
        this.cacheExpiry = Date.now() + this.cacheTTL;

        return jwks;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // If JWKS fetch fails and we have a fallback key, use it
      if (this.fallbackKey) {
        return {
          keys: [
            {
              kty: 'RSA',
              use: 'sig',
              pem: this.fallbackKey,
            },
          ],
        };
      }
      throw error;
    }
  }

  private findKey(jwks: JWKS, kid?: string): JWKS['keys'][0] | undefined {
    if (!jwks.keys || jwks.keys.length === 0) {
      throw new Error('No keys found in JWKS');
    }

    // If kid is provided, find matching key
    if (kid) {
      const key = jwks.keys.find(k => k.kid === kid);
      if (key) return key;
    }

    // Fall back to first signing key
    const signingKey = jwks.keys.find(k => !k.use || k.use === 'sig');
    if (signingKey) return signingKey;

    // Fall back to first key
    return jwks.keys[0];
  }

  private extractPublicKey(key: JWKS['keys'][0] | undefined): string {
    if (!key) {
      throw new Error('No key provided for public key extraction');
    }
    // If PEM is directly available (from env fallback)
    if (key.pem) {
      return key.pem;
    }

    // If x5c (certificate chain) is available, use it
    if (key.x5c && key.x5c.length > 0) {
      const cert = key.x5c[0];
      return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
    }

    // If we have n and e, we need to construct the public key
    // This would require additional dependencies, so for now we throw
    if (key.n && key.e) {
      throw new Error(
        'RSA key construction from n/e not yet implemented. Please use x5c format or provide PEM key.'
      );
    }

    throw new Error('Unable to extract public key from JWKS entry');
  }
}
