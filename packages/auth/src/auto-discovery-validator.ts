import jwt from 'jsonwebtoken';
import type { JWTPayload, JWTValidator } from './jwt-validators.js';
import { ProviderDetector } from './provider-detector.js';

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

interface CacheEntry {
  jwks: JWKS;
  expiry: number;
}

export class AutoDiscoveryValidator implements JWTValidator {
  name = 'auto-discovery';
  private jwksCache = new Map<string, CacheEntry>();
  private readonly cacheTTL = 3600000; // 1 hour
  private readonly config: {
    issuer?: string | undefined;
    audience?: string | undefined;
    isProduction: boolean;
  };
  private hasLoggedWarning = false;

  constructor(config?: {
    issuer?: string | undefined;
    audience?: string | undefined;
    isProduction?: boolean | undefined;
  }) {
    this.config = {
      issuer: config?.issuer ?? undefined,
      audience: config?.audience ?? undefined,
      isProduction: config?.isProduction ?? false,
    };
  }

  canHandle(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded.payload !== 'object') {
        return false;
      }

      const payload = decoded.payload as JWTPayload;
      const issuer = payload.iss;

      // In production with configured issuer, only handle matching tokens
      if (this.config.isProduction && this.config.issuer) {
        return issuer === this.config.issuer;
      }

      // In production without configured issuer, don't handle any tokens
      if (this.config.isProduction && !this.config.issuer) {
        return false;
      }

      // In development, accept any token with an HTTPS issuer
      return !!issuer && issuer.startsWith('https://');
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.payload !== 'object') {
      throw new Error('Invalid JWT format');
    }

    const payload = decoded.payload as JWTPayload;
    const issuer = payload.iss;

    if (!issuer || !issuer.startsWith('https://')) {
      throw new Error('JWT must have an HTTPS issuer for auto-discovery');
    }

    // If an issuer is configured, validate strictly (in any environment)
    if (this.config.issuer) {
      if (issuer !== this.config.issuer) {
        throw new Error(
          `Token issuer mismatch. Expected: ${this.config.issuer}, Got: ${issuer}`
        );
      }
    } else if (this.config.isProduction) {
      // In production without explicit issuer config, log warning but allow
      if (!this.hasLoggedWarning) {
        console.warn(
          `⚠️  Production auto-discovery: Accepting JWT from ${issuer}.\n` +
            `    For enhanced security, configure EXTERNAL_JWT_ISSUER to restrict accepted issuers.`
        );
        this.hasLoggedWarning = true;
      }
    } else {
      // Development mode warnings
      if (!this.hasLoggedWarning) {
        const isTrusted = ProviderDetector.isTrustedProvider(issuer);
        console.warn(
          `⚠️  Auto-discovery mode: Accepting JWT from ${issuer}${isTrusted ? ' (trusted provider)' : ''}.\n` +
            `    For production, set NODE_ENV=production and configure EXTERNAL_JWT_ISSUER.`
        );
        this.hasLoggedWarning = true;
      }
    }

    // Validate audience if configured
    if (this.config.audience) {
      const aud = payload['aud'];
      if (!aud || (typeof aud === 'string' && aud !== this.config.audience)) {
        throw new Error(
          `Token audience mismatch. Expected: ${this.config.audience}`
        );
      }
      if (Array.isArray(aud) && !aud.includes(this.config.audience)) {
        throw new Error(
          `Token audience mismatch. Expected: ${this.config.audience}`
        );
      }
    }

    // Check if this is an opaque token (Auth0 without audience)
    if (this.isOpaqueToken(payload)) {
      const errorMessage = ProviderDetector.getErrorMessage(
        'opaque',
        issuer,
        token
      );
      throw new Error(errorMessage);
    }

    // Get the key ID from token header
    const kid =
      decoded && typeof decoded === 'object' && 'header' in decoded
        ? ((decoded.header as unknown as Record<string, unknown>)['kid'] as
            | string
            | undefined)
        : undefined;

    // Get JWKS for this issuer
    const jwks = await this.getJWKS(issuer);

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
        { algorithms: ['RS256', 'RS384', 'RS512', 'HS256'] },
        (err, decoded) => {
          if (err) {
            // Enhance error messages
            const enhancedError = new Error(
              ProviderDetector.getErrorMessage(err.message, issuer)
            );
            reject(enhancedError);
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

  private isOpaqueToken(payload: JWTPayload): boolean {
    // Auth0 opaque tokens have no audience or audience equals azp (client ID)
    const aud = payload['aud'];
    const azp = payload['azp'];

    // Check if issuer is Auth0
    const issuer = payload.iss || '';
    if (!issuer.includes('.auth0.com')) {
      return false;
    }

    // If no audience or audience equals client ID, it's opaque
    return !aud || (typeof aud === 'string' && aud === azp);
  }

  private async getJWKS(issuer: string): Promise<JWKS> {
    // Check cache
    const cached = this.jwksCache.get(issuer);
    if (cached && Date.now() < cached.expiry) {
      return cached.jwks;
    }

    // Construct JWKS URL
    const jwksUrl = issuer.endsWith('/')
      ? `${issuer}.well-known/jwks.json`
      : `${issuer}/.well-known/jwks.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(jwksUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch JWKS from ${issuer}: HTTP ${response.status}`
        );
      }

      const jwks = (await response.json()) as JWKS;

      // Validate JWKS format
      if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new Error('Invalid JWKS format: missing keys array');
      }

      // Cache the result
      this.jwksCache.set(issuer, {
        jwks,
        expiry: Date.now() + this.cacheTTL,
      });

      return jwks;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout fetching JWKS from ${issuer}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
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

    // If PEM is directly available
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
        'RSA key construction from n/e not yet implemented. Please use x5c format.'
      );
    }

    throw new Error('Unable to extract public key from JWKS entry');
  }
}
