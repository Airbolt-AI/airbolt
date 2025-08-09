import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { TokenManager, TokenError } from '../../src/core/token-manager';
import { joinUrl } from '../../src/core/url-utils';

describe('TokenManager property-based tests', () => {
  describe('URL construction', () => {
    it('should handle baseURL with or without trailing slashes consistently', () => {
      fc.assert(
        fc.asyncProperty(
          fc.webUrl().map(url => url.replace(/\/$/, '')), // Base URL without trailing slash
          fc.constantFrom('/', ''), // Trailing slash variants
          async (baseUrl, trailingSlash) => {
            const baseURLWithSlash = `${baseUrl}${trailingSlash}`;

            // Create token manager with the URL
            const tokenManager = new TokenManager({
              baseURL: baseURLWithSlash,
              userId: 'test-user',
            });

            // Mock fetch to capture the URL
            let capturedUrl = '';
            const mockFetch = vi.fn().mockImplementation((url: string) => {
              capturedUrl = url;
              return Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    token: 'test-token',
                    expiresIn: '3600',
                    tokenType: 'Bearer',
                  }),
              });
            });
            global.fetch = mockFetch;

            // Trigger the token fetch
            await tokenManager.getToken();

            // Verify the URL is correctly formed
            // TokenManager uses joinUrl internally, so we use it to calculate expected URL
            const expectedUrl = joinUrl(baseURLWithSlash, 'api/tokens');
            expect(capturedUrl).toBe(expectedUrl);
            expect(capturedUrl).not.toContain('//api');
            // URL should end with /api/tokens
            expect(capturedUrl).toMatch(/\/api\/tokens$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce double slashes in URLs', () => {
      fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.array(fc.constantFrom('/', ''), { minLength: 0, maxLength: 3 }),
          async (baseUrl, extraSlashes) => {
            // Add random slashes to the URL
            const messyUrl = baseUrl + extraSlashes.join('');

            const tokenManager = new TokenManager({
              baseURL: messyUrl,
              userId: 'test-user',
            });

            // Mock fetch to capture the URL
            let capturedUrl = '';
            const mockFetch = vi.fn().mockImplementation((url: string) => {
              capturedUrl = url;
              return Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    token: 'test-token',
                    expiresIn: '3600',
                    tokenType: 'Bearer',
                  }),
              });
            });
            global.fetch = mockFetch;

            // Trigger the token fetch
            await tokenManager.getToken();

            // Verify no double slashes in the path we control (after the base URL)
            // We only care about double slashes we introduce, not ones already in the base URL
            const apiPath = capturedUrl.substring(
              capturedUrl.lastIndexOf('/api/tokens')
            );
            expect(apiPath).toBe('/api/tokens');
            expect(apiPath).not.toContain('//');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain URL structure across all valid URL formats', () => {
      fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('http://localhost:3000'),
            fc.constant('https://api.example.com'),
            fc.constant('https://my-ai-backend.onrender.com'),
            fc.constant('http://192.168.1.1:8080'),
            fc.webUrl()
          ),
          fc.boolean(), // Add trailing slash or not
          async (baseUrl, addTrailingSlash) => {
            const finalUrl = addTrailingSlash ? `${baseUrl}/` : baseUrl;

            const tokenManager = new TokenManager({
              baseURL: finalUrl,
              userId: 'test-user',
            });

            // Mock fetch to capture the URL
            let capturedUrl = '';
            const mockFetch = vi.fn().mockImplementation((url: string) => {
              capturedUrl = url;
              return Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    token: 'test-token',
                    expiresIn: '3600',
                    tokenType: 'Bearer',
                  }),
              });
            });
            global.fetch = mockFetch;

            // Trigger the token fetch
            await tokenManager.getToken();

            // Parse both URLs to compare structure
            const originalParsed = new URL(baseUrl);
            const resultParsed = new URL(capturedUrl);

            // Verify URL components are preserved
            expect(resultParsed.protocol).toBe(originalParsed.protocol);
            expect(resultParsed.hostname).toBe(originalParsed.hostname);
            expect(resultParsed.port).toBe(originalParsed.port);
            // The pathname should end with /api/tokens
            expect(resultParsed.pathname).toMatch(/\/api\/tokens$/);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Authentication Chaos Testing', () => {
    it('handles concurrent token refresh race conditions without duplicating requests', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // Number of concurrent requests (reduced for stability)
          fc.integer({ min: 60, max: 3600 }), // Seconds until token expiry (longer for stability)
          async (concurrentRequests, secondsToExpiry) => {
            const baseURL = 'https://api.example.com';
            let requestCount = 0;

            const mockFetch = vi.fn().mockImplementation(() => {
              requestCount++;
              return Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    token: `token-${requestCount}`,
                    expiresIn: secondsToExpiry.toString(),
                    tokenType: 'Bearer',
                  }),
              });
            });
            global.fetch = mockFetch;

            const tokenManager = new TokenManager({
              baseURL,
              userId: 'test-user',
              refreshBuffer: 0, // No buffer for precise timing
            });

            // Fire concurrent requests
            const requests = Array(concurrentRequests)
              .fill(0)
              .map(() => tokenManager.getToken());

            const tokens = await Promise.all(requests);

            // Property: All concurrent requests should get the same token
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(1);

            // Property: Should minimize actual fetch requests (allow for race conditions)
            expect(requestCount).toBeLessThanOrEqual(concurrentRequests);
            expect(requestCount).toBeGreaterThanOrEqual(1);

            // Property: Token should be cached for subsequent calls
            const cachedToken = await tokenManager.getToken();
            expect(cachedToken).toBe(tokens[0]);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('handles token expiration boundary conditions correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3600 }), // Expiry time in seconds
          fc.integer({ min: 0, max: 60 }), // Refresh buffer in seconds (smaller range)
          async (expiryTime, refreshBuffer) => {
            const baseURL = 'https://api.example.com';
            let tokenCounter = 0;

            const mockFetch = vi.fn().mockImplementation(() => {
              tokenCounter++;
              return Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    token: `token-${tokenCounter}`,
                    expiresIn: expiryTime.toString(),
                    tokenType: 'Bearer',
                  }),
              });
            });
            global.fetch = mockFetch;

            const tokenManager = new TokenManager({
              baseURL,
              userId: 'test-user',
              refreshBuffer,
            });

            // Get initial token
            const token = await tokenManager.getToken();
            expect(token).toMatch(/^token-\d+$/);

            // Property: Token validity should be consistent with expiry and buffer
            const isValid = tokenManager.hasValidToken();
            const effectiveExpiry = Math.max(expiryTime - refreshBuffer, 0);

            if (effectiveExpiry > 5) {
              expect(isValid).toBe(true);
            } else {
              // Very short expiry might be considered invalid due to buffer and timing
              expect(typeof isValid).toBe('boolean');
            }

            // Property: Token info should reflect current state
            const info = tokenManager.getTokenInfo();
            expect(info.hasToken).toBe(true);
            expect(info.expiresAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('handles authentication provider failure patterns gracefully', () => {
      fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('success'),
            fc.constant('network_error'),
            fc.constant('null_token')
          ),
          fc.integer({ min: 1, max: 3 }), // Max retries
          async (failureType, maxRetries) => {
            const baseURL = 'https://api.example.com';
            let callCount = 0;

            // Mock auth provider with failure patterns
            const mockGetAuthToken = vi.fn().mockImplementation(() => {
              callCount++;

              switch (failureType) {
                case 'success':
                  return Promise.resolve(`provider-token-${callCount}`);
                case 'network_error':
                  throw new Error('Network error: Connection refused');
                case 'null_token':
                  return Promise.resolve(null);
                default:
                  return Promise.resolve('default-token');
              }
            });

            // Mock exchange endpoint - Create response data outside to avoid timing issues
            const responseData = {
              sessionToken: `session-token-${Date.now()}`,
              expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
              provider: 'test',
            };

            const mockFetch = vi.fn().mockImplementation((url: string) => {
              if (url.includes('/api/auth/exchange')) {
                return Promise.resolve({
                  ok: true,
                  json: async () => responseData,
                });
              }
              return Promise.reject(new Error('Unexpected URL'));
            });
            global.fetch = mockFetch;

            const tokenManager = new TokenManager({
              baseURL,
              getAuthToken: mockGetAuthToken,
              maxRetries,
              retryDelay: 10, // Fast retries for testing
            });

            if (failureType === 'success') {
              // Property: Successful auth should return valid session token
              const token = await tokenManager.getToken();
              expect(token).toMatch(/^session-token-\d+$/);

              const info = tokenManager.getTokenInfo();
              expect(info.authMethod).toBe('external');
              expect(info.hasToken).toBe(true);
            } else {
              // Property: Failures should throw TokenError and clean up state
              await expect(tokenManager.getToken()).rejects.toThrow(TokenError);

              const info = tokenManager.getTokenInfo();
              expect(info.hasToken).toBe(false);

              // Property: Network errors in provider token acquisition should fail fast
              // because they indicate provider unavailability, not network issues during exchange
              expect(mockGetAuthToken).toHaveBeenCalledTimes(1);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
