import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenManager, TokenError } from '../../src/core/token-manager';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  const baseURL = 'https://api.example.com';
  const mockTokenResponse = {
    token: 'test-jwt-token',
    expiresIn: '3600',
    tokenType: 'Bearer',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tokenManager = new TokenManager({
      baseURL,
      userId: 'test-user',
      refreshBuffer: 300, // 5 minutes
      maxRetries: 3,
      retryDelay: 100, // Faster for tests
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('getToken', () => {
    it('should fetch and return a token on first call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      const token = await tokenManager.getToken();

      expect(token).toBe(mockTokenResponse.token);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/tokens`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'test-user' }),
        })
      );
    });

    it('should return cached token if still valid', async () => {
      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      const token1 = await tokenManager.getToken();
      const token2 = await tokenManager.getToken();

      expect(token1).toBe(token2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh token if expired', async () => {
      const expiredTokenResponse = {
        ...mockTokenResponse,
        expiresIn: '1', // 1 second
      };

      // Mock all possible fetch calls for refresh scenarios
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(expiredTokenResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockTokenResponse),
        });

      await tokenManager.getToken();

      // Wait for token to expire + buffer
      await new Promise(resolve => setTimeout(resolve, 1100));

      const token = await tokenManager.getToken();

      expect(token).toBe(mockTokenResponse.token);
      // Allow for multiple refresh calls due to expiration and buffer logic
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle concurrent token refresh requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      // Make multiple concurrent calls
      const promises = [
        tokenManager.getToken(),
        tokenManager.getToken(),
        tokenManager.getToken(),
      ];

      const tokens = await Promise.all(promises);

      // All tokens should be the same
      expect(tokens[0]).toBe(tokens[1]);
      expect(tokens[1]).toBe(tokens[2]);
      
      // Only one fetch should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network failures', async () => {
      // First two calls fail
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockTokenResponse),
        });

      const token = await tokenManager.getToken();

      expect(token).toBe(mockTokenResponse.token);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw TokenError after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(tokenManager.getToken()).rejects.toThrow(TokenError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should throw TokenError on HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ message: 'Bad request' }),
      });

      await expect(tokenManager.getToken()).rejects.toThrow(TokenError);
    });

    it('should not retry on validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: 'response' }),
      });

      await expect(tokenManager.getToken()).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('parseExpirationTime', () => {
    it('should parse seconds correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ...mockTokenResponse,
          expiresIn: '3600',
        }),
      });

      await tokenManager.getToken();
      const info = tokenManager.getTokenInfo();
      
      expect(info.expiresAt).toBeInstanceOf(Date);
      expect(info.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should parse time units correctly', async () => {
      const testCases = [
        { input: '60s', expectedSeconds: 60 },
        { input: '5m', expectedSeconds: 300 },
        { input: '1h', expectedSeconds: 3600 },
        { input: '1d', expectedSeconds: 86400 },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            ...mockTokenResponse,
            expiresIn: testCase.input,
          }),
        });

        const beforeTime = Date.now();
        await tokenManager.getToken();
        const info = tokenManager.getTokenInfo();
        const afterTime = Date.now();

        const expectedExpiry = beforeTime + testCase.expectedSeconds * 1000;
        const actualExpiry = info.expiresAt!.getTime();

        // Allow for some timing variance
        expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 100);
        expect(actualExpiry).toBeLessThanOrEqual(afterTime + testCase.expectedSeconds * 1000);

        tokenManager.clearToken();
        vi.clearAllMocks();
      }
    });

    it('should throw on invalid expiration format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ...mockTokenResponse,
          expiresIn: 'invalid',
        }),
      });

      await expect(tokenManager.getToken()).rejects.toThrow(TokenError);
    });
  });

  describe('clearToken', () => {
    it('should clear stored token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      await tokenManager.getToken();
      expect(tokenManager.hasValidToken()).toBe(true);

      tokenManager.clearToken();
      expect(tokenManager.hasValidToken()).toBe(false);
    });
  });

  describe('hasValidToken', () => {
    it('should return false when no token', () => {
      expect(tokenManager.hasValidToken()).toBe(false);
    });

    it('should return true when valid token exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      await tokenManager.getToken();
      expect(tokenManager.hasValidToken()).toBe(true);
    });

    it('should return false when token is expired', async () => {
      // Create a token manager with very short buffer for this test
      const shortBufferManager = new TokenManager({
        baseURL: 'https://api.example.com',
        refreshBuffer: 0, // No buffer for this test
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ...mockTokenResponse,
          expiresIn: '1', // 1 second
        }),
      });

      await shortBufferManager.getToken();
      expect(shortBufferManager.hasValidToken()).toBe(true);

      // Wait for expiration (1 second + a bit more)
      await new Promise(resolve => setTimeout(resolve, 1200));
      expect(shortBufferManager.hasValidToken()).toBe(false);
    });
  });

  describe('getTokenInfo', () => {
    it('should return token info without exposing actual token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      await tokenManager.getToken();
      const info = tokenManager.getTokenInfo();

      expect(info).toEqual({
        hasToken: true,
        expiresAt: expect.any(Date),
        tokenType: 'Bearer',
      });

      // Should not expose actual token
      expect(info).not.toHaveProperty('token');
    });

    it('should return minimal info when no token', () => {
      const info = tokenManager.getTokenInfo();
      expect(info).toEqual({
        hasToken: false,
      });
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(tokenManager.getToken()).rejects.toThrow(TokenError);
    });

    it('should handle missing fetch implementation', async () => {
      // Temporarily remove fetch
      const originalFetch = global.fetch;
      delete (global as any).fetch;
      // Only try to delete window.fetch if window exists (browser environment)
      if (typeof window !== 'undefined') {
        delete (window as any).fetch;
      }

      const manager = new TokenManager({ baseURL });

      await expect(manager.getToken()).rejects.toThrow(TokenError);

      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe('edge cases', () => {
    it('should handle empty response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(null),
      });

      await expect(tokenManager.getToken()).rejects.toThrow();
    });

    it('should handle malformed token response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          token: '', // Empty token
          expiresIn: '3600',
          tokenType: 'Bearer',
        }),
      });

      await expect(tokenManager.getToken()).rejects.toThrow();
    });

    it('should handle extremely short expiration times', async () => {
      // Create a token manager with no refresh buffer for this test
      const noBufferManager = new TokenManager({
        baseURL: 'https://api.example.com',
        refreshBuffer: 0,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ...mockTokenResponse,
          expiresIn: '0', // Expires immediately
        }),
      });

      await noBufferManager.getToken();
      
      // Token should be considered expired immediately
      expect(noBufferManager.hasValidToken()).toBe(false);
    });
  });
});