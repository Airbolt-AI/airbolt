// Minimal JWT types for token authentication

export interface JWTPayload {
  // Standard JWT claims
  sub: string; // Subject: unique session identifier
  aud: string; // Audience: intended recipient (our API)
  iat?: number; // Issued at (added by fastify-jwt)
  exp?: number; // Expiration (added by fastify-jwt)
}
