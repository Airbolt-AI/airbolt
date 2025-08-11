import { createHash } from 'node:crypto';
import type { JWTClaims } from '../types/auth.js';

/**
 * SingleFlight provides a duplicate suppression mechanism for async operations.
 * Multiple concurrent calls with the same key will be coalesced into a single operation,
 * with all callers receiving the same result or error.
 *
 * This is particularly useful for:
 * - JWT token verification (prevent duplicate verifications of the same token)
 * - JWKS fetching (prevent duplicate network calls to the same issuer)
 * - Any expensive operation that might be called multiple times concurrently
 */
export class SingleFlight<T> {
  private readonly inflight = new Map<string, Promise<T>>();

  /**
   * Execute an operation with single-flight coalescing.
   * If an operation with the same key is already in progress, returns the existing promise.
   * Otherwise, starts a new operation and tracks it.
   *
   * @param key - Unique identifier for the operation
   * @param fn - Function to execute if no operation is in flight
   * @returns Promise that resolves to the operation result
   */
  async do(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if operation is already in flight
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    // Start new operation
    const promise = this.executeWithCleanup(key, fn);
    this.inflight.set(key, promise);

    return promise;
  }

  /**
   * Execute the operation with automatic cleanup on completion.
   * Ensures the operation is removed from inflight map regardless of success or failure.
   */
  private async executeWithCleanup(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      const result = await fn();
      this.inflight.delete(key);
      return result;
    } catch (error) {
      this.inflight.delete(key);
      throw error;
    }
  }

  /**
   * Manually remove an operation from the inflight map.
   * This can be used to cancel coalescing for a specific key,
   * allowing new operations to start fresh.
   *
   * @param key - Key to remove from inflight operations
   */
  forget(key: string): void {
    this.inflight.delete(key);
  }

  /**
   * Get statistics about the current state of the SingleFlight instance.
   * Useful for monitoring and debugging.
   *
   * @returns Object containing current statistics
   */
  stats(): { inFlightCount: number; keys: readonly string[] } {
    return {
      inFlightCount: this.inflight.size,
      keys: Array.from(this.inflight.keys()),
    };
  }

  /**
   * Clear all inflight operations.
   * Note: This doesn't cancel the underlying operations, just removes tracking.
   * Use with caution as it may lead to duplicate operations.
   */
  clear(): void {
    this.inflight.clear();
  }
}

/**
 * Creates a SHA-256 hash of a string for use as a SingleFlight key.
 * This is particularly useful for JWT tokens where we want to coalesce
 * verification attempts without storing the actual token in memory.
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function createHashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Pre-configured SingleFlight instance for JWT token verification.
 * Uses token hashes as keys to prevent storing actual tokens in memory.
 */
export const jwtSingleFlight = new SingleFlight<JWTClaims>();
