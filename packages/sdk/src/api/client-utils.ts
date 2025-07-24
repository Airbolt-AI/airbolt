import {
  AirboltClient,
  type AirboltClientOptions,
} from '../core/fern-client.js';
import { detectAuthProvider } from '../auth-providers.js';
import type { ChatOptions } from './types.js';

/**
 * Token information for debugging
 */
export interface TokenInfo {
  hasToken: boolean;
  expiresAt?: Date;
  tokenType?: string;
}

/**
 * Global client instances cache to reuse clients for same baseURL
 */
const clientCache = new Map<string, AirboltClient>();

/**
 * Get or create a client instance for the given baseURL
 */
export function getClientInstance(
  baseURL?: string,
  options?: ChatOptions
): AirboltClient {
  const url = baseURL || 'http://localhost:3000';

  // Create cache key that includes auth method
  const cacheKey = options?.getAuthToken ? `${url}-custom` : url;

  if (!clientCache.has(cacheKey)) {
    const clientOptions: AirboltClientOptions = { baseURL: url };

    // Add auth options if provided
    if (options?.getAuthToken) {
      clientOptions.getAuthToken = options.getAuthToken;
    } else {
      // Auto-detect auth provider if no custom getter provided
      const authProvider = detectAuthProvider();
      if (authProvider) {
        clientOptions.authProvider = authProvider;
      }
    }

    clientCache.set(cacheKey, new AirboltClient(clientOptions));
  }

  return clientCache.get(cacheKey)!;
}

/**
 * Clear the authentication token for a specific baseURL
 *
 * @param baseURL The base URL for the API (defaults to localhost:3000)
 *
 * @example
 * ```typescript
 * // Clear token for default URL
 * clearAuthToken();
 *
 * // Clear token for specific URL
 * clearAuthToken('https://api.airbolt.dev');
 * ```
 */
export function clearAuthToken(baseURL?: string): void {
  const client = getClientInstance(baseURL);
  client.clearToken();
}

/**
 * Check if there's a valid authentication token for a specific baseURL
 *
 * @param baseURL The base URL for the API (defaults to localhost:3000)
 * @returns True if a valid token exists
 *
 * @example
 * ```typescript
 * if (hasValidToken()) {
 *   console.log('User is authenticated');
 * }
 * ```
 */
export function hasValidToken(baseURL?: string): boolean {
  const client = getClientInstance(baseURL);
  return client.hasValidToken();
}

/**
 * Get token information for debugging purposes
 *
 * @param baseURL The base URL for the API (defaults to localhost:3000)
 * @returns Token information object
 *
 * @example
 * ```typescript
 * const info = getTokenInfo();
 * console.log('Has token:', info.hasToken);
 * console.log('Expires at:', info.expiresAt);
 * ```
 */
export function getTokenInfo(baseURL?: string): TokenInfo {
  const client = getClientInstance(baseURL);
  return client.getTokenInfo();
}
