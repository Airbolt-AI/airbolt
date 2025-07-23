/**
 * URL utility functions for consistent URL construction across the SDK
 *
 * This module provides a centralized solution for URL joining that handles
 * edge cases like trailing slashes, empty segments, and various URL formats.
 */

/**
 * Join URL segments safely, handling trailing slashes and empty segments
 *
 * @example
 * ```typescript
 * joinUrl('https://api.example.com/', 'api', 'tokens')
 * // Returns: 'https://api.example.com/api/tokens'
 *
 * joinUrl('https://api.example.com///', '/api/', '/tokens/')
 * // Returns: 'https://api.example.com/api/tokens'
 * ```
 *
 * @param base - The base URL (may contain trailing slashes)
 * @param segments - Path segments to append (may contain leading/trailing slashes)
 * @returns The properly joined URL
 */
export function joinUrl(base: string, ...segments: string[]): string {
  // Handle empty base
  if (!base) {
    throw new Error('Base URL cannot be empty');
  }

  // Parse the base URL to handle protocol separately
  let normalizedBase: string;

  if (base.includes('://')) {
    try {
      // Use URL constructor for proper parsing
      const url = new URL(base);
      // Clean up the pathname
      url.pathname = url.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
      // Also remove trailing slash from the whole URL if pathname is empty or just '/'
      normalizedBase = url.toString().replace(/\/+$/, '');
    } catch {
      // Fallback for malformed URLs
      const [protocol, ...rest] = base.split('://');
      const cleanedRest = rest
        .join('://')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '');
      normalizedBase = `${protocol}://${cleanedRest}`;
    }
  } else {
    // For non-URL paths, just clean up slashes
    normalizedBase = base.replace(/\/+/g, '/').replace(/\/+$/, '');
  }

  // Filter out empty segments and join with '/'
  const pathSegments = segments
    .filter(segment => segment && typeof segment === 'string')
    .map(segment => {
      // Replace backslashes with forward slashes
      const normalized = segment.replace(/\\/g, '/');
      // Trim whitespace first
      const trimmed = normalized.trim();
      // Then remove leading and trailing slashes
      const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '');
      return withoutSlashes;
    })
    .filter(segment => segment.length > 0);

  // If no segments, return the normalized base
  if (pathSegments.length === 0) {
    return normalizedBase;
  }

  // Join with single forward slash
  return `${normalizedBase}/${pathSegments.join('/')}`;
}

/**
 * Normalize a URL by removing trailing slashes
 *
 * @example
 * ```typescript
 * normalizeUrl('https://api.example.com///')
 * // Returns: 'https://api.example.com'
 * ```
 *
 * @param url - The URL to normalize
 * @returns The URL without trailing slashes
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
