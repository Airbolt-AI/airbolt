import { z } from 'zod';

/**
 * JWT provider configuration
 */
export interface JWTProvider {
  /** Provider type identifier */
  type: 'clerk' | 'external';
  /** JWT issuer URL */
  issuer: string;
  /** Expected audience for JWT validation */
  audience: string;
  /** JWKS endpoint URL for fetching public keys */
  jwksUrl: string;
}

/**
 * Environment variable schema for JWT configuration
 */
const JWTEnvSchema = z.object({
  /** External JWT issuer URL (optional, for manual OIDC configuration) */
  EXTERNAL_JWT_ISSUER: z.string().url().optional(),
  /** External JWT audience (optional, for manual OIDC configuration) */
  EXTERNAL_JWT_AUDIENCE: z.string().optional(),
  /** External JWKS URL (optional, for manual OIDC configuration) */
  EXTERNAL_JWKS_URL: z.string().url().optional(),
});

/**
 * Clerk issuer pattern for auto-detection
 */
const CLERK_ISSUER_PATTERN = /^https:\/\/.*\.clerk\.accounts\.dev$/;

/**
 * Provider detection error
 */
export class ProviderDetectionError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_PROVIDER' | 'INVALID_CONFIG'
  ) {
    super(message);
    this.name = 'ProviderDetectionError';
  }
}

/**
 * Detects JWT provider from token issuer and environment configuration
 *
 * @param tokenIssuer - The issuer claim from the JWT token
 * @param env - Environment variables (defaults to process.env)
 * @returns Promise resolving to detected provider configuration
 * @throws ProviderDetectionError if no valid provider can be detected
 */
export function detectProvider(
  tokenIssuer: string,
  env: Record<string, string | undefined> = process.env
): JWTProvider {
  // Parse environment variables
  const envConfig = JWTEnvSchema.parse(env);

  // Check if token issuer matches Clerk pattern
  if (CLERK_ISSUER_PATTERN.test(tokenIssuer)) {
    return createClerkProvider(tokenIssuer);
  }

  // Check if manual OIDC configuration is provided and matches
  if (
    envConfig.EXTERNAL_JWT_ISSUER &&
    tokenIssuer === envConfig.EXTERNAL_JWT_ISSUER
  ) {
    return createExternalProvider(envConfig);
  }

  throw new ProviderDetectionError(
    `No JWT provider configuration found for issuer: ${tokenIssuer}. ` +
      'Either use Clerk (*.clerk.accounts.dev) or configure EXTERNAL_JWT_ISSUER.',
    'NO_PROVIDER'
  );
}

/**
 * Creates Clerk provider configuration
 *
 * @param issuer - The Clerk issuer URL
 * @returns Clerk provider configuration
 */
function createClerkProvider(issuer: string): JWTProvider {
  return {
    type: 'clerk',
    issuer,
    audience: issuer, // Clerk uses issuer as audience
    jwksUrl: `${issuer}/.well-known/jwks.json`,
  };
}

/**
 * Creates external OIDC provider configuration
 *
 * @param envConfig - Parsed environment configuration
 * @returns External provider configuration
 * @throws ProviderDetectionError if configuration is incomplete
 */
function createExternalProvider(
  envConfig: z.infer<typeof JWTEnvSchema>
): JWTProvider {
  const { EXTERNAL_JWT_ISSUER, EXTERNAL_JWT_AUDIENCE, EXTERNAL_JWKS_URL } =
    envConfig;

  if (!EXTERNAL_JWT_ISSUER) {
    throw new ProviderDetectionError(
      'EXTERNAL_JWT_ISSUER is required for external OIDC provider',
      'INVALID_CONFIG'
    );
  }

  // Default audience to issuer if not provided
  const audience = EXTERNAL_JWT_AUDIENCE ?? EXTERNAL_JWT_ISSUER;

  // Default JWKS URL to OIDC standard path if not provided
  const jwksUrl =
    EXTERNAL_JWKS_URL ?? `${EXTERNAL_JWT_ISSUER}/.well-known/jwks.json`;

  return {
    type: 'external',
    issuer: EXTERNAL_JWT_ISSUER,
    audience,
    jwksUrl,
  };
}

/**
 * Validates provider configuration
 *
 * @param provider - Provider configuration to validate
 * @returns true if valid
 * @throws ProviderDetectionError if invalid
 */
export function validateProvider(provider: JWTProvider): boolean {
  try {
    // Validate URLs
    new URL(provider.issuer);
    new URL(provider.jwksUrl);

    // Validate required fields
    if (!provider.type || !provider.audience) {
      throw new Error('Missing required provider fields');
    }

    // Type-specific validation
    if (provider.type === 'clerk') {
      if (!CLERK_ISSUER_PATTERN.test(provider.issuer)) {
        throw new Error('Invalid Clerk issuer pattern');
      }
    }

    return true;
  } catch (error) {
    throw new ProviderDetectionError(
      `Invalid provider configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'INVALID_CONFIG'
    );
  }
}

/**
 * Gets all configured providers from environment
 * Useful for debugging and monitoring
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Array of all configured providers
 */
export function getConfiguredProviders(
  env: Record<string, string | undefined> = process.env
): JWTProvider[] {
  const providers: JWTProvider[] = [];
  const envConfig = JWTEnvSchema.parse(env);

  // Add external provider if configured
  if (envConfig.EXTERNAL_JWT_ISSUER) {
    try {
      providers.push(createExternalProvider(envConfig));
    } catch {
      // Ignore invalid external provider configuration
    }
  }

  return providers;
}

/**
 * Extracts issuer from JWT token without full verification
 * This is used for provider detection before verification
 *
 * @param token - JWT token string
 * @returns Issuer claim from token
 * @throws Error if token is malformed or missing issuer
 */
export function extractIssuerFromToken(token: string): string {
  try {
    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: expected 3 parts');
    }

    // Decode payload (second part)
    const payload = parts[1];
    if (!payload) {
      throw new Error('Invalid JWT format: missing payload');
    }
    const decodedPayload: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );

    // Extract issuer with type safety
    if (!decodedPayload || typeof decodedPayload !== 'object') {
      throw new Error('JWT payload is not a valid object');
    }

    const payloadObj = decodedPayload as Record<string, unknown>;

    if (!payloadObj['iss'] || typeof payloadObj['iss'] !== 'string') {
      throw new Error('JWT payload missing or invalid issuer (iss) claim');
    }

    return payloadObj['iss'];
  } catch (error) {
    throw new Error(
      `Failed to extract issuer from JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
