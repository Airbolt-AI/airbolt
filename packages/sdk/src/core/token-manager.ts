import { z } from 'zod';

/**
 * Token response schema for validation
 */
const TokenResponseSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.string(),
  tokenType: z.string(),
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
 * Custom error for token management
 */
export class TokenError extends Error {
  public override readonly name = 'TokenError';
  public readonly statusCode?: number | undefined;
  public override readonly cause?: Error | undefined;
  
  constructor(
    message: string,
    statusCode?: number | undefined,
    cause?: Error | undefined
  ) {
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
 */
export class TokenManager {
  private tokenInfo: TokenInfo | null = null;
  private refreshPromise: Promise<TokenInfo> | null = null;
  private readonly options: Required<TokenManagerOptions>;

  constructor(options: TokenManagerOptions) {
    this.options = {
      userId: 'dev-user',
      refreshBuffer: 300, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    // If we don't have a token or it's expired/expiring soon, refresh it
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
        if (error instanceof z.ZodError || 
            (error instanceof TokenError && error.statusCode === 401)) {
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
   * Fetch a new token from the API
   */
  private async fetchToken(): Promise<unknown> {
    const url = `${this.options.baseURL}/api/tokens`;
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
        const errorData = await response.json() as { message?: string };
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Ignore JSON parsing errors
      }

      throw new TokenError(errorMessage, response.status);
    }

    return response.json();
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
    this.refreshPromise = null;
  }

  /**
   * Check if we have a valid token
   */
  hasValidToken(): boolean {
    return this.tokenInfo !== null && !this.isTokenExpiring();
  }

  /**
   * Get token info for debugging (without exposing actual token)
   */
  getTokenInfo(): { hasToken: boolean; expiresAt?: Date; tokenType?: string } {
    if (this.tokenInfo === null) {
      return { hasToken: false };
    }
    
    return {
      hasToken: true,
      expiresAt: this.tokenInfo.expiresAt,
      tokenType: this.tokenInfo.tokenType,
    };
  }
}