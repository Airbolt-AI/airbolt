/**
 * Authentication Providers Module
 *
 * This module exports all authentication provider implementations and related utilities.
 * It provides a centralized access point for all provider functionality including:
 * - Individual provider classes and their factory functions
 * - Provider type guards and utility functions
 * - Provider factory system for dynamic provider creation
 * - Configuration validation and management utilities
 */

// Base provider infrastructure
// Base provider removed - providers now use simple objects

// Individual provider implementations
export { clerkProvider, createClerkProvider } from './clerk-provider.js';
export {
  isClerkClaims,
  isClerkUserSession,
  hasClerkOrganizationContext,
} from './clerk-provider.js';

export { auth0Provider, createAuth0Provider } from './auth0-provider.js';
export {
  isAuth0Claims,
  extractAuth0Scopes,
  hasAuth0Scope,
  hasAnyAuth0Scope,
} from './auth0-provider.js';

export {
  supabaseProvider,
  createSupabaseProvider,
} from './supabase-provider.js';
export {
  isSupabaseClaims,
  hasSupabaseRole,
  wasSupabaseAuthenticatedVia,
} from './supabase-provider.js';

export {
  firebaseProvider,
  createFirebaseProvider,
} from './firebase-provider.js';
export {
  isFirebaseClaims,
  getFirebaseUserId,
  wasFirebaseAuthenticatedVia,
} from './firebase-provider.js';

export {
  customOIDCProvider,
  createCustomOIDCProvider,
} from './custom-oidc-provider.js';
export {
  isCustomOIDCClaims,
  getOIDCPreferredIdentifier,
  hasOIDCProfile,
} from './custom-oidc-provider.js';

// Provider factory system
export {
  createProvider,
  createProviders,
  getProviderMetadata,
  getAllProviderMetadata,
  isProviderTypeSupported,
  getSupportedProviderTypes,
  validateProviderConfig,
  registerProviderFactory,
  unregisterProviderFactory,
  getDefaultPriority,
  sortProviderConfigsByPriority,
  createProviderSummary,
} from './provider-factory.js';

// Re-export provider types for convenience
export type {
  AuthProvider,
  VerifyContext,
  ProviderRegistry,
  VerificationResult,
  ProviderError,
  ProviderFactory,
  ProviderMetadata,
  ClerkProviderConfig,
  Auth0ProviderConfig,
  SupabaseProviderConfig,
  FirebaseProviderConfig,
  CustomOIDCProviderConfig,
  ClerkJWTClaims,
  Auth0JWTClaims,
  SupabaseJWTClaims,
  FirebaseJWTClaims,
  CustomOIDCJWTClaims,
} from '../types/provider.js';

// Re-export auth config types
export type { AuthProviderConfig } from '../auth-config.js';

export { ProviderPriority } from '../types/provider.js';

/**
 * Provider type constants for easy reference
 */
export const PROVIDER_TYPES = {
  CLERK: 'clerk',
  AUTH0: 'auth0',
  SUPABASE: 'supabase',
  FIREBASE: 'firebase',
  CUSTOM_OIDC: 'custom',
} as const;

/**
 * Provider priority constants for easy reference
 */
export const PROVIDER_PRIORITIES = {
  CLERK: 10,
  AUTH0: 20,
  SUPABASE: 30,
  FIREBASE: 40,
  CUSTOM_OIDC: 100,
} as const;

/**
 * Utility function to get provider class by name
 * Useful for dynamic provider instantiation
 *
 * @param providerName - Name of the provider
 * @returns Provider class constructor or undefined if not found
 */
export function getProviderClass(
  _providerName: string
): (new (...args: any[]) => any) | undefined {
  // TODO: Fix import issues and re-enable
  // switch (providerName.toLowerCase()) {
  //   case 'firebase':
  //     return FirebaseProvider;
  //   default:
  //     return undefined;
  // }
  return undefined;
}

/**
 * Utility function to check if claims belong to specific provider type
 * Useful for runtime type checking and provider-specific logic
 *
 * @param claims - JWT claims to check
 * @param providerType - Provider type to check against
 * @returns True if claims match the provider type
 */
export function isProviderClaims(
  claims: unknown,
  _providerType: string
): boolean {
  if (!claims || typeof claims !== 'object') {
    return false;
  }

  // TODO: Fix import issues and re-enable provider checks
  // const claimsObj = claims as Record<string, unknown>;
  // switch (providerType.toLowerCase()) {
  //   case 'firebase':
  //     return isFirebaseClaims(claimsObj);
  //   default:
  //     return false;
  // }
  return false;
}

/**
 * Utility function to get provider-specific information
 * Returns metadata about the provider implementation
 *
 * @param providerType - Provider type
 * @returns Provider information object
 */
export function getProviderInfo(_providerType: string):
  | {
      name: string;
      priority: number;
      description: string;
      issuerPatterns: string[];
      supportedAlgorithms: string[];
      requiresConfiguration: boolean;
    }
  | undefined {
  // TODO: Fix import issues and re-enable
  // const metadata = getProviderMetadata(providerType);
  // if (!metadata) {
  //   return undefined;
  // }

  // const priority = metadata.defaultPriority;
  // switch (providerType.toLowerCase()) {
  //   case 'firebase':
  //     return {
  //       name: 'Firebase',
  //       priority,
  //       description: 'Google Firebase Authentication with identity providers',
  //       issuerPatterns: ['https://securetoken.google.com/*'],
  //       supportedAlgorithms: ['RS256'],
  //       requiresConfiguration: true, // Requires project ID
  //     };
  //   default:
  //     return undefined;
  // }
  return undefined;
}
