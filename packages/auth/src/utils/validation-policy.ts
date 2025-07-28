import type { JWTPayload } from '../types.js';
import { AuthError } from '../types.js';

export class ValidationPolicy {
  constructor(
    private readonly config: {
      issuer?: string;
      audience?: string;
      isProduction: boolean;
    }
  ) {}

  validateIssuer(issuer: string | undefined): void {
    if (!issuer || !issuer.startsWith('https://')) {
      throw new AuthError(
        `Auto-discovery requires HTTPS issuer. Got: ${issuer || 'undefined'}`,
        undefined,
        'Use HTTPS URLs for security in token validation',
        'Example: https://your-tenant.auth0.com/'
      );
    }

    // If an issuer is configured, validate strictly
    if (this.config.issuer) {
      if (issuer !== this.config.issuer) {
        throw new AuthError(
          `Token issuer mismatch. Expected: ${this.config.issuer}, Got: ${issuer}`,
          undefined,
          'Configure EXTERNAL_JWT_ISSUER to match your auth provider',
          `Set EXTERNAL_JWT_ISSUER=${issuer} in your environment`
        );
      }
    }
  }

  validateAudience(payload: JWTPayload): void {
    if (!this.config.audience) return;

    const aud = payload.aud;
    if (!aud || (typeof aud === 'string' && aud !== this.config.audience)) {
      throw new AuthError(
        `Token audience mismatch. Expected: ${this.config.audience}`,
        undefined,
        'Configure audience parameter in your auth provider',
        'Create an API in your auth provider dashboard and set audience'
      );
    }
    if (Array.isArray(aud) && !aud.includes(this.config.audience)) {
      throw new AuthError(
        `Token audience mismatch. Expected: ${this.config.audience}`,
        undefined,
        'Add your API audience to the token request',
        'Include audience parameter when requesting tokens'
      );
    }
  }

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

  isOpaqueToken(payload: JWTPayload): boolean {
    // Auth0 opaque tokens have no audience or audience equals azp (client ID)
    const aud = payload.aud;
    const azp = payload.azp;

    // Check if issuer is Auth0
    const issuer = payload.iss || '';
    if (!issuer.includes('.auth0.com')) {
      return false;
    }

    // If no audience or audience equals client ID, it's opaque
    return !aud || (typeof aud === 'string' && aud === azp);
  }

  validateClaims(payload: JWTPayload): void {
    // Validate essential claims exist
    if (!payload.sub && !payload.user_id && !payload.userId && !payload.email) {
      throw new AuthError(
        'JWT missing user identification claims',
        undefined,
        'Token must include sub, user_id, userId, or email claim',
        'Configure your auth provider to include user identification in tokens'
      );
    }

    // Validate token is not expired (additional safety check)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AuthError(
        'JWT expired',
        undefined,
        'Request a new token from your auth provider',
        'Tokens expire for security - refresh or re-authenticate'
      );
    }
  }
}
