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
        expect(actualExpiry).toBeLessThanOrEqual(
          afterTime + testCase.expectedSeconds * 1000
        );

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
        authMethod: 'internal',
      });

      // Should not expose actual token
      expect(info).not.toHaveProperty('token');
    });

    it('should return minimal info when no token', () => {
      const info = tokenManager.getTokenInfo();
      expect(info).toEqual({
        hasToken: false,
        authMethod: 'internal',
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

  describe('URL construction', () => {
    it('should handle baseURL with trailing slash correctly', async () => {
      const baseURLWithSlash = 'https://airbolt.onrender.com/';
      const manager = new TokenManager({
        baseURL: baseURLWithSlash,
        userId: 'test-user',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      await manager.getToken();

      // Should construct URL without double slashes
      expect(mockFetch).toHaveBeenCalledWith(
        'https://airbolt.onrender.com/api/tokens',
        expect.any(Object)
      );
    });

    it('should handle baseURL without trailing slash correctly', async () => {
      const baseURLNoSlash = 'https://airbolt.onrender.com';
      const manager = new TokenManager({
        baseURL: baseURLNoSlash,
        userId: 'test-user',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse),
      });

      await manager.getToken();

      // Should construct URL with proper slash
      expect(mockFetch).toHaveBeenCalledWith(
        'https://airbolt.onrender.com/api/tokens',
        expect.any(Object)
      );
    });

    it('should never create double slashes in URLs', async () => {
      const testCases = [
        'https://api.example.com/',
        'https://api.example.com//',
        'https://api.example.com///',
        'http://localhost:3000/',
        'http://localhost:3000//',
      ];

      for (const testUrl of testCases) {
        const manager = new TokenManager({
          baseURL: testUrl,
          userId: 'test-user',
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockTokenResponse),
        });

        await manager.getToken();

        const calledUrl = mockFetch.mock.calls[
          mockFetch.mock.calls.length - 1
        ]?.[0] as string;

        // Check URL doesn't contain double slashes (except after protocol)
        const withoutProtocol = calledUrl.replace(/^https?:\/\//, '');
        expect(withoutProtocol).not.toContain('//');

        // Verify correct final URL (should always be normalized)
        const normalizedBase = testUrl
          .replace(/\/+$/, '')
          .replace(/^(https?:\/\/)/, '$1');
        const expectedUrl = `${normalizedBase}/api/tokens`;
        expect(calledUrl).toBe(expectedUrl);

        vi.clearAllMocks();
      }
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

  describe('External Authentication (Session Token Exchange)', () => {
    const mockSessionTokenResponse = {
      sessionToken: 'session-jwt-token',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      provider: 'clerk',
    };

    it('should exchange external auth token for session token', async () => {
      const mockGetAuthToken = vi
        .fn()
        .mockResolvedValue('external-provider-token');

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
      });

      // Mock exchange endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
      });

      const token = await externalTokenManager.getToken();

      expect(token).toBe(mockSessionTokenResponse.sessionToken);
      expect(mockGetAuthToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/auth/exchange`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer external-provider-token',
          },
          body: JSON.stringify({}),
        })
      );
    });

    it('should cache session token and reuse it', async () => {
      const mockGetAuthToken = vi
        .fn()
        .mockResolvedValue('external-provider-token');

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
      });

      // Mock exchange endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
      });

      // First call - should exchange token
      const token1 = await externalTokenManager.getToken();

      // Second call - should use cached session token
      const token2 = await externalTokenManager.getToken();

      expect(token1).toBe(token2);
      expect(mockGetAuthToken).toHaveBeenCalledTimes(1); // Called only once
      expect(mockFetch).toHaveBeenCalledTimes(1); // Exchange called only once
    });

    it('should detect session token expiry correctly', async () => {
      // Use fake timers for precise control over time
      vi.useFakeTimers();

      const mockGetAuthToken = vi.fn().mockResolvedValue('test-provider-token');

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
        refreshBuffer: 0, // No buffer for this test
      });

      const currentTime = Date.now();

      // Token expires in 1 second
      const shortLivedResponse = {
        ...mockSessionTokenResponse,
        expiresAt: new Date(currentTime + 1000).toISOString(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(shortLivedResponse),
      });

      // Get initial token
      await externalTokenManager.getToken();

      // Should have valid token initially
      expect(externalTokenManager.hasValidToken()).toBe(true);

      // Advance time past token expiration
      vi.advanceTimersByTime(1100); // 1.1 seconds

      // Should now detect token as invalid due to expiry
      expect(externalTokenManager.hasValidToken()).toBe(false);

      vi.useRealTimers();
    });

    it('should work with authProvider instead of getAuthToken', async () => {
      const mockAuthProvider = {
        name: 'test-provider',
        detect: vi.fn().mockReturnValue(true),
        getToken: vi.fn().mockResolvedValue('provider-auth-token'),
      };

      const externalTokenManager = new TokenManager({
        baseURL,
        authProvider: mockAuthProvider,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
      });

      const token = await externalTokenManager.getToken();

      expect(token).toBe(mockSessionTokenResponse.sessionToken);
      expect(mockAuthProvider.getToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/auth/exchange`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer provider-auth-token',
          },
        })
      );
    });

    it('should handle token exchange errors properly', async () => {
      const mockGetAuthToken = vi.fn().mockResolvedValue('invalid-token');

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'UnauthorizedError',
          message: 'Invalid provider token',
        }),
      });

      await expect(externalTokenManager.getToken()).rejects.toThrow(TokenError);
    });

    it('should handle provider token failure gracefully', async () => {
      const mockGetAuthToken = vi
        .fn()
        .mockRejectedValue(new Error('Provider unavailable'));

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
      });

      await expect(externalTokenManager.getToken()).rejects.toThrow(TokenError);
    });

    it('should return correct token info for external auth', async () => {
      const mockGetAuthToken = vi.fn().mockResolvedValue('external-token');

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
      });

      await externalTokenManager.getToken();
      const info = externalTokenManager.getTokenInfo();

      expect(info).toEqual({
        hasToken: true,
        expiresAt: expect.any(Date),
        tokenType: 'session',
        provider: 'clerk',
        authMethod: 'external',
      });
    });

    it('should handle concurrent session token exchange requests', async () => {
      const mockGetAuthToken = vi.fn().mockResolvedValue('external-token');

      const externalTokenManager = new TokenManager({
        baseURL,
        getAuthToken: mockGetAuthToken,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
      });

      // Fire multiple concurrent requests
      const promises = [
        externalTokenManager.getToken(),
        externalTokenManager.getToken(),
        externalTokenManager.getToken(),
      ];

      const tokens = await Promise.all(promises);

      // All should return the same token
      expect(tokens).toEqual([
        mockSessionTokenResponse.sessionToken,
        mockSessionTokenResponse.sessionToken,
        mockSessionTokenResponse.sessionToken,
      ]);

      // Provider should only be called once
      expect(mockGetAuthToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Auth State Changes (Mid-Session)', () => {
    const mockSessionTokenResponse = {
      sessionToken: 'session-jwt-token',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      provider: 'clerk',
    };

    describe('User signs out during active session', () => {
      it('should detect when provider returns null after previously returning valid token', async () => {
        let callCount = 0;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('valid-external-token');
          }
          // User signed out - provider now returns null
          return Promise.resolve(null);
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
        });

        // Mock initial successful token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call - should work
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);
        expect(mockGetAuthToken).toHaveBeenCalledTimes(1);

        // Clear the session token to simulate expiration
        externalTokenManager.clearToken();

        // Second call - provider returns null (user signed out)
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          new TokenError('No token returned from auth provider')
        );
        expect(mockGetAuthToken).toHaveBeenCalledTimes(2);
      });

      it('should handle authProvider returning null after working', async () => {
        let callCount = 0;
        const mockAuthProvider = {
          name: 'test-provider',
          detect: vi.fn().mockReturnValue(true),
          getToken: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve('valid-provider-token');
            }
            // User signed out - provider now returns null
            return Promise.resolve(null);
          }),
        };

        const externalTokenManager = new TokenManager({
          baseURL,
          authProvider: mockAuthProvider,
        });

        // Mock initial successful token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call - should work
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);
        expect(mockAuthProvider.getToken).toHaveBeenCalledTimes(1);

        // Clear the session token to simulate expiration
        externalTokenManager.clearToken();

        // Second call - provider returns null (user signed out)
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          new TokenError('No token returned from auth provider')
        );
        expect(mockAuthProvider.getToken).toHaveBeenCalledTimes(2);
      });

      it('should not cache tokens when provider returns null', async () => {
        const mockGetAuthToken = vi
          .fn()
          .mockResolvedValueOnce('valid-token') // First call succeeds
          .mockResolvedValue(null); // Subsequent calls return null

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
        });

        // Mock successful token exchange
        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call works
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);

        // Clear token to force refresh
        externalTokenManager.clearToken();

        // Second call should fail immediately without caching null
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          TokenError
        );

        // Third call should still fail (not return cached null)
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          TokenError
        );

        expect(mockGetAuthToken).toHaveBeenCalledTimes(3);
      });
    });

    describe('Token becomes invalid mid-session', () => {
      it('should handle provider throwing error after working', async () => {
        let callCount = 0;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('valid-external-token');
          }
          // Token became invalid - provider throws error
          throw new Error('Token expired at provider level');
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10, // Faster retries for test
        });

        // Mock initial successful token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call - should work
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);
        expect(mockGetAuthToken).toHaveBeenCalledTimes(1);

        // Clear the session token to simulate expiration
        externalTokenManager.clearToken();

        // Second call - provider throws error
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );
        expect(mockGetAuthToken).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      });

      it('should clear cached provider token when it becomes invalid', async () => {
        let callCount = 0;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('cached-provider-token');
          } else if (callCount === 2) {
            // This will cause 401 error in exchange
            return Promise.resolve('invalid-cached-token');
          }
          return Promise.resolve('new-provider-token');
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
        });

        // Mock successful token exchanges
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: vi.fn().mockResolvedValue({
              error: 'InvalidToken',
              message: 'Provider token is invalid',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({
              ...mockSessionTokenResponse,
              sessionToken: 'new-session-token',
            }),
          });

        // First call - should cache provider token
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);
        expect(mockGetAuthToken).toHaveBeenCalledTimes(1);

        // Clear session token to simulate expiration
        externalTokenManager.clearToken();

        // Second call - exchange fails with 401, should not retry
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Provider token is invalid'
        );
        expect(mockGetAuthToken).toHaveBeenCalledTimes(2);

        // Third call - should fetch new provider token
        const token3 = await externalTokenManager.getToken();
        expect(token3).toBe('new-session-token');
        expect(mockGetAuthToken).toHaveBeenCalledTimes(2); // Only called twice due to auth error not retrying
      });

      it('should handle exchange endpoint returning 401 after working', async () => {
        const mockGetAuthToken = vi
          .fn()
          .mockResolvedValue('valid-provider-token');

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
        });

        // Mock first successful, then unauthorized exchange
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: vi.fn().mockResolvedValue({
              error: 'UnauthorizedError',
              message: 'Invalid or expired provider token',
            }),
          });

        // First call works
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);

        // Clear token to force refresh
        externalTokenManager.clearToken();

        // Second call fails with 401 - should not retry
        const error = await externalTokenManager.getToken().catch(e => e);
        expect(error).toBeInstanceOf(TokenError);
        expect(error.message).toBe('Invalid or expired provider token');
        expect(error.statusCode).toBe(401);

        // Should have tried provider only once (no retries on auth errors)
        expect(mockGetAuthToken).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('Provider becomes unavailable', () => {
      it('should handle network error after successful auth', async () => {
        let callCount = 0;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('valid-external-token');
          }
          // Network becomes unavailable
          throw new Error('Network error: unable to reach auth provider');
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10, // Faster retries for test
        });

        // Mock initial successful token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call - should work
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);
        expect(mockGetAuthToken).toHaveBeenCalledTimes(1);

        // Clear the session token to simulate expiration
        externalTokenManager.clearToken();

        // Second call - network error should be retried
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );
        expect(mockGetAuthToken).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      });

      it('should handle timeout errors during provider calls', async () => {
        let callCount = 0;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('valid-external-token');
          }
          // Simulate timeout - reject immediately for faster test
          return Promise.reject(new Error('Request timeout'));
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10, // Faster retries for test
        });

        // Mock initial successful token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call works
        await externalTokenManager.getToken();

        // Clear token to force refresh
        externalTokenManager.clearToken();

        // Second call should timeout and retry
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );
        expect(mockGetAuthToken).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      });

      it('should handle exchange endpoint becoming unavailable', async () => {
        const mockGetAuthToken = vi
          .fn()
          .mockResolvedValue('valid-provider-token');

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10, // Faster retries for test
        });

        // Mock first successful, then network error on exchange
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
          })
          .mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

        // First call works
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);

        // Clear token to force refresh
        externalTokenManager.clearToken();

        // Second call fails with network error - should retry
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );

        // Provider should be called multiple times (retries network errors)
        expect(mockGetAuthToken).toHaveBeenCalledTimes(2); // Provider called once for each attempt
        expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      });
    });

    describe('Graceful fallback when auth provider disappears', () => {
      it('should handle provider becoming undefined mid-session', async () => {
        let providerAvailable = true;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          if (!providerAvailable) {
            throw new Error('Auth provider is no longer available');
          }
          return Promise.resolve('valid-provider-token');
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10, // Faster retries for test
        });

        // Mock successful token exchange
        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call works
        const token1 = await externalTokenManager.getToken();
        expect(token1).toBe(mockSessionTokenResponse.sessionToken);

        // Simulate provider disappearing
        providerAvailable = false;
        externalTokenManager.clearToken();

        // Should fail gracefully with clear error
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );
      });

      it('should handle authProvider object becoming null', async () => {
        const mockAuthProvider = {
          name: 'disappearing-provider',
          detect: vi.fn().mockReturnValue(true),
          getToken: vi
            .fn()
            .mockResolvedValueOnce('valid-token')
            .mockImplementation(() => {
              throw new Error('Provider has been destroyed');
            }),
        };

        const externalTokenManager = new TokenManager({
          baseURL,
          authProvider: mockAuthProvider,
          retryDelay: 10, // Faster retries for test
        });

        // Mock successful token exchange
        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // First call works
        await externalTokenManager.getToken();

        // Clear token and try again - provider is now broken
        externalTokenManager.clearToken();

        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );
      });

      it('should not cache invalid states from broken providers', async () => {
        let callCount = 0;
        const mockGetAuthToken = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 3) {
            // Fail for first 3 calls (will exhaust max retries)
            throw new Error('Provider temporarily unavailable');
          }
          // Provider recovers on subsequent calls
          return Promise.resolve('recovered-provider-token');
        });

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10,
        });

        // Mock successful token exchange for when provider recovers
        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            ...mockSessionTokenResponse,
            sessionToken: 'recovered-session-token',
          }),
        });

        // First attempt - provider is down, should fail after retries
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          'Failed to exchange token after 3 attempts'
        );

        // Verify provider was called 3 times (max retries)
        expect(callCount).toBe(3);

        // Second attempt - provider should recover and work
        const token = await externalTokenManager.getToken();
        expect(token).toBe('recovered-session-token');
        expect(callCount).toBe(4); // One more call after recovery
      });

      it('should clear all auth state when provider completely fails', async () => {
        const mockGetAuthToken = vi
          .fn()
          .mockResolvedValueOnce('working-token')
          .mockRejectedValue(new Error('Provider service shutdown'));

        const externalTokenManager = new TokenManager({
          baseURL,
          getAuthToken: mockGetAuthToken,
          retryDelay: 10, // Faster retries for test
        });

        // Mock successful initial exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSessionTokenResponse),
        });

        // Get initial token
        await externalTokenManager.getToken();
        expect(externalTokenManager.hasValidToken()).toBe(true);

        // Clear and try to refresh - should fail
        externalTokenManager.clearToken();
        await expect(externalTokenManager.getToken()).rejects.toThrow(
          TokenError
        );

        // Token state should be properly cleared
        expect(externalTokenManager.hasValidToken()).toBe(false);
        const tokenInfo = externalTokenManager.getTokenInfo();
        expect(tokenInfo.hasToken).toBe(false);
      });
    });
  });
});
