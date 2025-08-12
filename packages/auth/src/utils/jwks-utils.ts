import type { JWKS, JWKSKey } from '../types.js';
import { AuthError } from '../types.js';
// @ts-expect-error - no types available for jwk-to-pem
import jwkToPemModule from 'jwk-to-pem';

// Type for jwkToPem function since it has no types
interface JWKToPemInput {
  kty: string;
  n?: string | undefined;
  e?: string | undefined;
  alg?: string | undefined;
  use?: string | undefined;
}

// Properly typed wrapper for jwk-to-pem
const jwkToPem = jwkToPemModule as (input: JWKToPemInput) => string;

interface CacheEntry {
  jwks: JWKS;
  expiry: number;
}

// Simplified JWKS utilities - focused on core functionality
export class JWKSUtils {
  private static cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL = 3600000; // 1 hour
  private static readonly FETCH_TIMEOUT = 5000; // 5 seconds

  static async fetchJWKS(issuer: string): Promise<JWKS> {
    // Check cache first
    const cached = this.cache.get(issuer);
    if (cached && cached.expiry > Date.now()) {
      return cached.jwks;
    }

    // Construct JWKS URL
    const jwksUrl = issuer.endsWith('/')
      ? `${issuer}.well-known/jwks.json`
      : `${issuer}/.well-known/jwks.json`;

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);

    try {
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
          `Check if ${jwksUrl} is accessible`
        );
      }

      const data = (await response.json()) as JWKS;

      if (!data.keys || !Array.isArray(data.keys)) {
        throw new AuthError(
          'Invalid JWKS format: missing keys array',
          undefined,
          'JWKS endpoint must return a valid keys array',
          'Contact your auth provider support'
        );
      }

      // Cache the result
      this.cache.set(issuer, {
        jwks: data,
        expiry: Date.now() + this.CACHE_TTL,
      });

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : String(error);
      throw new AuthError(
        `Failed to fetch JWKS from ${issuer}: ${message}`,
        undefined,
        'Check network connectivity and issuer URL',
        'Verify issuer URL and JWKS endpoint accessibility'
      );
    }
  }

  static findKey(jwks: JWKS, kid?: string): JWKSKey | null {
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

  static extractPublicKey(key: JWKSKey): string {
    // If we have x5c (certificate chain), use first cert
    if (key.x5c && key.x5c.length > 0) {
      return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
    }

    // For RSA keys with n/e parameters
    if (key.kty === 'RSA' && key.n && key.e) {
      return jwkToPem({
        kty: key.kty,
        n: key.n,
        e: key.e,
        alg: key.alg,
        use: key.use,
      });
    }

    throw new AuthError(
      'Unsupported key format in JWKS',
      undefined,
      'Key must have x5c certificate or RSA n/e parameters',
      'Contact your auth provider about key format'
    );
  }

  static clearCache(): void {
    this.cache.clear();
  }
}
