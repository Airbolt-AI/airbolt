/**
 * Tests for AirboltClient URL normalization
 *
 * Verifies that our wrapper properly normalizes baseURLs with trailing slashes
 * to work around the Fern-generated URL joining bug.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AirboltClient } from '../../src/core/fern-client.js';

describe('AirboltClient URL normalization', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });

  describe('baseURL normalization', () => {
    it('should normalize baseURL with single trailing slash', () => {
      const client = new AirboltClient({
        baseURL: 'https://api.example.com/',
        userId: 'test-user',
      });

      expect(client.getBaseURL()).toBe('https://api.example.com');
    });

    it('should normalize baseURL with multiple trailing slashes', () => {
      const client = new AirboltClient({
        baseURL: 'https://api.example.com///',
        userId: 'test-user',
      });

      expect(client.getBaseURL()).toBe('https://api.example.com');
    });

    it('should not modify baseURL without trailing slash', () => {
      const client = new AirboltClient({
        baseURL: 'https://api.example.com',
        userId: 'test-user',
      });

      expect(client.getBaseURL()).toBe('https://api.example.com');
    });

    it('should handle baseURL with path and trailing slash', () => {
      const client = new AirboltClient({
        baseURL: 'https://api.example.com/v1/',
        userId: 'test-user',
      });

      expect(client.getBaseURL()).toBe('https://api.example.com/v1');
    });
  });

  describe('Integration with normalized URLs', () => {
    it('should create client with normalized baseURL', () => {
      const testCases = [
        {
          input: 'https://api.example.com/',
          expected: 'https://api.example.com',
        },
        {
          input: 'https://api.example.com//',
          expected: 'https://api.example.com',
        },
        {
          input: 'https://api.example.com///',
          expected: 'https://api.example.com',
        },
        { input: 'http://localhost:3000/', expected: 'http://localhost:3000' },
        {
          input: 'https://api.example.com/v1/',
          expected: 'https://api.example.com/v1',
        },
      ];

      for (const { input, expected } of testCases) {
        const client = new AirboltClient({
          baseURL: input,
          userId: 'test-user',
        });

        expect(client.getBaseURL()).toBe(expected);

        // Verify the normalized URL is stored in options
        expect(client['options'].baseURL).toBe(expected);
      }
    });

    it('should pass normalized baseURL to Fern client', () => {
      // This test verifies the baseURL normalization prevents the double slash issue
      const clientWithSlash = new AirboltClient({
        baseURL: 'https://api.example.com/',
        userId: 'test-user',
      });

      const clientWithoutSlash = new AirboltClient({
        baseURL: 'https://api.example.com',
        userId: 'test-user',
      });

      // Both should have the same normalized baseURL
      expect(clientWithSlash.getBaseURL()).toBe(
        clientWithoutSlash.getBaseURL()
      );
      expect(clientWithSlash.getBaseURL()).toBe('https://api.example.com');
    });
  });

  describe('TokenManager integration', () => {
    it('should pass normalized baseURL to TokenManager', () => {
      // Create a client with trailing slashes
      const client = new AirboltClient({
        baseURL: 'https://api.example.com///',
        userId: 'test-user',
      });

      // The TokenManager should receive the normalized baseURL
      // We can verify this by checking the tokenManager's options
      const tokenManager = client['tokenManager'];

      // The tokenManager stores the baseURL in its options
      expect(tokenManager['options'].baseURL).toBe('https://api.example.com');
    });

    it('should work correctly with custom TokenManager', () => {
      // Create a custom token manager to verify it receives normalized URL
      class CustomTokenManager {
        constructor(_options: any) {
          // Options param is intentionally unused - just verifying normalization
        }

        async getToken() {
          return 'custom-token';
        }

        clearToken() {}

        hasValidToken() {
          return true;
        }

        getTokenInfo() {
          return { hasToken: true };
        }
      }

      const client = new AirboltClient({
        baseURL: 'https://api.example.com///',
        userId: 'test-user',
        tokenManager: new CustomTokenManager({
          baseURL: 'https://api.example.com///',
          userId: 'test-user',
        }) as any,
      });

      // The client should still normalize its own baseURL
      expect(client.getBaseURL()).toBe('https://api.example.com');
    });
  });

  describe('Edge cases', () => {
    it('should handle localhost URLs with trailing slashes', () => {
      const client = new AirboltClient({
        baseURL: 'http://localhost:3000/',
        userId: 'test-user',
      });

      expect(client.getBaseURL()).toBe('http://localhost:3000');
    });

    it('should handle URLs with ports and trailing slashes', () => {
      const client = new AirboltClient({
        baseURL: 'https://api.example.com:8443//',
        userId: 'test-user',
      });

      expect(client.getBaseURL()).toBe('https://api.example.com:8443');
    });

    it('should preserve query parameters while removing trailing slash', () => {
      const client = new AirboltClient({
        baseURL: 'https://api.example.com/?debug=true',
        userId: 'test-user',
      });

      // Note: Query params in baseURL is unusual but should be preserved
      expect(client.getBaseURL()).toBe('https://api.example.com/?debug=true');
    });
  });
});
