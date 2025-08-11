import type { FastifyRequest } from 'fastify';
import { isDevelopment } from '@airbolt/config';

export interface ExchangeRateLimitConfig {
  max: number; // Max requests
  windowMs: number; // Time window in milliseconds
  keyGenerator?: (req: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  hits: Array<{ timestamp: number; success: boolean }>;
}

// Default: 10 requests per 15 minutes per IP/user
const DEFAULT_CONFIG: ExchangeRateLimitConfig = {
  max: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

/**
 * Rate limiter for token exchange endpoint
 * Uses in-memory storage with automatic cleanup
 * Supports different limits for authenticated vs unauthenticated users
 */
export class ExchangeRateLimiter {
  private requests: Map<string, RateLimitEntry>;
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor(private config: ExchangeRateLimitConfig = DEFAULT_CONFIG) {
    this.requests = new Map();
    this.startCleanupTimer();
  }

  /**
   * Check if request should be allowed
   * @param key - Rate limit key (typically IP + user ID)
   * @returns Rate limit result with allowed status and metadata
   */
  checkLimit(key: string): RateLimitResult {
    // In development mode, allow all requests
    if (isDevelopment()) {
      return {
        allowed: true,
        remaining: this.config.max,
        resetTime: Date.now() + this.config.windowMs,
        totalHits: 0,
      };
    }

    const now = Date.now();
    const entry = this.requests.get(key);

    // First request for this key
    if (!entry) {
      return {
        allowed: true,
        remaining: this.config.max - 1,
        resetTime: now + this.config.windowMs,
        totalHits: 0,
      };
    }

    // Check if window has expired
    if (now >= entry.resetTime) {
      return {
        allowed: true,
        remaining: this.config.max - 1,
        resetTime: now + this.config.windowMs,
        totalHits: 0,
      };
    }

    // Count valid requests in current window
    const validHits = this.countValidHits(entry.hits, now);
    const remaining = Math.max(0, this.config.max - validHits);

    return {
      allowed: validHits < this.config.max,
      remaining: remaining,
      resetTime: entry.resetTime,
      totalHits: validHits,
    };
  }

  /**
   * Record a request attempt
   * @param key - Rate limit key
   * @param success - Whether the request was successful
   */
  recordRequest(key: string, success: boolean): void {
    // Skip recording in development mode
    if (isDevelopment()) {
      return;
    }

    // Skip recording based on configuration
    if (
      (success && this.config.skipSuccessfulRequests) ||
      (!success && this.config.skipFailedRequests)
    ) {
      return;
    }

    const now = Date.now();
    let entry = this.requests.get(key);

    // Create new entry if needed
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        hits: [],
      };
    }

    // Add hit to entry
    entry.hits.push({ timestamp: now, success });
    entry.count = this.countValidHits(entry.hits, now);

    // Clean old hits to prevent memory bloat
    entry.hits = entry.hits.filter(
      hit => hit.timestamp > now - this.config.windowMs
    );

    this.requests.set(key, entry);
  }

  /**
   * Generate rate limit key from request
   * Uses IP + user ID when available for more accurate limiting
   * @param req - Fastify request object
   * @returns Unique key for rate limiting
   */
  generateKey(req: FastifyRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Extract user ID from potential sources
    const authHeader = req.headers.authorization;
    let userId = 'anonymous';

    if (authHeader?.startsWith('Bearer ')) {
      try {
        // Try to extract user ID from token (basic decode)
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadString = Buffer.from(parts[1]!, 'base64url').toString();
          const payload = JSON.parse(payloadString) as Record<string, unknown>;
          userId =
            (typeof payload['sub'] === 'string' ? payload['sub'] : null) ||
            'anonymous';
        }
      } catch {
        // If decoding fails, use anonymous
        userId = 'anonymous';
      }
    }

    // Combine IP and user ID for more accurate limiting
    const ip = this.extractIP(req);
    return `${ip}:${userId}`;
  }

  /**
   * Extract IP address from request, handling proxies
   * @param req - Fastify request object
   * @returns Client IP address
   */
  private extractIP(req: FastifyRequest): string {
    // Check for forwarded headers (common in production with proxies)
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      // Take the first IP in case of multiple
      return forwarded.split(',')[0]?.trim() || req.ip;
    }

    const realIP = req.headers['x-real-ip'] as string;
    if (realIP) {
      return realIP;
    }

    // Fallback to direct IP
    return req.ip;
  }

  /**
   * Count valid hits within the current time window
   * @param hits - Array of hit records
   * @param now - Current timestamp
   * @returns Number of valid hits
   */
  private countValidHits(
    hits: Array<{ timestamp: number; success: boolean }>,
    now: number
  ): number {
    const windowStart = now - this.config.windowMs;
    return hits.filter(hit => hit.timestamp > windowStart).length;
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      // Remove entries that have expired
      if (now >= entry.resetTime && entry.hits.length === 0) {
        this.requests.delete(key);
      } else {
        // Clean old hits from remaining entries
        entry.hits = entry.hits.filter(
          hit => hit.timestamp > now - this.config.windowMs
        );
        if (entry.hits.length === 0 && now >= entry.resetTime) {
          this.requests.delete(key);
        }
      }
    }
  }

  /**
   * Get current statistics for monitoring
   * @returns Rate limiter statistics
   */
  getStats(): { totalKeys: number; totalEntries: number; memoryUsage: number } {
    let totalEntries = 0;
    for (const entry of this.requests.values()) {
      totalEntries += entry.hits.length;
    }

    // Rough memory estimation (each entry ~100 bytes + hits)
    const memoryUsage = this.requests.size * 100 + totalEntries * 50;

    return {
      totalKeys: this.requests.size,
      totalEntries,
      memoryUsage,
    };
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Stop cleanup timer and clear all data
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.requests.clear();
  }
}

/**
 * Create a rate limiter with configuration from auth config
 * @param config - Rate limit configuration
 * @returns Configured rate limiter instance
 */
export function createExchangeRateLimiter(config?: {
  max: number;
  windowMs: number;
}): ExchangeRateLimiter {
  return new ExchangeRateLimiter({
    max: config?.max || DEFAULT_CONFIG.max,
    windowMs: config?.windowMs || DEFAULT_CONFIG.windowMs,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });
}
