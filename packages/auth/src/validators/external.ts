import type { JWTValidator, JWTPayload, AuthConfig } from '../types.js';
import { AuthError } from '../types.js';
import { JWKSUtils } from '../utils/jwks-utils.js';
import { TokenValidator } from '../utils/token-validator.js';

/**
 * Unified External JWT Validator
 *
 * Handles all external JWT validation including:
 * - Secret-based validation (HS256)
 * - Public key validation (configured key)
 * - JWKS auto-discovery validation (RS256)
 *
 * Replaces the old ExternalJWTValidator, JWKSValidator, and AutoDiscoveryValidator
 */
export class ExternalJWTValidator implements JWTValidator {
  name = 'external';
  private tokenValidator = new TokenValidator();

  constructor(private config: AuthConfig) {}

  canHandle(token: string): boolean {
    try {
      const decoded = this.tokenValidator.decode(token);
      const issuer = decoded.payload.iss;

      // Don't handle internal tokens
      if (issuer === 'airbolt-api') {
        return false;
      }

      return this.canHandleIssuer(issuer);
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    const decoded = this.tokenValidator.decode(token);
    const issuer = decoded.payload.iss;

    // Validate issuer format
    this.validateIssuer(issuer);

    let payload: JWTPayload;

    // Try secret-based validation first (HS256)
    if (this.config.EXTERNAL_JWT_SECRET) {
      payload = await this.tokenValidator.verify(
        token,
        this.config.EXTERNAL_JWT_SECRET
      );
    }
    // Try configured public key
    else if (this.config.EXTERNAL_JWT_PUBLIC_KEY) {
      payload = await this.tokenValidator.verify(
        token,
        this.config.EXTERNAL_JWT_PUBLIC_KEY
      );
    }
    // Try JWKS auto-discovery
    else if (issuer) {
      payload = await this.verifyWithJWKS(token, decoded, issuer);
    }
    // No validation method available
    else {
      throw new AuthError(
        'No external JWT validation method configured',
        undefined,
        'Configure EXTERNAL_JWT_SECRET, EXTERNAL_JWT_PUBLIC_KEY, or enable auto-discovery',
        'Set one of: EXTERNAL_JWT_SECRET (for HS256) or EXTERNAL_JWT_PUBLIC_KEY (for RS256)'
      );
    }

    // Validate claims
    this.validateAudience(payload);
    this.validateClaims(payload);
    this.checkForOpaqueToken(payload);

    return payload;
  }

  private async verifyWithJWKS(
    token: string,
    decoded: { header?: { kid?: string } },
    issuer: string
  ): Promise<JWTPayload> {
    try {
      // Fetch JWKS and find the right key
      const jwks = await JWKSUtils.fetchJWKS(issuer);
      const key = JWKSUtils.findKey(jwks, decoded.header?.kid);

      if (!key) {
        throw new AuthError(
          'No matching key found in JWKS',
          undefined,
          'Token key ID (kid) not found in provider JWKS',
          'Verify token is from the correct auth provider'
        );
      }

      // Extract public key and verify token
      const publicKey = JWKSUtils.extractPublicKey(key);
      return await this.tokenValidator.verify(token, publicKey);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new AuthError(
        `JWKS validation failed: ${message}`,
        undefined,
        'Check network connectivity and auth provider configuration',
        'Verify issuer URL and JWKS endpoint accessibility'
      );
    }
  }

  extractUserId(payload: JWTPayload): string {
    return this.tokenValidator.extractUserId(payload);
  }

  // Inline validation methods (simplified from ValidationPolicy)
  private canHandleIssuer(issuer: string | undefined): boolean {
    // Use 'production' string comparison for validation policy
    // This is intentional as validation policy needs exact environment matching
    // eslint-disable-next-line runtime-safety/prefer-environment-utils
    const isProduction = this.config.NODE_ENV === 'production';

    // In production with configured issuer, only handle matching tokens
    if (isProduction && this.config.EXTERNAL_JWT_ISSUER) {
      return issuer === this.config.EXTERNAL_JWT_ISSUER;
    }

    // In production without configured issuer, don't handle any tokens
    if (isProduction && !this.config.EXTERNAL_JWT_ISSUER) {
      return false;
    }

    // In development, accept any token with an HTTPS issuer
    return !!issuer && issuer.startsWith('https://');
  }

  private validateIssuer(issuer: string | undefined): void {
    if (!issuer || !issuer.startsWith('https://')) {
      throw new AuthError(
        `External JWT requires HTTPS issuer. Got: ${issuer || 'undefined'}`,
        undefined,
        'Use HTTPS URLs for security in token validation',
        'Example: https://your-tenant.auth0.com/'
      );
    }

    // If an issuer is configured, validate strictly
    if (this.config.EXTERNAL_JWT_ISSUER) {
      if (issuer !== this.config.EXTERNAL_JWT_ISSUER) {
        throw new AuthError(
          `Token issuer mismatch. Expected: ${this.config.EXTERNAL_JWT_ISSUER}, Got: ${issuer}`,
          undefined,
          'Configure EXTERNAL_JWT_ISSUER to match your auth provider',
          `Set EXTERNAL_JWT_ISSUER=${issuer} in your environment`
        );
      }
    }
  }

  private validateAudience(payload: JWTPayload): void {
    if (!this.config.EXTERNAL_JWT_AUDIENCE) return;

    const aud = payload.aud;
    if (
      !aud ||
      (typeof aud === 'string' && aud !== this.config.EXTERNAL_JWT_AUDIENCE)
    ) {
      throw new AuthError(
        `Token audience mismatch. Expected: ${this.config.EXTERNAL_JWT_AUDIENCE}`,
        undefined,
        'Configure audience parameter in your auth provider',
        'Create an API in your auth provider dashboard and set audience'
      );
    }
    if (
      Array.isArray(aud) &&
      !aud.includes(this.config.EXTERNAL_JWT_AUDIENCE)
    ) {
      throw new AuthError(
        `Token audience mismatch. Expected: ${this.config.EXTERNAL_JWT_AUDIENCE}`,
        undefined,
        'Add your API audience to the token request',
        'Include audience parameter when requesting tokens'
      );
    }
  }

  private validateClaims(payload: JWTPayload): void {
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

  private checkForOpaqueToken(payload: JWTPayload): void {
    // Auth0 opaque tokens have no audience or audience equals azp (client ID)
    const aud = payload.aud;
    const azp = payload.azp;
    const issuer = payload.iss || '';

    if (issuer.includes('.auth0.com')) {
      // If no audience or audience equals client ID, it's opaque
      if (!aud || (typeof aud === 'string' && aud === azp)) {
        throw new AuthError(
          'Auth0 returned opaque token instead of JWT',
          'auth0',
          'Configure audience parameter to get JWT tokens',
          'Add audience to Auth0Provider or getAccessTokenSilently() call'
        );
      }
    }
  }
}
