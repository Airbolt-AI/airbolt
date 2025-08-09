import { z } from 'zod';
import { joinUrl } from './url-utils.js';
import type { AuthProvider } from '../auth-providers.js';

/**
 * Token response schema for validation
 */
const TokenResponseSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.string(),
  tokenType: z.string(),
});

/**
 * Exchange response schema for validation
 */
const ExchangeResponseSchema = z.object({
  sessionToken: z.string().min(1),
  expiresAt: z.string(),
  provider: z.string(),
});

/**
 * Token configuration options
 */
export interface TokenManagerOptions {
  /** Base URL for the API */
  baseURL: string;
  /** User ID for token generation (optional) */
  userId?: string;
  /** Refresh buffer in seconds (default: 300 = 5 minutes) */
  refreshBuffer?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** External auth token getter function */
  getAuthToken?: () => Promise<string> | string;
  /** Auto-detected auth provider */
  authProvider?: AuthProvider | null;
}

/**
 * Token information interface
 */
export interface TokenInfo {
  token: string;
  expiresAt: Date;
  tokenType: string;
}

/**
 * Session token information interface
 */
export interface SessionTokenInfo {
  sessionToken: string;
  expiresAt: Date;
  provider: string;
}

/**
 * Custom error for token management
 */
export class TokenError extends Error {
  public override readonly name = 'TokenError';
  public readonly statusCode?: number | undefined;
  public override readonly cause?: Error | undefined;

  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * Secure token manager with automatic refresh capabilities
 *
 * Features:
 * - Automatic token refresh before expiration
 * - Secure token storage with proper cleanup
 * - Retry logic with exponential backoff
 * - Race condition protection
 * - Environment-agnostic (browser/Node.js)
 * - Session token exchange for external auth providers
 *
 * Auth Modes:
 * - Internal: Uses /api/tokens endpoint for traditional token generation
 * - External: Exchanges external provider tokens (Clerk, Auth0) for session tokens via /api/auth/exchange
 *   - Caches session tokens to reduce provider calls from every request to once per session
 *   - Automatically refreshes when session tokens expire
 */
export class TokenManager {
  private tokenInfo: TokenInfo | null = null;
  private sessionTokenInfo: SessionTokenInfo | null = null;
  private refreshPromise: Promise<TokenInfo> | null = null;
  private exchangePromise: Promise<SessionTokenInfo> | null = null;
  private readonly options: Required<TokenManagerOptions>;
  private readonly originalOptions: TokenManagerOptions;
  private authMethod: 'internal' | 'external' = 'internal';
  private providerTokenCache = new Map<
    string,
    { token: string; expiry: number }
  >();

  constructor(options: TokenManagerOptions) {
    this.originalOptions = options;
    this.options = {
      userId: 'dev-user',
      refreshBuffer: 300, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    } as Required<TokenManagerOptions>;

    // Determine auth method
    if (options.getAuthToken || options.authProvider) {
      this.authMethod = 'external';
    }
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    if (this.authMethod === 'external') {
      // For external auth, use session token caching
      if (!this.sessionTokenInfo || this.isSessionTokenExpiring()) {
        await this.exchangeForSessionToken();
      }

      if (!this.sessionTokenInfo) {
        throw new TokenError('Failed to obtain valid session token');
      }

      return this.sessionTokenInfo.sessionToken;
    }

    // Internal auth flow
    if (!this.tokenInfo || this.isTokenExpiring()) {
      await this.refreshToken();
    }

    if (!this.tokenInfo) {
      throw new TokenError('Failed to obtain valid token');
    }

    return this.tokenInfo.token;
  }

  /**
   * Check if the current token is expired or expiring soon
   */
  private isTokenExpiring(): boolean {
    if (!this.tokenInfo) return true;

    const now = new Date();
    const expiryWithBuffer = new Date(
      this.tokenInfo.expiresAt.getTime() - this.options.refreshBuffer * 1000
    );

    return now >= expiryWithBuffer;
  }

  /**
   * Check if the current session token is expired or expiring soon
   */
  private isSessionTokenExpiring(): boolean {
    if (!this.sessionTokenInfo) return true;

    const now = new Date();
    const expiryWithBuffer = new Date(
      this.sessionTokenInfo.expiresAt.getTime() -
        this.options.refreshBuffer * 1000
    );

    return now >= expiryWithBuffer;
  }

  /**
   * Get a cached provider token if available and valid
   */
  private getCachedProviderToken(cacheKey: string): string | null {
    const cached = this.providerTokenCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    // Check if token is valid for at least 1 more minute
    const oneMinuteFromNow = now + 60 * 1000;
    if (cached.expiry <= oneMinuteFromNow) {
      // Remove expired token from cache
      this.providerTokenCache.delete(cacheKey);
      return null;
    }

    return cached.token;
  }

  /**
   * Cache a provider token for 55 minutes
   */
  private cacheProviderToken(cacheKey: string, token: string): void {
    const now = Date.now();
    // Cache for 55 minutes (assuming 1-hour validity from provider)
    const expiry = now + 55 * 60 * 1000;

    this.providerTokenCache.set(cacheKey, { token, expiry });
  }

  /**
   * Generate cache key for provider token
   */
  private getProviderTokenCacheKey(): string {
    // Use auth method and user info to create a unique cache key
    // For getAuthToken function, we can't identify specific users, so use a generic key
    // For authProvider, we could potentially use user info if available
    if (this.originalOptions.getAuthToken) {
      return 'external-auth-token';
    }

    if (this.originalOptions.authProvider) {
      // Use provider name as part of the cache key
      return `provider-${this.originalOptions.authProvider.constructor.name || 'unknown'}`;
    }

    return 'external-token';
  }

  /**
   * Refresh the token with race condition protection
   */
  private async refreshToken(): Promise<TokenInfo> {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start a new refresh
    this.refreshPromise = this.performTokenRefresh();

    try {
      const tokenInfo = await this.refreshPromise;
      this.tokenInfo = tokenInfo;
      return tokenInfo;
    } finally {
      // Clear the refresh promise when done
      this.refreshPromise = null;
    }
  }

  /**
   * Exchange provider token for session token with race condition protection
   */
  private async exchangeForSessionToken(): Promise<SessionTokenInfo> {
    // If an exchange is already in progress, wait for it
    if (this.exchangePromise) {
      return this.exchangePromise;
    }

    // Start a new exchange
    this.exchangePromise = this.performTokenExchange();

    try {
      const sessionTokenInfo = await this.exchangePromise;
      this.sessionTokenInfo = sessionTokenInfo;
      return sessionTokenInfo;
    } finally {
      // Clear the exchange promise when done
      this.exchangePromise = null;
    }
  }

  /**
   * Perform the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<TokenInfo> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        const response = await this.fetchToken();
        const tokenData = TokenResponseSchema.parse(response);

        // Parse expiration time
        const expiresAt = this.parseExpirationTime(tokenData.expiresIn);

        return {
          token: tokenData.token,
          expiresAt,
          tokenType: tokenData.tokenType,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation errors or auth errors
        if (
          error instanceof z.ZodError ||
          (error instanceof TokenError && error.statusCode === 401)
        ) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.options.maxRetries) {
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new TokenError(
      `Failed to refresh token after ${this.options.maxRetries} attempts`,
      undefined,
      lastError ?? undefined
    );
  }

  /**
   * Perform the actual token exchange with retry logic
   */
  private async performTokenExchange(): Promise<SessionTokenInfo> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Get provider token with caching
        const cacheKey = this.getProviderTokenCacheKey();
        let providerToken = this.getCachedProviderToken(cacheKey);

        if (!providerToken) {
          // Cache miss - fetch new token from provider
          providerToken = this.originalOptions.getAuthToken
            ? await this.originalOptions.getAuthToken()
            : await this.originalOptions.authProvider!.getToken();

          if (!providerToken) {
            throw new TokenError('No token returned from auth provider');
          }

          // Cache the new provider token for 55 minutes
          this.cacheProviderToken(cacheKey, providerToken);
        }

        // Exchange provider token for session token
        const response = await this.exchangeProviderToken(providerToken);
        const exchangeData = ExchangeResponseSchema.parse(response);

        // Parse expiration time - it comes as ISO string
        const expiresAt = new Date(exchangeData.expiresAt);

        if (isNaN(expiresAt.getTime())) {
          throw new TokenError(
            `Invalid expiration date: ${exchangeData.expiresAt}`
          );
        }

        return {
          sessionToken: exchangeData.sessionToken,
          expiresAt,
          provider: exchangeData.provider,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation errors, auth errors, or provider errors
        if (
          error instanceof z.ZodError ||
          (error instanceof TokenError &&
            (error.statusCode === 401 ||
              error.statusCode === 400 ||
              error.message.includes('auth provider')))
        ) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.options.maxRetries) {
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new TokenError(
      `Failed to exchange token after ${this.options.maxRetries} attempts`,
      undefined,
      lastError ?? undefined
    );
  }

  /**
   * Fetch a new token from the API
   */
  private async fetchToken(): Promise<object> {
    const url = joinUrl(this.options.baseURL, 'api/tokens');
    const body = JSON.stringify({ userId: this.options.userId });

    // Use appropriate fetch implementation based on environment
    const fetchImpl = this.getFetchImplementation();

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      let errorMessage = `Token request failed: ${response.status}`;

      try {
        const errorData = (await response.json()) as { message?: string };
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Ignore JSON parsing errors
      }

      throw new TokenError(errorMessage, response.status);
    }

    return response.json() as Promise<object>;
  }

  /**
   * Exchange provider token for session token
   */
  private async exchangeProviderToken(providerToken: string): Promise<object> {
    const url = joinUrl(this.options.baseURL, 'api/auth/exchange');

    // Use appropriate fetch implementation based on environment
    const fetchImpl = this.getFetchImplementation();

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerToken}`,
      },
      body: JSON.stringify({}), // Empty body as metadata is optional
    });

    if (!response.ok) {
      let errorMessage = `Token exchange failed: ${response.status}`;

      try {
        const errorData = (await response.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore JSON parsing errors
      }

      throw new TokenError(errorMessage, response.status);
    }

    return response.json() as Promise<object>;
  }

  /**
   * Get the appropriate fetch implementation for the environment
   */
  private getFetchImplementation(): typeof fetch {
    // Browser environment
    if (typeof globalThis !== 'undefined' && globalThis.fetch) {
      return globalThis.fetch.bind(globalThis);
    }

    // Fallback - this should not happen in modern environments
    throw new TokenError(
      'No fetch implementation available. Please use a modern browser or Node.js 18+.'
    );
  }

  /**
   * Parse expiration time from various formats
   */
  private parseExpirationTime(expiresIn: string): Date {
    // Handle different formats: "1h", "3600s", "3600", ISO string
    const now = new Date();

    // If it's already an ISO string, parse it directly
    if (expiresIn.includes('T') || expiresIn.includes('-')) {
      return new Date(expiresIn);
    }

    // Parse duration formats
    const match = expiresIn.match(/^(\d+)([smhd]?)$/);
    if (!match) {
      throw new TokenError(`Invalid expiration format: ${expiresIn}`);
    }

    const value = match[1];
    const unit = match[2] || '';

    if (!value) {
      throw new TokenError(`Invalid expiration format: ${expiresIn}`);
    }

    const seconds = parseInt(value, 10);

    let multiplier = 1; // Default to seconds
    switch (unit) {
      case 'm':
        multiplier = 60;
        break;
      case 'h':
        multiplier = 3600;
        break;
      case 'd':
        multiplier = 86400;
        break;
      case 's':
      case '':
        multiplier = 1;
        break;
      default:
        throw new TokenError(`Unknown time unit: ${unit}`);
    }

    return new Date(now.getTime() + seconds * multiplier * 1000);
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear stored token (useful for logout)
   */
  clearToken(): void {
    this.tokenInfo = null;
    this.sessionTokenInfo = null;
    this.refreshPromise = null;
    this.exchangePromise = null;
    // Clear provider token cache on logout
    this.providerTokenCache.clear();
  }

  /**
   * Check if we have a valid token
   */
  hasValidToken(): boolean {
    if (this.authMethod === 'external') {
      return this.sessionTokenInfo !== null && !this.isSessionTokenExpiring();
    }
    return this.tokenInfo !== null && !this.isTokenExpiring();
  }

  /**
   * Get token info for debugging (without exposing actual token)
   */
  getTokenInfo(): {
    hasToken: boolean;
    expiresAt?: Date;
    tokenType?: string;
    provider?: string;
    authMethod: 'internal' | 'external';
  } {
    if (this.authMethod === 'external') {
      if (this.sessionTokenInfo === null) {
        return { hasToken: false, authMethod: 'external' };
      }

      return {
        hasToken: true,
        expiresAt: this.sessionTokenInfo.expiresAt,
        tokenType: 'session',
        provider: this.sessionTokenInfo.provider,
        authMethod: 'external',
      };
    }

    if (this.tokenInfo === null) {
      return { hasToken: false, authMethod: 'internal' };
    }

    return {
      hasToken: true,
      expiresAt: this.tokenInfo.expiresAt,
      tokenType: this.tokenInfo.tokenType,
      authMethod: 'internal',
    };
  }
}
