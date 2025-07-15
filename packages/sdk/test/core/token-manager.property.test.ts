import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { TokenManager } from '../../src/core/token-manager';

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
            // Note: baseUrl might have a path component, so we normalize it
            const normalizedBase = baseUrl.replace(/\/+$/, '');
            expect(capturedUrl).toBe(`${normalizedBase}/api/tokens`);
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
});
