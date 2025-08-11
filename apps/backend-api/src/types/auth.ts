/**
 * JWT Claims interface for standardized token validation
 * Supports Auth0, Clerk, Firebase, and other JWT providers
 */
export interface JWTClaims {
  sub: string;
  email?: string;
  iss: string;
  aud?: string | string[];
  exp: number;
  iat: number;
  // Provider-specific claims
  [key: string]: unknown;
}
