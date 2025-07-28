import type { JWKS, JWKSKey } from '../types.js';
import { AuthError } from '../types.js';

interface CacheEntry {
  jwks: JWKS;
  expiry: number;
}

export class JWKSManager {
  private jwksCache = new Map<string, CacheEntry>();
  private readonly cacheTTL = 3600000; // 1 hour
  private readonly fetchTimeout = 5000; // 5 seconds

  async getJWKS(issuer: string, fallbackKey?: string): Promise<JWKS> {
    // Enhanced validation with actionable error
    if (!issuer || typeof issuer !== 'string') {
      throw new AuthError(
        'JWKS issuer must be a valid string',
        undefined,
        'Provide a valid HTTPS issuer URL',
        'Example: https://your-tenant.auth0.com/'
      );
    }

    // Check cache first
    const cached = this.jwksCache.get(issuer);
    if (cached && cached.expiry > Date.now()) {
      return cached.jwks;
    }

    // Construct JWKS URL
    const jwksUrl = issuer.endsWith('/')
      ? `${issuer}.well-known/jwks.json`
      : `${issuer}/.well-known/jwks.json`;

    try {
      // Fetch JWKS with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

      const response = await fetch(jwksUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AuthError(
          `JWKS endpoint returned HTTP ${response.status}`,
          undefined,
          'Verify the issuer URL is correct and accessible',
          `Check if ${jwksUrl} is accessible in your browser`
        );
      }

      const data = (await response.json()) as JWKS;

      // Validate JWKS format
      if (!data.keys || !Array.isArray(data.keys)) {
        throw new AuthError(
          'Invalid JWKS format: missing keys array',
          undefined,
          'JWKS endpoint must return a valid keys array',
          'Contact your auth provider support'
        );
      }

      // Cache the result
      this.jwksCache.set(issuer, {
        jwks: data,
        expiry: Date.now() + this.cacheTTL,
      });

      return data;
    } catch (error) {
      // If fetch fails and we have fallback key, use it
      if (fallbackKey) {
        return this.createJWKSFromKey(fallbackKey);
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new AuthError(
        `Failed to fetch JWKS from ${issuer}`,
        undefined,
        'Check network connectivity and issuer URL',
        `Verify ${jwksUrl} is accessible: ${message}`
      );
    }
  }

  findKey(jwks: JWKS, kid?: string): JWKSKey | null {
    if (!jwks.keys || !Array.isArray(jwks.keys)) {
      return null;
    }

    // If kid is provided, try to find exact match first
    if (kid) {
      const exactMatch = jwks.keys.find(key => key.kid === kid);
      if (exactMatch) return exactMatch;
    }

    // Fall back to first signing key
    return (
      jwks.keys.find(
        key => key.kty === 'RSA' && (!key.use || key.use === 'sig')
      ) ||
      jwks.keys[0] ||
      null
    );
  }

  extractPublicKey(key: JWKSKey): string {
    // If we have a PEM key directly (from fallback), use it
    if (key.pem) {
      return key.pem;
    }

    // If we have x5c (certificate chain), use first cert
    if (key.x5c && key.x5c.length > 0) {
      return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
    }

    // For RSA keys, construction from n/e requires additional library
    if (key.kty === 'RSA' && key.n && key.e) {
      throw new AuthError(
        'RSA key construction from n/e not implemented',
        undefined,
        'Use x5c certificate or provide PEM fallback key',
        'Most providers support x5c format in JWKS'
      );
    }

    throw new AuthError(
      'Unsupported key format in JWKS',
      undefined,
      'Key must have x5c certificate or pem field',
      'Contact your auth provider about key format'
    );
  }

  private createJWKSFromKey(publicKey: string): JWKS {
    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          pem: publicKey,
        },
      ],
    };
  }

  clearCache(): void {
    this.jwksCache.clear();
  }
}
