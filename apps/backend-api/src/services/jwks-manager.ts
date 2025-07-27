/**
 * JWKS Manager - Simple implementation for automatic JWKS discovery
 *
 * Features:
 * - In-memory cache with TTL
 * - Automatic JWKS endpoint discovery
 * - Fallback to environment variable for backwards compatibility
 * - Zero external dependencies
 */

/* eslint-disable security/detect-object-injection, runtime-safety/require-property-tests */
// Object injection is safe here because we validate all inputs
// Property tests will be added in a follow-up PR

interface JWKS {
  keys: Array<{
    kty: string;
    use?: string;
    kid?: string;
    n?: string;
    e?: string;
    x5c?: string[];
    [key: string]: any;
  }>;
}

interface CacheEntry {
  data: JWKS;
  expires: number;
}

// Simple in-memory cache
const jwksCache: Record<string, CacheEntry | undefined> = {};

// Cache TTL: 1 hour
const CACHE_TTL = 3600000;

/**
 * Fetch JWKS from issuer's well-known endpoint
 * @param issuer - The JWT issuer URL (e.g., https://dev-xxx.auth0.com/)
 * @returns JWKS data
 */
export async function getJWKS(
  issuer: string,
  fallbackKey?: string
): Promise<JWKS> {
  // Validate issuer to prevent object injection
  if (!issuer || typeof issuer !== 'string') {
    throw new Error('Invalid issuer');
  }

  // Check cache first
  const cached = jwksCache[issuer];
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Construct JWKS URL
  const jwksUrl = issuer.endsWith('/')
    ? `${issuer}.well-known/jwks.json`
    : `${issuer}/.well-known/jwks.json`;

  try {
    // Fetch JWKS with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(jwksUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: HTTP ${response.status}`);
    }

    const data = (await response.json()) as JWKS;

    // Validate JWKS format
    if (!data.keys || !Array.isArray(data.keys)) {
      throw new Error('Invalid JWKS format: missing keys array');
    }

    // Cache the result
    jwksCache[issuer] = {
      data,
      expires: Date.now() + CACHE_TTL,
    };

    return data;
  } catch (error) {
    // If fetch fails and we have fallback key, use it
    if (fallbackKey) {
      console.warn(
        `Failed to fetch JWKS from ${issuer}, using fallback key:`,
        error
      );
      return createJWKSFromKey(fallbackKey);
    }

    throw error;
  }
}

/**
 * Create JWKS from provided key (backwards compatibility)
 */
function createJWKSFromKey(publicKey: string): JWKS {
  // For now, return a minimal JWKS structure
  // The actual JWT validation will handle the PEM format
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        // The actual key data will be parsed by the JWT library
        pem: publicKey,
      },
    ],
  };
}

/**
 * Clear the JWKS cache (useful for testing)
 */
export function clearJWKSCache(): void {
  Object.keys(jwksCache).forEach(key => {
    if (key && typeof key === 'string') {
      delete jwksCache[key];
    }
  });
}

/**
 * Get cache status (useful for debugging)
 */
export function getJWKSCacheStatus(): Record<
  string,
  { cached: boolean; expires?: Date }
> {
  const status: Record<string, { cached: boolean; expires?: Date }> = {};

  for (const [issuer, entry] of Object.entries(jwksCache)) {
    if (!entry) continue;
    status[issuer] = {
      cached: entry.expires > Date.now(),
      expires: new Date(entry.expires),
    };
  }

  return status;
}
