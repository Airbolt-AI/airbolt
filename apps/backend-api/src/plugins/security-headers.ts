import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { isProduction } from '@airbolt/config';

/**
 * Security headers configuration
 */
interface SecurityHeadersConfig {
  /**
   * Standard security headers for all routes
   */
  standard: Record<string, string>;

  /**
   * Stricter headers for authentication endpoints
   */
  auth: Record<string, string>;

  /**
   * Production-only headers (like HSTS)
   */
  production: Record<string, string>;
}

/**
 * Create security headers configuration
 */
function createSecurityHeaders(): SecurityHeadersConfig {
  const standard = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
  };

  const auth = {
    ...standard,
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none';",
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  };

  const production = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  };

  return { standard, auth, production };
}

/**
 * Check if the route is an authentication endpoint
 */
function isAuthRoute(url: string): boolean {
  return url.startsWith('/api/auth/');
}

/**
 * Security headers plugin
 * Adds appropriate security headers based on the route and environment
 */
const securityHeaders: FastifyPluginAsync = async fastify => {
  const config = createSecurityHeaders();
  const isProd = isProduction();

  // Apply security headers to all routes
  fastify.addHook('onRequest', async (request, reply) => {
    // Start with standard headers
    const headers = { ...config.standard };

    // Add production-specific headers if in production
    if (isProd) {
      Object.assign(headers, config.production);
    }

    // Apply stricter headers for auth routes
    if (isAuthRoute(request.url)) {
      Object.assign(headers, config.auth);
    }

    // Set all headers
    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }
  });

  // Log security headers configuration on startup
  fastify.log.info(
    {
      standardHeaders: Object.keys(config.standard).length,
      authHeaders: Object.keys(config.auth).length,
      productionHeaders: isProd ? Object.keys(config.production).length : 0,
      environment: isProd ? 'production' : 'development',
    },
    'Security headers plugin registered'
  );
};

export default fp(securityHeaders, {
  name: 'security-headers',
  fastify: '>=4.0.0',
});
