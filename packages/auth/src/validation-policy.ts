import type { JWTPayload } from './jwt-validators.js';

export interface ValidationConfig {
  issuer?: string | undefined;
  audience?: string | undefined;
  isProduction: boolean;
}

export class ValidationPolicy {
  constructor(private readonly config: ValidationConfig) {}

  /**
   * Validates the issuer claim and logs appropriate warnings
   */
  validateIssuer(issuer: string | undefined): void {
    if (!issuer || !issuer.startsWith('https://')) {
      throw new Error(
        `Auto-discovery requires HTTPS issuer. Got: ${issuer || 'undefined'}`
      );
    }

    // If an issuer is configured, validate strictly
    if (this.config.issuer) {
      if (issuer !== this.config.issuer) {
        throw new Error(
          `Token issuer mismatch. Expected: ${this.config.issuer}, Got: ${issuer}`
        );
      }
    }
  }

  /**
   * Validates the audience claim if configured
   */
  validateAudience(payload: JWTPayload): void {
    if (!this.config.audience) {
      return;
    }

    const aud = payload['aud'];
    if (!aud || (typeof aud === 'string' && aud !== this.config.audience)) {
      throw new Error(
        `Token audience mismatch. Expected: ${this.config.audience}`
      );
    }
    if (Array.isArray(aud) && !aud.includes(this.config.audience)) {
      throw new Error(
        `Token audience mismatch. Expected: ${this.config.audience}`
      );
    }
  }

  /**
   * Checks if token can be handled based on issuer rules
   */
  canHandleIssuer(issuer: string | undefined): boolean {
    // In production with configured issuer, only handle matching tokens
    if (this.config.isProduction && this.config.issuer) {
      return issuer === this.config.issuer;
    }

    // In production without configured issuer, don't handle any tokens
    if (this.config.isProduction && !this.config.issuer) {
      return false;
    }

    // In development, accept any token with an HTTPS issuer
    return !!issuer && issuer.startsWith('https://');
  }

  /**
   * Checks if this is an opaque token (Auth0 without audience)
   */
  isOpaqueToken(payload: JWTPayload): boolean {
    // Auth0 opaque tokens have no audience or audience equals azp (client ID)
    const aud = payload['aud'];
    const azp = payload['azp'];

    // Check if issuer is Auth0
    const issuer = payload.iss || '';
    if (!issuer.includes('.auth0.com')) {
      return false;
    }

    // If no audience or audience equals client ID, it's opaque
    return !aud || (typeof aud === 'string' && aud === azp);
  }

  /**
   * Validates essential JWT claims exist
   */
  validateClaims(payload: JWTPayload): void {
    // Validate essential claims exist
    if (!payload.sub && !payload.user_id && !payload.userId && !payload.email) {
      throw new Error('JWT missing user identification claims');
    }

    // Validate token is not expired (additional safety check)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT expired');
    }
  }
}
