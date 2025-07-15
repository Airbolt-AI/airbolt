/**
 * Environment detection utilities
 */

export type Environment = 'development' | 'production' | 'test';

/**
 * Gets the current environment with comprehensive variant support
 * Handles: production, prod, test, development, dev, undefined, and any other value
 * @returns The normalized environment value
 */
export function getEnvironment(): Environment {
  const env = process.env['NODE_ENV']?.toLowerCase();

  // Handle production variants
  if (env === 'production' || env === 'prod') {
    return 'production';
  }

  // Handle test environment
  if (env === 'test') {
    return 'test';
  }

  // Default to development for dev, development, undefined, or any other value
  return 'development';
}

/**
 * Checks if we're in development mode
 * @returns True if in development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Checks if we're in production mode
 * @returns True if in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Checks if we're in test mode
 * @returns True if in test
 */
export function isTest(): boolean {
  return getEnvironment() === 'test';
}
