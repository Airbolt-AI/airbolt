import type { FastifyLoggerInstance } from 'fastify';
import type { JWTVerifyGetKey } from 'jose';
import type { JWTClaims } from '../../types/auth.js';
import type { AuthConfig, AuthProviderConfig } from '../auth-config.js';

/**
 * Priority levels for auth providers
 * Lower numbers = higher priority
 */
export enum ProviderPriority {
  CLERK = 100,
  AUTH0 = 200,
  SUPABASE = 300,
  FIREBASE = 400,
  CUSTOM_OIDC = 500,
}

/**
 * Context provided to auth providers during token verification
 */
export interface VerifyContext {
  /** JWKS cache instance for JWT key retrieval */
  jwksCache: {
    getOrCreate(issuer: string): JWTVerifyGetKey;
    clear(): void;
    size(): number;
    has(issuer: string): boolean;
  };
  /** Fastify logger instance for audit and debugging */
  logger: FastifyLoggerInstance;
  /** Complete auth configuration */
  config: AuthConfig;
}

/**
 * Simplified interface for authentication providers
 * Each provider implements this interface to handle JWT verification
 */
export interface AuthProvider {
  /** Human-readable name for the provider */
  readonly name: string;

  /** Priority level - lower numbers have higher priority */
  readonly priority: number;

  /**
   * Determines if this provider can handle tokens from the given issuer
   * @param issuer - JWT issuer claim
   * @returns true if this provider can handle the token
   */
  canHandle(issuer: string): boolean;

  /**
   * Verifies a JWT token and returns claims
   * @param token - JWT token string
   * @param context - Verification context with cache, logger, and config
   * @returns Promise resolving to JWT claims
   * @throws Error for invalid tokens
   */
  verify(token: string, context: VerifyContext): Promise<JWTClaims>;
}

/**
 * Simplified provider registry interface for managing multiple auth providers
 */
export interface ProviderRegistry {
  /** Register a new auth provider */
  register(provider: AuthProvider): void;

  /** Find the best provider for a given issuer */
  findProvider(issuer: string): AuthProvider | undefined;

  /** Verify a token using the appropriate provider */
  verifyToken(token: string): Promise<VerificationResult>;
}

/**
 * Verification result interface
 */
export interface VerificationResult {
  /** Successfully verified claims */
  claims: JWTClaims;
  /** Provider that performed the verification */
  provider: string;
  /** Issuer from the token */
  issuer: string;
  /** Verification timestamp */
  verifiedAt: Date;
}

/**
 * Provider verification error details
 */
export interface ProviderError extends Error {
  /** Provider that generated the error */
  provider: string;
  /** Error code for categorization */
  code: string;
  /** Original error if wrapped */
  cause?: Error;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: AuthProviderConfig) => AuthProvider;

/**
 * Provider metadata interface
 */
export interface ProviderMetadata {
  /** Provider type identifier */
  type: string;
  /** Factory function to create provider instances */
  factory: ProviderFactory;
  /** Default priority for this provider type */
  defaultPriority: number;
}

/**
 * Provider-specific configuration types
 */

/** Clerk provider configuration */
export interface ClerkProviderConfig {
  provider: 'clerk';
  issuer?: string;
  authorizedParties?: string[];
  publishableKey?: string;
  secretKey?: string;
}

/** Auth0 provider configuration */
export interface Auth0ProviderConfig {
  provider: 'auth0';
  domain: string;
  audience?: string;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
}

/** Supabase provider configuration */
export interface SupabaseProviderConfig {
  provider: 'supabase';
  url: string;
  jwtSecret: string;
}

/** Firebase provider configuration */
export interface FirebaseProviderConfig {
  provider: 'firebase';
  projectId: string;
}

/** Custom OIDC provider configuration */
export interface CustomOIDCProviderConfig {
  provider: 'custom';
  issuer: string;
  jwksUri?: string;
  audience?: string;
  publicKey?: string;
  secret?: string;
}

/**
 * Extended JWT claims types for provider-specific data
 */

/** Clerk-specific JWT claims */
export interface ClerkJWTClaims extends JWTClaims {
  session_id?: string;
  org_id?: string;
  org_slug?: string;
  azp?: string;
}

/** Auth0-specific JWT claims */
export interface Auth0JWTClaims extends JWTClaims {
  scope?: string;
  permissions?: string[];
  roles?: string[];
  'https://auth0.com/metadata'?: Record<string, unknown>;
  gty?: string;
}

/** Supabase-specific JWT claims */
export interface SupabaseJWTClaims extends JWTClaims {
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  amr?: string[];
}

/** Firebase-specific JWT claims */
export interface FirebaseJWTClaims extends JWTClaims {
  uid: string;
  firebase?: {
    identities?: Record<string, string[]>;
    sign_in_provider?: string;
    tenant?: string;
  };
}

/** Custom OIDC-specific JWT claims */
export interface CustomOIDCJWTClaims extends JWTClaims {
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  updated_at?: number;
}
