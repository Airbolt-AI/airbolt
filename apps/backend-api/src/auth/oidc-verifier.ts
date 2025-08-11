import {
  jwtVerify,
  importJWK,
  importSPKI,
  createRemoteJWKSet,
  type JWK,
} from 'jose';
import { validateIssuerBeforeNetwork } from './issuer-validator.js';
import {
  type AuthProviderConfig,
  type AuthConfig,
  getProviderByIssuer,
  getJWKSUri,
  usesJWKS,
  getExpectedAlgorithm,
  loadAuthConfig,
} from './auth-config.js';
import { type JWTClaims } from '../types/auth.js';

/**
 * Custom JWKS cache that supports different JWKS endpoints
 * Extends the basic cache to handle provider-specific JWKS URLs
 */
class ProviderJWKSCache {
  private cache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  getOrCreate(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
    if (!this.cache.has(jwksUri)) {
      this.cache.set(
        jwksUri,
        createRemoteJWKSet(new URL(jwksUri), {
          timeoutDuration: 5000, // 5 second timeout for provider JWKS
          cooldownDuration: 600000, // 10 min cooldown on errors
          cacheMaxAge: 86400000, // 24 hour cache
        })
      );
    }
    return this.cache.get(jwksUri)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

const providerJWKSCache = new ProviderJWKSCache();

/**
 * Auth0-specific JWT claims interface
 */
export interface Auth0JWTClaims extends JWTClaims {
  azp?: string; // Authorized party
  scope?: string; // OAuth scopes
  permissions?: string[]; // Auth0 permissions
}

/**
 * Supabase-specific JWT claims interface
 */
export interface SupabaseJWTClaims extends JWTClaims {
  role?: string; // Supabase role (authenticated, anon, etc.)
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

/**
 * Firebase-specific JWT claims interface
 */
export interface FirebaseJWTClaims extends JWTClaims {
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
  auth_time?: number; // Authentication time
}

/**
 * JWT header structure
 */
interface JWTHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

/**
 * JWT payload structure for issuer detection
 */
interface JWTPayload {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decode JWT token without verification to extract header and payload
 * Used for issuer detection and algorithm checking
 *
 * @param token - JWT token string
 * @returns Decoded header and payload
 */
function decodeJWT(token: string): {
  header: JWTHeader;
  payload: JWTPayload;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: token must have 3 parts');
  }

  try {
    const header = JSON.parse(
      Buffer.from(parts[0]!, 'base64url').toString('utf-8')
    ) as JWTHeader;
    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf-8')
    ) as JWTPayload;

    return { header, payload };
  } catch (error) {
    throw new Error('Invalid JWT format: unable to decode token parts');
  }
}

/**
 * Get verification key or secret for a provider configuration
 * Handles JWKS, public keys, and shared secrets
 *
 * @param config - Provider configuration
 * @param token - JWT token (for JWKS key selection)
 * @returns Promise resolving to verification key or secret
 */
async function getVerificationKey(
  config: AuthProviderConfig,
  _token: string
): Promise<any> {
  // Handle providers that use shared secrets (HS256)
  if (config.provider === 'supabase') {
    return new TextEncoder().encode(config.jwtSecret);
  }

  if (config.provider === 'custom' && config.secret) {
    return new TextEncoder().encode(config.secret);
  }

  // Handle providers with explicit public keys
  if (config.provider === 'custom' && config.publicKey) {
    try {
      // Try to import as SPKI (PEM format)
      if (config.publicKey.includes('BEGIN PUBLIC KEY')) {
        return await importSPKI(config.publicKey, 'RS256');
      }

      // Try to import as JWK
      const jwk = JSON.parse(config.publicKey) as JWK;
      return await importJWK(jwk);
    } catch (error) {
      throw new Error(
        `Failed to import public key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Handle JWKS providers
  const jwksUri = getJWKSUri(config);
  if (!jwksUri) {
    throw new Error(`No JWKS URI available for provider: ${config.provider}`);
  }

  // For Firebase, use Google's certificate endpoint (not standard JWKS)
  if (config.provider === 'firebase') {
    // Firebase uses a different endpoint format - just return the JWKS function
    return providerJWKSCache.getOrCreate(jwksUri);
  }

  // For other JWKS providers (Auth0, Clerk, Custom with JWKS)
  return providerJWKSCache.getOrCreate(jwksUri);
}

/**
 * Verify Auth0 JWT token
 *
 * @param token - JWT token string
 * @param config - Auth0 provider configuration
 * @returns Promise resolving to Auth0 JWT claims
 */
async function verifyAuth0Token(
  token: string,
  config: AuthProviderConfig
): Promise<Auth0JWTClaims> {
  const auth0Config = config as Extract<
    AuthProviderConfig,
    { provider: 'auth0' }
  >;
  const { header, payload } = decodeJWT(token);

  // Validate issuer matches configuration
  const expectedIssuer = auth0Config.issuer ?? `https://${auth0Config.domain}/`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(
      `Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`
    );
  }

  // Validate algorithm
  if (header.alg !== 'RS256') {
    throw new Error(`Invalid algorithm: expected RS256, got ${header.alg}`);
  }

  // Get JWKS key
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const getKey = await getVerificationKey(auth0Config, token);

  // Verify token
  const verifyOptions: Parameters<typeof jwtVerify>[2] = {
    issuer: expectedIssuer,
    clockTolerance: 5,
  };

  // Add audience validation if configured
  if (auth0Config.audience) {
    verifyOptions.audience = auth0Config.audience;
  }

  const { payload: verifiedPayload } = await jwtVerify(
    token,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    getKey,
    verifyOptions
  );

  // Convert to Auth0 claims
  const claims: Auth0JWTClaims = {
    sub: verifiedPayload.sub!,
    iss: verifiedPayload.iss!,
    exp: verifiedPayload.exp!,
    iat: verifiedPayload.iat!,
    ...verifiedPayload,
  };

  // Handle optional fields
  if (verifiedPayload.aud !== undefined) {
    claims.aud = verifiedPayload.aud;
  }
  if (typeof verifiedPayload['email'] === 'string') {
    claims.email = verifiedPayload['email'];
  }

  return claims;
}

/**
 * Verify Supabase JWT token
 *
 * @param token - JWT token string
 * @param config - Supabase provider configuration
 * @returns Promise resolving to Supabase JWT claims
 */
async function verifySupabaseToken(
  token: string,
  config: AuthProviderConfig
): Promise<SupabaseJWTClaims> {
  const supabaseConfig = config as Extract<
    AuthProviderConfig,
    { provider: 'supabase' }
  >;
  const { header, payload } = decodeJWT(token);

  // Validate issuer matches Supabase URL
  const expectedIssuer = supabaseConfig.url;
  if (payload.iss !== expectedIssuer) {
    throw new Error(
      `Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`
    );
  }

  // Validate algorithm (Supabase uses HS256)
  if (header.alg !== 'HS256') {
    throw new Error(`Invalid algorithm: expected HS256, got ${header.alg}`);
  }

  // Get shared secret
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const secret = await getVerificationKey(supabaseConfig, token);

  // Verify token
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const { payload: verifiedPayload } = await jwtVerify(token, secret, {
    issuer: expectedIssuer,
    clockTolerance: 5,
  });

  // Convert to Supabase claims
  const claims: SupabaseJWTClaims = {
    sub: verifiedPayload.sub!,
    iss: verifiedPayload.iss!,
    exp: verifiedPayload.exp!,
    iat: verifiedPayload.iat!,
    ...verifiedPayload,
  };

  // Handle optional fields
  if (verifiedPayload.aud !== undefined) {
    claims.aud = verifiedPayload.aud;
  }
  if (typeof verifiedPayload['email'] === 'string') {
    claims.email = verifiedPayload['email'];
  }

  return claims;
}

/**
 * Verify Firebase JWT token
 *
 * @param token - JWT token string
 * @param config - Firebase provider configuration
 * @returns Promise resolving to Firebase JWT claims
 */
async function verifyFirebaseToken(
  token: string,
  config: AuthProviderConfig
): Promise<FirebaseJWTClaims> {
  const firebaseConfig = config as Extract<
    AuthProviderConfig,
    { provider: 'firebase' }
  >;
  const { header, payload } = decodeJWT(token);

  // Validate issuer
  const expectedIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(
      `Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`
    );
  }

  // Validate audience (should be the project ID)
  if (payload.aud !== firebaseConfig.projectId) {
    throw new Error(
      `Invalid audience: expected ${firebaseConfig.projectId}, got ${String(payload.aud)}`
    );
  }

  // Validate algorithm
  if (header.alg !== 'RS256') {
    throw new Error(`Invalid algorithm: expected RS256, got ${header.alg}`);
  }

  // Get Google's public keys
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const getKey = await getVerificationKey(firebaseConfig, token);

  // Verify token
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const { payload: verifiedPayload } = await jwtVerify(token, getKey, {
    issuer: expectedIssuer,
    audience: firebaseConfig.projectId,
    clockTolerance: 5,
  });

  // Convert to Firebase claims
  const claims: FirebaseJWTClaims = {
    sub: verifiedPayload.sub!,
    iss: verifiedPayload.iss!,
    exp: verifiedPayload.exp!,
    iat: verifiedPayload.iat!,
    ...verifiedPayload,
  };

  // Handle optional fields
  if (verifiedPayload.aud !== undefined) {
    claims.aud = verifiedPayload.aud;
  }
  if (typeof verifiedPayload['email'] === 'string') {
    claims.email = verifiedPayload['email'];
  }

  return claims;
}

/**
 * Verify Custom OIDC JWT token
 *
 * @param token - JWT token string
 * @param config - Custom OIDC provider configuration
 * @returns Promise resolving to JWT claims
 */
async function verifyCustomToken(
  token: string,
  config: AuthProviderConfig
): Promise<JWTClaims> {
  const customConfig = config as Extract<
    AuthProviderConfig,
    { provider: 'custom' }
  >;
  const { header, payload } = decodeJWT(token);

  // Validate issuer
  if (payload.iss !== customConfig.issuer) {
    throw new Error(
      `Invalid issuer: expected ${customConfig.issuer}, got ${payload.iss}`
    );
  }

  // Validate algorithm against expected algorithms
  const expectedAlgorithms = getExpectedAlgorithm(customConfig);
  if (!expectedAlgorithms.includes(header.alg || '')) {
    throw new Error(
      `Invalid algorithm: expected one of [${expectedAlgorithms.join(', ')}], got ${header.alg}`
    );
  }

  // Get verification key
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const key = await getVerificationKey(customConfig, token);

  // Prepare verification options
  const verifyOptions: Parameters<typeof jwtVerify>[2] = {
    issuer: customConfig.issuer,
    clockTolerance: 5,
  };

  // Add audience validation if configured
  if (customConfig.audience) {
    verifyOptions.audience = customConfig.audience;
  }

  // Verify token
  const { payload: verifiedPayload } = await jwtVerify(
    token,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    key,
    verifyOptions
  );

  // Convert to standard claims
  const claims: JWTClaims = {
    sub: verifiedPayload.sub!,
    iss: verifiedPayload.iss!,
    exp: verifiedPayload.exp!,
    iat: verifiedPayload.iat!,
    ...verifiedPayload,
  };

  // Handle optional fields
  if (verifiedPayload.aud !== undefined) {
    claims.aud = verifiedPayload.aud;
  }
  if (typeof verifiedPayload['email'] === 'string') {
    claims.email = verifiedPayload['email'];
  }

  return claims;
}

/**
 * Main OIDC token verification function
 * Routes to provider-specific verifiers based on configuration
 *
 * @param token - JWT token string
 * @param config - Provider configuration
 * @returns Promise resolving to provider-specific JWT claims
 */
export async function verifyOIDCToken(
  token: string,
  config: AuthProviderConfig
): Promise<JWTClaims> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Invalid token: must be a non-empty string');
  }

  // Validate issuer before making network calls
  const { payload } = decodeJWT(token);
  if (payload.iss) {
    try {
      await validateIssuerBeforeNetwork(payload.iss);
    } catch (error) {
      // Only validate if we can, don't fail for custom issuers
      if (
        !payload.iss.includes('custom') &&
        !payload.iss.includes('localhost')
      ) {
        throw error;
      }
    }
  }

  // Route to provider-specific verifier
  switch (config.provider) {
    case 'auth0':
      return verifyAuth0Token(token, config);

    case 'supabase':
      return verifySupabaseToken(token, config);

    case 'firebase':
      return verifyFirebaseToken(token, config);

    case 'custom':
      return verifyCustomToken(token, config);

    case 'clerk':
      // Clerk is not handled by this verifier - use clerk-verifier.ts instead
      throw new Error(
        'Clerk tokens should be verified using the Clerk-specific verifier'
      );

    default: {
      const exhaustiveCheck: never = config;
      throw new Error(
        `Unsupported provider: ${(exhaustiveCheck as AuthProviderConfig).provider}`
      );
    }
  }
}

/**
 * Auto-detect provider configuration from token issuer
 * Uses configured auth providers to find a match
 *
 * @param issuer - JWT issuer claim
 * @param authConfig - Optional auth configuration (loads from env if not provided)
 * @returns Matching provider configuration
 */
export function detectProviderFromIssuer(
  issuer: string,
  authConfig?: AuthConfig
): AuthProviderConfig {
  // Load auth config if not provided
  if (!authConfig) {
    authConfig = loadAuthConfig(
      process.env as Record<string, string | undefined>
    );
  }

  // Find matching provider
  const provider = getProviderByIssuer(authConfig, issuer);
  if (!provider) {
    throw new Error(
      `No configured provider found for issuer: ${issuer}. ` +
        `Available providers: ${authConfig.providers.map(p => p.provider).join(', ')}`
    );
  }

  return provider;
}

/**
 * Load provider configuration from environment by provider name
 *
 * @param providerName - Name of the provider to load
 * @returns Provider configuration
 */
export function loadProviderConfig(providerName: string): AuthProviderConfig {
  const authConfig = loadAuthConfig(
    process.env as Record<string, string | undefined>
  );

  const provider = authConfig.providers.find(p => p.provider === providerName);
  if (!provider) {
    throw new Error(
      `Provider '${providerName}' not configured. ` +
        `Available providers: ${authConfig.providers.map(p => p.provider).join(', ')}`
    );
  }

  return provider;
}

/**
 * Unified verification interface with auto-detection support
 * Can auto-detect provider from token or use explicit configuration
 *
 * @param token - JWT token string
 * @param providerOrConfig - Provider name, config object, or undefined for auto-detection
 * @returns Promise resolving to JWT claims
 */
export async function verifyProviderToken(
  token: string,
  providerOrConfig?: AuthProviderConfig | string
): Promise<JWTClaims> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Invalid token: must be a non-empty string');
  }

  let config: AuthProviderConfig;

  if (!providerOrConfig) {
    // Auto-detect from token issuer
    const { payload } = decodeJWT(token);
    if (!payload.iss) {
      throw new Error(
        'Cannot auto-detect provider: token missing issuer claim'
      );
    }
    config = detectProviderFromIssuer(payload.iss);
  } else if (typeof providerOrConfig === 'string') {
    // Load config by provider name
    config = loadProviderConfig(providerOrConfig);
  } else {
    // Use provided config directly
    config = providerOrConfig;
  }

  return verifyOIDCToken(token, config);
}

/**
 * Check if a provider configuration uses JWKS for key management
 * Wrapper around the auth-config utility
 *
 * @param config - Provider configuration
 * @returns True if provider uses JWKS
 */
export function providerUsesJWKS(config: AuthProviderConfig): boolean {
  return usesJWKS(config);
}

/**
 * Get supported provider types
 *
 * @returns Array of supported provider type strings
 */
export function getSupportedProviders(): string[] {
  return ['auth0', 'supabase', 'firebase', 'custom'];
}

/**
 * Validate provider configuration
 * Checks that all required fields are present for the provider type
 *
 * @param config - Provider configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateProviderConfig(config: AuthProviderConfig): void {
  switch (config.provider) {
    case 'auth0': {
      if (!config.domain) {
        throw new Error('Auth0 provider requires domain');
      }
      break;
    }

    case 'supabase': {
      if (!config.url || !config.jwtSecret) {
        throw new Error('Supabase provider requires url and jwtSecret');
      }
      break;
    }

    case 'firebase': {
      if (!config.projectId) {
        throw new Error('Firebase provider requires projectId');
      }
      break;
    }

    case 'custom': {
      if (!config.issuer) {
        throw new Error('Custom provider requires issuer');
      }
      if (!config.jwksUri && !config.publicKey && !config.secret) {
        throw new Error(
          'Custom provider requires jwksUri, publicKey, or secret'
        );
      }
      break;
    }

    case 'clerk':
      // Clerk validation is handled by clerk-verifier.ts
      break;

    default: {
      const exhaustiveCheck: never = config;
      throw new Error(
        `Unknown provider: ${(exhaustiveCheck as AuthProviderConfig).provider}`
      );
    }
  }
}
