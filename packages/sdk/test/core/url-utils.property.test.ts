import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { joinUrl, normalizeUrl } from '../../src/core/url-utils.js';

describe('URL utilities property tests', () => {
  describe('joinUrl properties', () => {
    it('should never produce double slashes in the middle of URL', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.array(
            fc.string().filter(s => s.length > 0),
            { minLength: 0, maxLength: 5 }
          ),
          (baseUrl, segments) => {
            const result = joinUrl(baseUrl, ...segments);

            // Parse URL to check pathname
            const url = new URL(result);

            // The pathname should never contain '//'
            expect(url.pathname).not.toMatch(/\/\//);

            // The full URL after the protocol should not contain '//' except after protocol
            const withoutProtocol = result.replace(/^https?:\/\//, '');
            expect(withoutProtocol).not.toMatch(/\/\//);
          }
        )
      );
    });

    it('should handle any combination of slashes', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.webUrl(), fc.constantFrom('', '/', '//', '///'))
            .map(([url, suffix]) => url + suffix),
          fc.array(
            fc
              .tuple(
                fc.constantFrom('', '/', '//'),
                fc
                  .string()
                  .filter(
                    s => s.length > 0 && !s.includes('\n') && !s.includes('\r')
                  ),
                fc.constantFrom('', '/', '//')
              )
              .map(([prefix, str, suffix]) => prefix + str + suffix),
            { minLength: 1, maxLength: 3 }
          ),
          (baseUrl, segments) => {
            const result = joinUrl(baseUrl, ...segments);

            // Result should be a valid URL
            expect(() => new URL(result)).not.toThrow();

            // Should not have double slashes in path
            const url = new URL(result);
            expect(url.pathname).not.toMatch(/\/\//);
          }
        )
      );
    });

    it('should handle empty and slash-only segments', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.array(fc.constantFrom('', '/', '//', '   ', '\t'), {
            minLength: 0,
            maxLength: 5,
          }),
          (baseUrl, segments) => {
            const result = joinUrl(baseUrl, ...segments);

            // When all segments are empty or slashes, should return normalized base
            // This includes normalizing double slashes and dot paths
            let expectedBase: string;
            if (baseUrl.includes('://')) {
              try {
                // Use URL constructor for proper normalization (handles . and .. paths)
                const url = new URL(baseUrl);
                url.pathname = url.pathname
                  .replace(/\/+/g, '/')
                  .replace(/\/+$/, '');
                expectedBase = url.toString().replace(/\/+$/, '');
              } catch {
                // Fallback for malformed URLs
                const [protocol, ...rest] = baseUrl.split('://');
                const cleanedRest = rest
                  .join('://')
                  .replace(/\/+/g, '/')
                  .replace(/\/+$/, '');
                expectedBase = `${protocol}://${cleanedRest}`;
              }
            } else {
              expectedBase = baseUrl.replace(/\/+/g, '/').replace(/\/+$/, '');
            }
            expect(result).toBe(expectedBase);
          }
        )
      );
    });

    it('should work with common API patterns', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.oneof(
                fc.constant('http://localhost'),
                fc.constant('http://localhost:3000'),
                fc.constant('https://api.example.com'),
                fc.constant('https://api.example.com/v1'),
                fc.constant('https://airbolt.onrender.com')
              ),
              fc.constantFrom('', '/', '//', '///')
            )
            .map(([url, suffix]) => url + suffix),
          fc.constantFrom('api/tokens', 'api/chat', 'health', 'auth/refresh'),
          (baseUrl, endpoint) => {
            const result = joinUrl(baseUrl, endpoint);

            // Should produce clean URLs (check path only, not protocol)
            const url = new URL(result);
            expect(url.pathname).not.toMatch(/\/\//);
            expect(result).toMatch(new RegExp(`/${endpoint}$`));

            // Should be a valid URL
            expect(() => new URL(result)).not.toThrow();
          }
        )
      );
    });

    it('joinUrl should be idempotent when no segments', () => {
      fc.assert(
        fc.property(fc.webUrl(), baseUrl => {
          const once = joinUrl(baseUrl);
          const twice = joinUrl(once);

          expect(once).toBe(twice);
        })
      );
    });
  });

  describe('normalizeUrl properties', () => {
    it('should always remove all trailing slashes', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.webUrl(), fc.stringMatching(/\/+/))
            .map(([url, slashes]) => url + slashes),
          url => {
            const normalized = normalizeUrl(url);

            expect(normalized).not.toMatch(/\/$/);
            expect(normalized).not.toMatch(/\/\/$/);
            expect(normalized).not.toMatch(/\/\/\/$/);
          }
        )
      );
    });

    it('should be idempotent', () => {
      fc.assert(
        fc.property(fc.webUrl(), url => {
          const once = normalizeUrl(url);
          const twice = normalizeUrl(once);

          expect(once).toBe(twice);
        })
      );
    });

    it('should not change URLs without trailing slashes', () => {
      fc.assert(
        fc.property(fc.webUrl(), url => {
          // Remove any trailing slashes first
          const cleanUrl = url.replace(/\/+$/, '');
          const normalized = normalizeUrl(cleanUrl);

          expect(normalized).toBe(cleanUrl);
        })
      );
    });
  });

  describe('integration properties', () => {
    it('normalized base should produce same result as non-normalized', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.webUrl(), fc.constantFrom('', '/', '//', '///'))
            .map(([url, suffix]) => url + suffix),
          fc.array(
            fc
              .string()
              .filter(
                s =>
                  s.length > 0 && s.length < 50 && /^[a-zA-Z0-9\-_\/]+$/.test(s)
              ),
            { minLength: 1, maxLength: 3 }
          ),
          (baseUrl, segments) => {
            const normalizedBase = normalizeUrl(baseUrl);

            const result1 = joinUrl(baseUrl, ...segments);
            const result2 = joinUrl(normalizedBase, ...segments);

            expect(result1).toBe(result2);
          }
        )
      );
    });

    it('should fix the exact reported issue patterns', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'https://airbolt.onrender.com//',
            'http://localhost:3000/',
            'https://api.example.com///'
          ),
          fc.constantFrom('api/tokens', 'api/chat'),
          (baseUrl, endpoint) => {
            const result = joinUrl(baseUrl, endpoint);

            // Should not have double slashes in the path
            const withoutProtocol = result.replace(/^https?:\/\//, '');
            expect(withoutProtocol).not.toMatch(/\/\//);

            // Should have the endpoint in the URL
            expect(result).toMatch(new RegExp(`/${endpoint}$`));

            // Full URL should be clean
            const expectedBase = baseUrl.replace(/\/+$/, '');
            expect(result).toBe(`${expectedBase}/${endpoint}`);
          }
        )
      );
    });
  });
});
