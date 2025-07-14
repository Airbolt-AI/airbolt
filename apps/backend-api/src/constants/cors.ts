/**
 * CORS Configuration Constants
 */

export const COMMON_DEV_PORTS = [
  'http://localhost:3000', // React/Next.js default
  'http://localhost:5173', // Vite default
  'http://localhost:5174', // Vite second instance
  'http://localhost:4200', // Angular CLI default
  'http://localhost:8080', // Alternative dev port
] as const;

export const DEFAULT_TEST_ORIGINS =
  'http://localhost:3000,http://localhost:3001';

/**
 * Validates if an origin is acceptable for production use
 */
export function isValidProductionOrigin(origin: string): boolean {
  if (origin === '*') return false;
  if (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0')
  )
    return false;
  return origin.startsWith('https://');
}

/**
 * Validates if an origin is a valid URL format
 */
export function isValidURL(origin: string): boolean {
  if (origin === '*') return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates origins based on environment
 * Note: nodeEnv is passed from the env plugin where it's already validated
 */
export function validateOrigins(origins: string[], nodeEnv?: string): boolean {
  if (nodeEnv === 'production') {
    return origins.every(isValidProductionOrigin);
  }

  return origins.every(isValidURL);
}
