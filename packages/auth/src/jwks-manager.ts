export interface JWKSKey {
  kty: string;
  use?: string;
  kid?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  pem?: string;
  [key: string]: any;
}

export interface JWKS {
  keys: JWKSKey[];
}

interface CacheEntry {
  jwks: JWKS;
  expiry: number;
}

export class JWKSManager {
  private jwksCache = new Map<string, CacheEntry>();
  private readonly cacheTTL = 3600000; // 1 hour
  private readonly fetchTimeout = 5000; // 5 seconds

  /**
   * Fetches JWKS for an issuer, with caching
   */
  async getJWKS(issuer: string): Promise<JWKS> {
    // Check cache
    const cached = this.jwksCache.get(issuer);
    if (cached && Date.now() < cached.expiry) {
      return cached.jwks;
    }

    // Fetch fresh JWKS
    const jwks = await this.fetchJWKS(issuer);

    // Cache the result
    this.jwksCache.set(issuer, {
      jwks,
      expiry: Date.now() + this.cacheTTL,
    });

    return jwks;
  }

  /**
   * Clears the cache for a specific issuer or all issuers
   */
  clearCache(issuer?: string): void {
    if (issuer) {
      this.jwksCache.delete(issuer);
    } else {
      this.jwksCache.clear();
    }
  }

  /**
   * Finds the appropriate key from JWKS
   */
  findKey(jwks: JWKS, kid?: string): JWKSKey | undefined {
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

  /**
   * Extracts public key from JWKS key entry
   */
  extractPublicKey(key: JWKSKey | undefined): string {
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

  private async fetchJWKS(issuer: string): Promise<JWKS> {
    // Construct JWKS URL
    const jwksUrl = issuer.endsWith('/')
      ? `${issuer}.well-known/jwks.json`
      : `${issuer}/.well-known/jwks.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

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
}
